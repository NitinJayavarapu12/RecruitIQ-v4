import re
from typing import List, Set
from rapidfuzz import fuzz, process

STOP_WORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "this", "that", "these", "those",
    "we", "you", "they", "it", "he", "she", "our", "your", "their",
    "as", "if", "not", "than", "more", "also", "other", "new", "use",
    "work", "experience", "required", "preferred", "ability", "skills",
    "strong", "knowledge", "including", "such", "well", "must", "any",
    "all", "each", "both", "few", "more", "most", "other", "some",
    "such", "into", "through", "during", "before", "after", "above",
    "below", "between", "out", "off", "over", "under", "again", "further",
    "then", "once", "here", "there", "when", "where", "why", "how",
    "what", "which", "who", "whom", "its", "about", "per", "within",
}


def extract_keywords(text: str) -> List[str]:
    text = text.lower()
    words = re.findall(r'\b[a-z][a-z0-9+#./\-]*\b', text)
    return list({w for w in words if w not in STOP_WORDS and len(w) > 2})


def keyword_match(jd_keywords: List[str], resume_text: str) -> float:
    """
    Score a resume against pre-extracted JD keywords.
    Accepts a pre-computed keyword list so extraction isn't repeated per resume.
    """
    if not jd_keywords:
        return 0.0

    resume_lower = resume_text.lower()
    resume_words = list({w for w in re.findall(r'\b[a-z][a-z0-9+#./\-]*\b', resume_lower)})

    matched = 0.0
    for keyword in jd_keywords:
        if keyword in resume_lower:
            matched += 1.0
        else:
            # Filter candidates by length then use rapidfuzz C-level scorer
            candidates = [w for w in resume_words if abs(len(w) - len(keyword)) <= 3]
            if candidates:
                result = process.extractOne(keyword, candidates, scorer=fuzz.ratio, score_cutoff=88)
                if result:
                    matched += 0.7

    score = (matched / len(jd_keywords)) * 100
    return min(round(score, 1), 100.0)