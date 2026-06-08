import json
import os
import time
from typing import Dict

from dotenv import load_dotenv
load_dotenv(override=True)

from google import genai
from google.genai import types

_client_genai = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

JD_ANALYSIS_PROMPT = """\
You are an expert technical recruiter. Analyze the following Job Description and extract key requirements.

Return ONLY a valid JSON object with exactly these keys:

{{
  "required_title": "job title being hired for (e.g. Teamcenter Developer)",
  "required_years": "minimum years of experience as a number string (e.g. '5')",
  "required_education": "minimum degree qualification required (e.g. 'B.E/B.Tech Engineering'). Degree name only.",
  "required_domain": "industry domain (e.g. 'Automotive PLM', 'Healthcare IT')",
  "primary_skills": ["list of 5-10 mandatory technical skills — be specific"],
  "secondary_skills": ["list of 3-7 nice-to-have skills"],
  "jd_summary": "one sentence summary of the role"
}}

Rules:
- required_years: number only e.g. "5" not "5+ years". Use lower bound if range.
- primary_skills: specific tool/technology names (e.g. "Teamcenter", "BMIDE", "ITK") not generic terms.
- Return ONLY the JSON object. No explanation, no markdown, no extra text.

Job Description:
{jd_text}
"""

REFINE_PROMPT = """\
You are an expert technical recruiter. Re-analyze this Job Description with feedback: "{feedback}"
Focus on more specific, granular technical skills.

Return ONLY a valid JSON object:
{{
  "required_title": "job title",
  "required_years": "minimum years as number string",
  "required_education": "minimum degree qualification. Degree name only.",
  "required_domain": "industry domain",
  "primary_skills": ["mandatory technical skills — be very specific"],
  "secondary_skills": ["nice-to-have skills"],
  "jd_summary": "one sentence summary"
}}

Return ONLY the JSON object. No explanation, no markdown, no extra text.

Job Description:
{jd_text}
"""


def analyze_jd(jd_text: str, feedback: str = "") -> Dict:
    if feedback:
        prompt = REFINE_PROMPT.format(jd_text=jd_text[:6000], feedback=feedback)
    else:
        prompt = JD_ANALYSIS_PROMPT.format(jd_text=jd_text[:6000])

    try:
        last_err = None
        for attempt in range(4):
            try:
                response = _client_genai.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0,
                        max_output_tokens=800,
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
                    ),
                )
                break
            except Exception as e:
                last_err = e
                err_str = str(e)
                if "RESOURCE_EXHAUSTED" in err_str and "quota" in err_str.lower():
                    raise  # daily quota — retrying won't help
                if "503" in err_str or "429" in err_str:
                    wait = 5 * (2 ** attempt)
                    print(f"  [JD_ANALYZER] Gemini {e.__class__.__name__} (attempt {attempt+1}), retrying in {wait}s...")
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

        return {
            "required_title":     str(data.get("required_title", "N/A") or "N/A"),
            "required_years":     str(data.get("required_years", "0") or "0"),
            "required_education": str(data.get("required_education", "N/A") or "N/A"),
            "required_domain":    str(data.get("required_domain", "N/A") or "N/A"),
            "primary_skills":     list(data.get("primary_skills", []) or []),
            "secondary_skills":   list(data.get("secondary_skills", []) or []),
            "jd_summary":         str(data.get("jd_summary", "N/A") or "N/A"),
        }

    except Exception as e:
        print(f"  [JD_ANALYZER] Failed: {e}")
        return {
            "required_title": "N/A", "required_years": "0",
            "required_education": "N/A", "required_domain": "N/A",
            "primary_skills": [], "secondary_skills": [], "jd_summary": "N/A",
        }
