import hashlib
import time
from typing import Dict, List

import numpy as np

from services.keyword_matcher import extract_keywords, keyword_match

MODEL_NAME = "BAAI/bge-small-en-v1.5"
QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "
SEMANTIC_WEIGHT = 0.6
KEYWORD_WEIGHT = 0.4

_model = None
_embed_cache: Dict[str, np.ndarray] = {}


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        print(f"[RANK] Loading embedding model {MODEL_NAME} (first use)...")
        t0 = time.time()
        _model = SentenceTransformer(MODEL_NAME)
        print(f"[RANK] Model loaded in {time.time() - t0:.1f}s")
    return _model


def _resume_embeddings(resumes: List[Dict]) -> List[np.ndarray]:
    model = _get_model()
    keys = [hashlib.md5((r.get("text") or "").encode("utf-8")).hexdigest() for r in resumes]

    missing = [i for i, k in enumerate(keys) if k not in _embed_cache]
    if missing:
        texts = [resumes[i].get("text") or " " for i in missing]
        t0 = time.time()
        embeddings = model.encode(texts, normalize_embeddings=True, batch_size=32, show_progress_bar=False)
        print(f"[RANK] Embedded {len(texts)} new resumes in {time.time() - t0:.1f}s")
        for idx, emb in zip(missing, embeddings):
            _embed_cache[keys[idx]] = emb

    return [_embed_cache[k] for k in keys]


def bi_encode_rank(jd_text: str, resumes: List[Dict], top_k: int = 150) -> List[Dict]:
    """Rank every resume by a hybrid of JD-resume semantic similarity (BGE embeddings)
    and JD keyword coverage, so candidates aren't penalised just for phrasing
    things differently than the JD."""
    if not resumes:
        return []

    model = _get_model()
    jd_keywords = extract_keywords(jd_text)
    jd_embedding = model.encode(QUERY_INSTRUCTION + jd_text, normalize_embeddings=True)

    resume_embeddings = _resume_embeddings(resumes)

    scored = []
    for r, resume_emb in zip(resumes, resume_embeddings):
        text = r.get("text") or ""
        keyword_score = keyword_match(jd_keywords, text) / 100.0
        semantic_score = float(np.clip(np.dot(jd_embedding, resume_emb), 0.0, 1.0))
        hybrid_score = SEMANTIC_WEIGHT * semantic_score + KEYWORD_WEIGHT * keyword_score

        r2 = dict(r)
        r2["bi_score"] = hybrid_score
        r2["semantic_score"] = round(semantic_score, 4)
        r2["keyword_score"] = round(keyword_score, 4)
        scored.append((r2, hybrid_score))

    scored.sort(key=lambda x: x[1], reverse=True)
    result = [r for r, _ in scored[:top_k]]
    print(f"[RANK] Hybrid-ranked (semantic+keyword): {len(resumes)} → top {len(result)}")
    return result
