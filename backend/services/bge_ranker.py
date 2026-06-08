import numpy as np
from typing import List, Dict
from fastembed import TextEmbedding

_model: TextEmbedding = None
MODEL_NAME = "BAAI/bge-small-en-v1.5"


def _get_model() -> TextEmbedding:
    global _model
    if _model is None:
        print(f"[BGE] Loading fastembed model: {MODEL_NAME}")
        _model = TextEmbedding(MODEL_NAME)
        print("[BGE] Model ready.")
    return _model


def bi_encode_rank(jd_text: str, resumes: List[Dict], top_k: int = 150) -> List[Dict]:
    """Rank resumes by cosine similarity to JD using BGE bi-encoder (ONNX, no PyTorch)."""
    if not resumes:
        return []

    model = _get_model()
    texts = [r["text"][:2000] for r in resumes]

    jd_emb = np.array(list(model.embed([jd_text[:2000]]))[0])
    resume_embs = np.array(list(model.embed(texts)))

    # Normalize to unit vectors for cosine similarity via dot product
    jd_emb = jd_emb / np.maximum(np.linalg.norm(jd_emb), 1e-9)
    norms = np.linalg.norm(resume_embs, axis=1, keepdims=True)
    resume_embs = resume_embs / np.maximum(norms, 1e-9)

    scores = (resume_embs @ jd_emb).tolist()

    ranked = sorted(zip(resumes, scores), key=lambda x: x[1], reverse=True)

    result = []
    for resume, score in ranked[:top_k]:
        r = dict(resume)
        r["bi_score"] = score
        r["keyword_score"] = score  # gemini_reranker reads keyword_score — keep field name
        result.append(r)

    print(f"[BGE] Ranked: {len(resumes)} → top {len(result)}")
    return result
