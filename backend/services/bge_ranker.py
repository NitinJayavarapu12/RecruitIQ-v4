from rapidfuzz import fuzz
from typing import List, Dict


def _get_model():
    pass  # no-op — kept so main.py import doesn't break


def bi_encode_rank(jd_text: str, resumes: List[Dict], top_k: int = 150) -> List[Dict]:
    """Rank resumes by keyword overlap with JD using rapidfuzz (zero memory overhead)."""
    if not resumes:
        return []

    jd_sample = jd_text[:2000].lower()

    scored = []
    for r in resumes:
        text = (r.get("text") or "")[:2000].lower()
        score = fuzz.token_set_ratio(jd_sample, text) / 100.0
        r2 = dict(r)
        r2["bi_score"] = score
        r2["keyword_score"] = score
        scored.append((r2, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    result = [r for r, _ in scored[:top_k]]
    print(f"[RANK] Keyword-ranked: {len(resumes)} → top {len(result)}")
    return result
