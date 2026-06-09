import asyncio
import json
import os
import re
import tempfile
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, List

from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse

from services.jd_parser import parse_jd_from_bytes
from services.jd_analyzer import analyze_jd
from services.jd_scraper import scrape_job_url
from services.resume_parser import get_pdf_files, parse_single_resume
from services.bge_ranker import bi_encode_rank
from services.gemini_reranker import gemini_rerank
from services.file_manager import create_filtered_zip
from services.excel_exporter import export_to_excel

app = FastAPI(title="RecruitIQ API", version="4.0.0")



ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs: Dict[str, Any] = {}


def init_job() -> Dict:
    return {
        "status": "pending",
        "phase": "Initializing...",
        "progress": 0,
        "total": 0,
        "current_file": "",
        "results": [],
        "excel_path": None,
        "zip_path": None,
        "filtered_folder": None,
        "error": None,
    }


# ── JD endpoints ──────────────────────────────────────────────────────────────

@app.post("/api/analyze-jd")
async def analyze_jd_endpoint(jd_file: UploadFile = File(...)):
    file_bytes = await jd_file.read()
    try:
        jd_text = parse_jd_from_bytes(file_bytes, jd_file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse JD: {str(e)}")
    if not jd_text.strip():
        raise HTTPException(status_code=400, detail="JD file appears empty or unreadable.")
    requirements = analyze_jd(jd_text)
    requirements["jd_text"] = jd_text
    return requirements


@app.post("/api/analyze-jd-text")
async def analyze_jd_text_endpoint(jd_text: str = Form(...)):
    """Analyze JD from raw pasted text."""
    if not jd_text.strip():
        raise HTTPException(status_code=400, detail="JD text is required.")
    requirements = analyze_jd(jd_text)
    requirements["jd_text"] = jd_text
    return requirements


@app.post("/api/analyze-jd-url")
async def analyze_jd_url_endpoint(url: str = Form(...)):
    """Scrape a LinkedIn or Naukri job posting URL and analyze it."""
    if not url.strip():
        raise HTTPException(status_code=400, detail="URL is required.")
    jd_text = scrape_job_url(url.strip())
    if not jd_text:
        raise HTTPException(
            status_code=422,
            detail="Could not extract job description from this URL. The site may have blocked scraping. Please copy and paste the job description manually."
        )
    requirements = analyze_jd(jd_text)
    requirements["jd_text"] = jd_text
    return requirements


@app.post("/api/refine-skills")
async def refine_skills_endpoint(
    jd_text: str = Form(...),
    feedback: str = Form(...),
):
    if not jd_text.strip():
        raise HTTPException(status_code=400, detail="JD text is required.")
    requirements = analyze_jd(jd_text, feedback=feedback)
    requirements["jd_text"] = jd_text
    return requirements


# ── Screening endpoint ────────────────────────────────────────────────────────

@app.post("/api/screen")
async def screen_resumes(
    background_tasks: BackgroundTasks,
    jd_file: UploadFile = File(None),
    resume_files: List[UploadFile] = File(...),
    top_n: int = Form(...),
    primary_skills: str = Form(default="[]"),
    secondary_skills: str = Form(default="[]"),
    jd_text_override: str = Form(default=""),
    skill_match_mode: str = Form(default="OR"),
):
    if len(resume_files) > 400:
        raise HTTPException(status_code=400, detail="Maximum 400 resume files allowed.")

    job_id = str(uuid.uuid4())
    jobs[job_id] = init_job()

    temp_dir = os.path.join(tempfile.gettempdir(), f"recruitiq_{job_id}")
    os.makedirs(temp_dir, exist_ok=True)

    saved = 0
    for rf in resume_files:
        bare_name = os.path.basename(rf.filename or "")
        ext = os.path.splitext(bare_name)[1].lower()
        if bare_name and ext in (".pdf", ".docx", ".doc"):
            content = await rf.read()
            dest = os.path.join(temp_dir, bare_name)
            with open(dest, "wb") as f:
                f.write(content)
            saved += 1

    if saved == 0:
        raise HTTPException(status_code=400, detail="No valid PDF/DOCX resumes found.")

    # Parse JD text
    jd_text = jd_text_override.strip()
    jd_filename = "job_description"
    if not jd_text and jd_file:
        file_bytes = await jd_file.read()
        jd_filename = jd_file.filename or "job_description"
        try:
            jd_text = parse_jd_from_bytes(file_bytes, jd_filename)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not parse JD: {str(e)}")

    if not jd_text.strip():
        raise HTTPException(status_code=400, detail="No JD text provided.")

    try:
        approved_primary = json.loads(primary_skills) if primary_skills else []
        approved_secondary = json.loads(secondary_skills) if secondary_skills else []
    except json.JSONDecodeError:
        approved_primary, approved_secondary = [], []

    background_tasks.add_task(
        run_screening,
        job_id=job_id,
        jd_text=jd_text,
        jd_filename=jd_filename,
        resume_folder=temp_dir,
        top_n=int(top_n),
        approved_primary=approved_primary,
        approved_secondary=approved_secondary,
        skill_match_mode=skill_match_mode,
    )

    return {"job_id": job_id}


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "4.0.0"}


