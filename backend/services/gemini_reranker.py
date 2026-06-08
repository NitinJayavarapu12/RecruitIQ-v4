import re
import json
import hashlib
import asyncio
import os
import time
import warnings
from typing import List, Dict, Tuple, Optional

from dotenv import load_dotenv
load_dotenv(override=True)

from google import genai
from google.genai import types

warnings.filterwarnings("ignore")

# ── Gemini client ─────────────────────────────────────────────────────────────
_client_genai = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

# ── In-memory parse cache (persists for server lifetime) ──────────────────────
_parse_cache: Dict[str, str] = {}

# ── PyMuPDF + pdfplumber text extraction ─────────────────────────────────────

def parse_resume_text(file_path: str) -> Optional[str]:
    filename = os.path.basename(file_path)

    try:
        with open(file_path, "rb") as f:
            file_hash = hashlib.md5(f.read(8192)).hexdigest()
    except Exception:
        file_hash = None

    if file_hash and file_hash in _parse_cache:
        print(f"  [CACHE] {filename}")
        return _parse_cache[file_hash]

    text = ""

    # Try PyMuPDF first (better layout handling)
    try:
        import fitz
        doc = fitz.open(file_path)
        for page in doc:
            text += page.get_text() + "\n"
        doc.close()
    except Exception:
        pass

    # Fall back to pdfplumber
    if not text.strip():
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
        except Exception:
            pass

    if text.strip():
        if file_hash:
            if len(_parse_cache) > 500:
                _parse_cache.clear()
            _parse_cache[file_hash] = text.strip()
        print(f"  [PARSED] {filename}")
        return text.strip()

    return None


# ── Stop words ────────────────────────────────────────────────────────────────

STOP = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "is", "are", "was", "be", "have", "has", "do",
    "will", "can", "this", "that", "we", "you", "they", "it", "as", "if",
    "not", "more", "also", "work", "experience", "required", "preferred",
    "strong", "knowledge", "use", "using", "ability", "skills", "good",
    "must", "any", "all", "both", "into", "through", "than", "then",
    "our", "your", "their", "should", "would", "could", "may", "might",
    "team", "skill", "develop", "other", "members", "organization",
    "description", "methodologies", "time", "company", "project", "process",
    "system", "manage", "support", "provide", "ensure", "include", "various",
    "different", "new", "well", "high", "key", "large", "within", "between",
    "following", "related", "based", "used", "per", "etc", "responsible",
    "working", "including", "multiple", "communication", "analytical",
    "management", "software", "years", "client", "developer", "pvt", "ltd",
    "india", "across", "enhance", "facilitate", "module", "quality", "cost",
    "lead", "deep", "benefits", "fast", "growing", "teams", "manager",
    "administration", "eclipse", "programming", "sql", "linux", "windows",
    "manufacturing", "tools", "tool", "job", "like", "while", "about",
    "stakeholders", "education", "collaborating", "skilled", "executed",
    "problem-solving", "lifecycle", "technologies", "deployment", "language",
    "model", "expertise", "shell", "core", "architecture", "medical",
    "migration", "access", "apply", "database", "oracle", "workflow",
}


# ── Comprehensive Gemini prompt ───────────────────────────────────────────────

COMPREHENSIVE_PROMPT = """\
You are an expert technical recruiter evaluating a candidate resume against a job description.

JD REQUIREMENTS:
- Role: {required_title}
- Min Experience: {required_years} years
- Education: {required_education}
- Domain: {required_domain}
- Primary Skills Required: {primary_skills}
- Secondary Skills Preferred: {secondary_skills}

RESUME TEXT:
{resume_text}

Extract ALL fields and score the candidate. Return ONLY a valid JSON object with exactly these keys:

{{
  "name": "candidate full name",
  "email": "email address or N/A",
  "phone": "phone number or N/A",
  "linkedin": "LinkedIn URL or N/A",
  "years_of_experience": "total years as number string e.g. '6'",
  "current_company": "most recent employer",
  "education": "degree + branch e.g. 'B.E Mechanical Engineering'",
  "education_meets_jd": true,
  "matched_skills": ["skills from JD primary+secondary that candidate has — recognize ALL variations e.g. .NET/dotnet/ASP.NET are the same"],
  "missing_skills": ["JD primary skills the candidate is clearly missing"],
  "candidate_summary": "one line: X years [role] at [company], strengths, gaps",
  "technical_skills_score": 75,
  "technical_skills_reason": "brief reason",
  "experience_score": 70,
  "experience_reason": "brief reason",
  "domain_score": 80,
  "domain_reason": "brief reason",
  "role_score": 65,
  "role_reason": "brief reason",
  "education_score": 85,
  "education_reason": "brief reason",
  "career_score": 70,
  "career_reason": "brief reason"
}}

Scoring rules (0-100 each):
- technical_skills_score: depth and breadth of required technical skills
- experience_score: years of relevant experience vs JD requirement
- domain_score: industry domain match
- role_score: responsibilities match what JD needs day-to-day
- education_score: degree relevance + certifications
- career_score: job stability, progression, tenure quality

IMPORTANT for matched_skills:
- Recognize all common variations of skill names semantically
- .NET = dotnet = ASP.NET = .NET Core = .NET Framework
- ML = Machine Learning = AI/ML
- JS = JavaScript = ES6
- TC = Teamcenter, AWC = Active Workspace Client
- Return the canonical skill name from the JD's primary_skills list

Return ONLY the JSON object. No explanation, no markdown, no extra text.
"""


