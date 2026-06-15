import hashlib
import re
from typing import Dict, List, Optional, Tuple

TIER_ORDER = ["entry", "mid", "high", "manager"]

TIER_LABELS = {
    "entry": "Entry level (0-3 yrs)",
    "mid": "Mid level (4-7 yrs)",
    "high": "High level (8-11 yrs)",
    "manager": "Manager level (12+ yrs)",
}

# Required-years values that sit at/near a tier ceiling (3, 7, 11). For these,
# tier-bucket matching would admit candidates up to 2-3 years under-qualified
# (e.g. "7+" maps to "mid" = 4-7yrs). Instead these are filtered by a numeric
# window [N, N+2] — see _filter_by_years_window.
NEAR_CEILING_VALUES = {2, 3, 6, 7, 10, 11}

# Looks for explicit "X years of experience" style statements. Anything not
# caught here falls back to the "mid" tier rather than being excluded.
_EXPERIENCE_PATTERNS = [
    re.compile(r'(\d{1,2}(?:\.\d{1,2})?)\s*\+?\s*(?:years?|yrs?)\.?\s+(?:of\s+)?(?:total\s+|overall\s+|relevant\s+)?experience', re.IGNORECASE),
    re.compile(r'(?:total\s+|overall\s+)?(?:work\s+)?exp(?:erience)?\.?\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*\+?\s*(?:years?|yrs?)', re.IGNORECASE),
    re.compile(r'(?:having|with|over)\s+(\d{1,2}(?:\.\d{1,2})?)\s*\+?\s*(?:years?|yrs?)', re.IGNORECASE),
]

_experience_cache: Dict[str, Optional[float]] = {}

_NUMBER_RE = re.compile(r'(\d+(?:\.\d+)?)')


def parse_years(value) -> Optional[float]:
    """Extract the first number from a years-of-experience string.

    LLM-extracted fields are sometimes "7+", "5-8 years", etc. even when the
    prompt asks for a plain number, which makes a bare float(value) raise.
    This pulls out the first numeric token (lower bound for ranges/"+").
    """
    if value is None:
        return None
    match = _NUMBER_RE.search(str(value))
    return float(match.group(1)) if match else None


def extract_years_of_experience(text: str) -> Optional[float]:
    """Best-effort extraction of total years of experience from resume text."""
    if not text:
        return None
    found = []
    for pattern in _EXPERIENCE_PATTERNS:
        for m in pattern.finditer(text):
            try:
                val = float(m.group(1))
            except ValueError:
                continue
            if 0 < val <= 50:
                found.append(val)
    return max(found) if found else None


def years_to_tier(years: Optional[float]) -> str:
    if years is None:
        return "mid"
    if years <= 3:
        return "entry"
    if years <= 7:
        return "mid"
    if years <= 11:
        return "high"
    return "manager"


def required_years_to_tier(required_years: str) -> str:
    years = parse_years(required_years)
    return years_to_tier(years if years is not None else 0.0)


def _resume_years(resumes: List[Dict]) -> List[Optional[float]]:
    keys = [hashlib.md5((r.get("text") or "").encode("utf-8")).hexdigest() for r in resumes]
    for i, k in enumerate(keys):
        if k not in _experience_cache:
            _experience_cache[k] = extract_years_of_experience(resumes[i].get("text") or "")
    return [_experience_cache[k] for k in keys]


def _resume_tiers(resumes: List[Dict]) -> List[str]:
    return [years_to_tier(y) for y in _resume_years(resumes)]


def filter_by_experience_tier(resumes: List[Dict], required_years: str, min_pool_size: int) -> Tuple[List[Dict], str, int]:
    """Keep only candidates matching the JD's required experience level.

    For "near-ceiling" requirements (NEAR_CEILING_VALUES — the top two years
    of the entry/mid/high tiers), admit candidates with years in [N, N+2]
    instead of tier-bucket matching, so every admitted candidate meets the
    requirement (see _filter_by_years_window).

    Otherwise, keep only candidates whose experience tier matches the JD's
    required tier, widening to neighbouring tiers (closest first) if the
    exact-tier pool is smaller than min_pool_size.
    """
    required_tier = required_years_to_tier(required_years)
    if not resumes:
        return resumes, required_tier, 0

    req_years = parse_years(required_years)
    if req_years is not None and req_years in NEAR_CEILING_VALUES:
        return _filter_by_years_window(resumes, required_tier, int(req_years), min_pool_size)

    required_idx = TIER_ORDER.index(required_tier)
    tiers = _resume_tiers(resumes)

    for distance in range(len(TIER_ORDER)):
        allowed = {TIER_ORDER[i] for i in range(len(TIER_ORDER)) if abs(i - required_idx) <= distance}
        filtered = [r for r, t in zip(resumes, tiers) if t in allowed]
        if len(filtered) >= min_pool_size or len(allowed) == len(TIER_ORDER):
            print(f"[EXP-FILTER] Required tier: {required_tier} ({TIER_LABELS[required_tier]}) "
                  f"| widened ±{distance} -> tiers {sorted(allowed)} "
                  f"| pool: {len(filtered)}/{len(resumes)}")
            return filtered, required_tier, distance

    return resumes, required_tier, len(TIER_ORDER)


def _filter_by_years_window(resumes: List[Dict], required_tier: str, n: int, min_pool_size: int) -> Tuple[List[Dict], str, int]:
    """Admit candidates with years in [n, n+2], widening symmetrically
    ([n-1, n+3], [n-2, n+4], ...) until the pool is large enough or the
    window covers [0, 50]. Candidates with unparseable resumes (years=None)
    always pass, matching the tier-based path's "let it through" default.
    """
    years = _resume_years(resumes)

    for widen in range(0, 51):
        lo, hi = max(0, n - widen), n + 2 + widen
        filtered = [r for r, y in zip(resumes, years) if y is None or lo <= y <= hi]
        if len(filtered) >= min_pool_size or (lo <= 0 and hi >= 50):
            print(f"[EXP-FILTER] Required years: {n}+ (near-ceiling) "
                  f"| window [{lo}, {hi}] (widened ±{widen}) "
                  f"| pool: {len(filtered)}/{len(resumes)}")
            return filtered, required_tier, widen

    return resumes, required_tier, 51