@app.get("/api/progress/{job_id}")
async def stream_progress(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        while True:
            job = jobs.get(job_id)
            if not job:
                break
            payload = {k: v for k, v in job.items() if k != "excel_path"}
            yield f"data: {json.dumps(payload)}\n\n"
            if job["status"] in ("complete", "error"):
                break
            await asyncio.sleep(0.4)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/results/{job_id}")
async def get_results(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs[job_id]
    return {
        "status": job["status"],
        "results": job["results"],
        "filtered_folder": job.get("filtered_folder"),
        "error": job["error"],
    }


@app.get("/api/download/{job_id}")
async def download_excel(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    excel_path = jobs[job_id].get("excel_path")
    if not excel_path or not os.path.exists(excel_path):
        raise HTTPException(status_code=404, detail="Excel report not yet available")
    return FileResponse(
        excel_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=os.path.basename(excel_path),
    )


@app.get("/api/download-zip/{job_id}")
async def download_zip(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    zip_path = jobs[job_id].get("zip_path")
    if not zip_path or not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="ZIP not yet available")
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=os.path.basename(zip_path),
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def extract_candidate_key(filename: str) -> str:
    name = os.path.splitext(filename)[0]
    parts = re.split(r'[_\-\s\.]+', name)
    tokens = []
    for part in parts:
        camel = re.sub(r'([a-z])([A-Z])', r'\1 \2', part).split()
        tokens.extend(camel if camel else [part])
    key_tokens = [t.lower() for t in tokens if len(t) >= 2][:2]
    return ''.join(key_tokens)


def deduplicate_by_candidate(scored: list) -> list:
    seen = {}
    for resume in scored:
        key = extract_candidate_key(resume["filename"])
        if key not in seen:
            seen[key] = resume
    return list(seen.values())


# ── Background screening task ─────────────────────────────────────────────────

async def run_screening(
    job_id: str,
    jd_text: str,
    jd_filename: str,
    resume_folder: str,
    top_n: int,
    approved_primary: List[str] = None,
    approved_secondary: List[str] = None,
    skill_match_mode: str = "OR",
):
    try:
        job = jobs[job_id]
        job["status"] = "running"

        job["phase"] = "Analyzing job description..."
        jd_requirements = analyze_jd(jd_text)
        if approved_primary:
            jd_requirements["primary_skills"] = approved_primary
            jd_requirements["secondary_skills"] = approved_secondary or []
        jd_requirements["skill_match_mode"] = skill_match_mode

        print(f"[JD] Role: {jd_requirements.get('required_title')} | "
              f"Skills: {jd_requirements.get('primary_skills')} | "
              f"Mode: {skill_match_mode}")

        job["phase"] = "Scanning resumes..."
        pdf_files = get_pdf_files(resume_folder)
        total = len(pdf_files)
        job["total"] = total

        if total == 0:
            job["status"] = "error"
            job["error"] = "No resumes found."
            return

        # Phase 1 — async PDF parsing, 4 concurrent, 20s per-file timeout
        job["phase"] = "Phase 1: Reading resumes..."
        parsed = []
        completed = 0
        loop = asyncio.get_running_loop()
        # 8 workers so abandoned threads (stuck on bad PDFs) don't starve healthy ones
        parse_executor = ThreadPoolExecutor(max_workers=8)
        sem = asyncio.Semaphore(4)

        async def parse_one(fn: str):
            nonlocal completed
            file_path = os.path.join(resume_folder, fn)
            result = None
            async with sem:
                try:
                    result = await asyncio.wait_for(
                        loop.run_in_executor(
                            parse_executor, parse_single_resume, file_path, fn
                        ),
                        timeout=20.0,
                    )
                except Exception:
                    print(f"[SKIP] {fn} (timeout or parse error)")
            completed += 1
            job["progress"] = completed
            job["current_file"] = fn
            if result:
                parsed.append(result)

        await asyncio.gather(*[parse_one(fn) for fn in pdf_files])
        parse_executor.shutdown(wait=False)

        if not parsed:
            job["status"] = "complete"
            job["phase"] = "Done — no resumes could be parsed."
            job["results"] = []
            return

        loop = asyncio.get_running_loop()

        # Phase 1.5 — BGE bi-encoder semantic ranking
        bi_top_k = min(150, len(parsed))
        job["phase"] = f"Phase 1.5: Semantic ranking {len(parsed)} resumes..."
        job["progress"] = 0
        job["total"] = len(parsed)
        bi_ranked = await loop.run_in_executor(None, bi_encode_rank, jd_text, parsed, bi_top_k)
        bi_ranked = deduplicate_by_candidate(bi_ranked)
        top_resumes = bi_ranked[:top_n + 10]
        job["progress"] = len(parsed)
        await asyncio.sleep(0)

        if not top_resumes:
            job["status"] = "complete"
            job["phase"] = "Done — no matching resumes found."
            job["results"] = []
            return

        # Phase 2 — AI scoring of top candidates
        phase2_total = len(top_resumes)
        job["phase"] = f"Phase 2: AI scoring top {phase2_total} resumes..."
        job["progress"] = 0
        job["total"] = phase2_total

        def on_phase3_progress(done: int, total: int, filename: str):
            job["progress"] = done
            job["current_file"] = filename
            job["phase"] = f"Phase 2: AI scoring ({done}/{total})"

        results = await gemini_rerank(
            jd_text,
            top_resumes,
            top_n=top_n,
            jd_requirements=jd_requirements,
            on_progress=on_phase3_progress,
        )

        # Drop candidates Gemini couldn't parse (scanned/corrupted PDFs)
        valid = [r for r in results if r.get("name", "N/A").upper() != "N/A"]
        if valid:
            results = valid

        # AND mode: only keep candidates who have none of the primary skills missing
        if skill_match_mode == "AND" and jd_requirements.get("primary_skills"):
            primary_lower = {s.lower() for s in jd_requirements["primary_skills"]}
            and_filtered = [
                r for r in results
                if not (primary_lower & {s.lower() for s in r.get("missing_skills", [])})
            ]
            if and_filtered:
                results = and_filtered

        job["phase"] = "Creating resume ZIP..."
        zip_path = create_filtered_zip(
            resume_folder, [r["filename"] for r in results], jd_filename
        )
        job["zip_path"] = zip_path

        job["phase"] = "Generating Excel report..."
        excel_path = export_to_excel(results, jd_filename)

        job["results"] = results
        job["excel_path"] = excel_path
        job["status"] = "complete"
        job["phase"] = f"Done! Top {len(results)} candidates found."

    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)
        jobs[job_id]["phase"] = "Error occurred."
        import traceback
        traceback.print_exc()