def extract_and_score_with_gemini(text: str, jd_requirements: dict) -> dict:
    primary_str = ", ".join(jd_requirements.get("primary_skills", []))
    secondary_str = ", ".join(jd_requirements.get("secondary_skills", []))

    prompt = COMPREHENSIVE_PROMPT.format(
        required_title=jd_requirements.get("required_title", "N/A"),
        required_years=jd_requirements.get("required_years", "0"),
        required_education=jd_requirements.get("required_education", "N/A"),
        required_domain=jd_requirements.get("required_domain", "N/A"),
        primary_skills=primary_str or "N/A",
        secondary_skills=secondary_str or "N/A",
        resume_text=text,
    )

    defaults = {
        "name": "N/A", "email": "N/A", "phone": "N/A", "linkedin": "N/A",
        "years_of_experience": "0", "current_company": "N/A",
        "education": "N/A", "education_meets_jd": False,
        "matched_skills": [], "missing_skills": [],
        "candidate_summary": "N/A",
        "technical_skills_score": 0, "technical_skills_reason": "N/A",
        "experience_score": 0, "experience_reason": "N/A",
        "domain_score": 0, "domain_reason": "N/A",
        "role_score": 0, "role_reason": "N/A",
        "education_score": 0, "education_reason": "N/A",
        "career_score": 0, "career_reason": "N/A",
    }

    try:
        last_err = None
        for attempt in range(4):
            try:
                response = _client_genai.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0,
                        max_output_tokens=1200,
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
                    ),
                )
                break
            except Exception as e:
                last_err = e
                if "503" in str(e) or "429" in str(e):
                    wait = 5 * (2 ** attempt)
                    print(f"  [GEMINI] {e.__class__.__name__} (attempt {attempt+1}), retrying in {wait}s...")
                    time.sleep(wait)
                else:
                    raise
        else:
            raise last_err
        raw = response.text.strip()

        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])

        data = json.loads(raw)

        def safe_str(key):
            v = data.get(key, defaults[key])
            return str(v) if v is not None else "N/A"

        def safe_int(key):
            try:
                return max(0, min(100, int(data.get(key, 0) or 0)))
            except (ValueError, TypeError):
                return 0

        def safe_list(key):
            v = data.get(key, [])
            return list(v) if isinstance(v, list) else []

        return {
            "name":                    safe_str("name") or "N/A",
            "email":                   safe_str("email") or "N/A",
            "phone":                   safe_str("phone") or "N/A",
            "linkedin":                safe_str("linkedin") or "N/A",
            "years_of_experience":     safe_str("years_of_experience") or "0",
            "current_company":         safe_str("current_company") or "N/A",
            "education":               safe_str("education") or "N/A",
            "education_meets_jd":      bool(data.get("education_meets_jd", False)),
            "matched_skills":          safe_list("matched_skills"),
            "missing_skills":          safe_list("missing_skills"),
            "candidate_summary":       safe_str("candidate_summary") or "N/A",
            "technical_skills_score":  safe_int("technical_skills_score"),
            "technical_skills_reason": safe_str("technical_skills_reason") or "N/A",
            "experience_score":        safe_int("experience_score"),
            "experience_reason":       safe_str("experience_reason") or "N/A",
            "domain_score":            safe_int("domain_score"),
            "domain_reason":           safe_str("domain_reason") or "N/A",
            "role_score":              safe_int("role_score"),
            "role_reason":             safe_str("role_reason") or "N/A",
            "education_score":         safe_int("education_score"),
            "education_reason":        safe_str("education_reason") or "N/A",
            "career_score":            safe_int("career_score"),
            "career_reason":           safe_str("career_reason") or "N/A",
        }

    except Exception as e:
        print(f"  [GEMINI] Extraction failed: {e}")
        return defaults


