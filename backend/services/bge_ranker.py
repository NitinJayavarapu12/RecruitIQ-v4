import numpy as np
from typing import List, Dict
from sentence_transformers import SentenceTransformer, CrossEncoder

_bi_encoder: SentenceTransformer = None
_cross_encoder: CrossEncoder = None

BI_MODEL = "BAAI/bge-small-en-v1.5"
CE_MODEL = "BAAI/bge-reranker-base"


def _get_bi_encoder() -> SentenceTransformer:
    global _bi_encoder
    if _bi_encoder is None:
        print(f"[BGE] Loading bi-encoder: {BI_MODEL}")
        _bi_encoder = SentenceTransformer(BI_MODEL)
        print("[BGE] Bi-encoder ready.")
    return _bi_encoder


def _get_cross_encoder() -> CrossEncoder:
    global _cross_encoder
    if _cross_encoder is None:
        print(f"[BGE] Loading cross-encoder: {CE_MODEL}")
        _cross_encoder = CrossEncoder(CE_MODEL)
        print("[BGE] Cross-encoder ready.")
    return _cross_encoder


def bi_encode_rank(jd_text: str, resumes: List[Dict], top_k: int = 150) -> List[Dict]:
    """Rank resumes by cosine similarity to JD using BGE bi-encoder."""
    if not resumes:
        return []

    model = _get_bi_encoder()

    jd_emb = model.encode(jd_text[:2000], normalize_embeddings=True)
    texts = [r["text"][:2000] for r in resumes]
    resume_embs = model.encode(
        texts, normalize_embeddings=True, batch_size=32, show_progress_bar=False
    )

    scores = (resume_embs @ jd_emb).tolist()

    ranked = sorted(zip(resumes, scores), key=lambda x: x[1], reverse=True)

    result = []
    for resume, score in ranked[:top_k]:
        r = dict(resume)
        r["bi_score"] = score
        r["keyword_score"] = score  # gemini_reranker reads keyword_score — keep field name
        result.append(r)

    print(f"[BGE] Bi-encoder: {len(resumes)} → top {len(result)}")
    return result


def cross_encode_rerank(jd_text: str, resumes: List[Dict], top_k: int = 30) -> List[Dict]:
    """Rerank candidates using BGE cross-encoder (slower, more precise)."""
    if not resumes:
        return []

    model = _get_cross_encoder()

    pairs = [[jd_text[:1000], r["text"][:2000]] for r in resumes]
    scores = model.predict(pairs, batch_size=16, show_progress_bar=False).tolist()

    ranked = sorted(zip(resumes, scores), key=lambda x: x[1], reverse=True)

    result = []
    for resume, score in ranked[:top_k]:
        r = dict(resume)
        r["rerank_score"] = score
        result.append(r)

    print(f"[BGE] Cross-encoder: {len(resumes)} → top {len(result)}")
    return result