def compute_final_score(fields: dict) -> float:
    return (
        fields["technical_skills_score"] * 0.30 +
        fields["experience_score"]        * 0.25 +
        fields["domain_score"]            * 0.20 +
        fields["role_score"]              * 0.10 +
        fields["education_score"]         * 0.10 +
        fields["career_score"]            * 0.05
    )


def get_tier(final_score: float) -> str:
    if final_score >= 90:
        return "🌟 Excellent Match"
    elif final_score >= 75:
        return "✅ Strong Match"
    elif final_score >= 60:
        return "⚠️ Good Match"
    elif final_score >= 45:
        return "🔶 Partial Match"
    else:
        return "❌ Weak Match"


def get_experience_flag(years_str: str, required_years_str: str) -> str:
    try:
        years = int(float(years_str or "0"))
        required = int(float(required_years_str or "0"))
    except (ValueError, TypeError):
        return "⚠️"
    if years >= required:
        return "✅"
    elif years >= required - 1:
        return "⚠️"
    else:
        return "❌"


def process_single_resume(resume: Dict, jd_text: str, jd_requirements: dict) -> Dict:
    filename = resume.get("filename", "")
    file_path = resume.get("path", "")
    fallback_text = resume.get("text", "")
    keyword_score = resume.get("keyword_score", 0)

    parsed_text = parse_resume_text(file_path)
    text = parsed_text if parsed_text else fallback_text

    fields = extract_and_score_with_gemini(text, jd_requirements)
    final_score = round(compute_final_score(fields), 1)
    tier = get_tier(final_score)
    experience_flag = get_experience_flag(
        fields["years_of_experience"],
        jd_requirements.get("required_years", "0")
    )

    print(f"  [GEMINI] {fields['name']} | score={final_score} | tier={tier}")

    return {
        "filename":                filename,
        "name":                    fields["name"],
        "phone":                   fields["phone"],
        "email":                   fields["email"],
        "linkedin":                fields["linkedin"],
        "years_of_experience":     fields["years_of_experience"],
        "experience_flag":         experience_flag,
        "current_company":         fields["current_company"],
        "latest_employment":       fields["current_company"],
        "education":               fields["education"],
        "education_meets_jd":      fields["education_meets_jd"],
        "matched_skills":          fields["matched_skills"],
        "missing_skills":          fields["missing_skills"],
        "candidate_summary":       fields["candidate_summary"],
        "technical_skills_score":  fields["technical_skills_score"],
        "technical_skills_reason": fields["technical_skills_reason"],
        "experience_score":        fields["experience_score"],
        "experience_reason":       fields["experience_reason"],
        "domain_score":            fields["domain_score"],
        "domain_reason":           fields["domain_reason"],
        "role_score":              fields["role_score"],
        "role_reason":             fields["role_reason"],
        "education_score":         fields["education_score"],
        "education_reason":        fields["education_reason"],
        "career_score":            fields["career_score"],
        "career_reason":           fields["career_reason"],
        "final_score":             final_score,
        "score":                   final_score,
        "tier":                    tier,
        "keyword_score":           keyword_score,
    }


def deduplicate_results(results: List[Dict], top_n: int = 50) -> List[Dict]:
    results.sort(key=lambda x: x.get("final_score", 0), reverse=True)
    seen_emails, seen_names, unique = set(), set(), []
    for result in results:
        email = (result.get("email") or "").strip().lower()
        name  = (result.get("name") or "").strip().lower()
        email_key = email if email and email != "n/a" else None
        name_key  = name  if name  and name  != "n/a" else None
        if email_key and email_key in seen_emails:
            continue
        if name_key and name_key in seen_names:
            continue
        if email_key:
            seen_emails.add(email_key)
        if name_key:
            seen_names.add(name_key)
        unique.append(result)
    print(f"[DEDUP] {len(results)} → {len(unique)} unique candidates")
    return unique[:top_n]


CONCURRENCY_LIMIT = 5


async def gemini_rerank(
    jd_text: str,
    resumes: List[Dict],
    top_n: int = 50,
    jd_requirements: dict = None,
    on_progress=None,
) -> List[Dict]:
    if jd_requirements is None:
        jd_requirements = {}

    loop = asyncio.get_event_loop()
    total = len(resumes)
    semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)
    done_count = 0

    print(f"[GEMINI] Processing {total} resumes (concurrency={CONCURRENCY_LIMIT})...")

    async def process_with_semaphore(resume: Dict):
        nonlocal done_count
        async with semaphore:
            result = await loop.run_in_executor(
                None, process_single_resume, resume, jd_text, jd_requirements
            )
            done_count += 1
            if on_progress:
                on_progress(done_count, total, resume["filename"])
            return result

    tasks = [process_with_semaphore(r) for r in resumes]
    all_results = await asyncio.gather(*tasks)
    return deduplicate_results(list(all_results), top_n=top_n)
