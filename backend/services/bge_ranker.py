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


_EMBED_BATCH = 50  # embed in batches to cap ONNX runtime memory spike


def bi_encode_rank(jd_text: str, resumes: List[Dict], top_k: int = 150) -> List[Dict]:
    if not resumes:
        return []

    model = _get_model()
    texts = [r["text"][:1500] for r in resumes]

    jd_emb = np.array(list(model.embed([jd_text[:1500]]))[0])
    jd_emb = jd_emb / np.maximum(np.linalg.norm(jd_emb), 1e-9)

    # Score in batches — frees each batch's ONNX buffer before the next
    all_scores: List[float] = []
    for i in range(0, len(texts), _EMBED_BATCH):
        batch = texts[i : i + _EMBED_BATCH]
        batch_embs = np.array(list(model.embed(batch)))
        norms = np.linalg.norm(batch_embs, axis=1, keepdims=True)
        batch_embs = batch_embs / np.maximum(norms, 1e-9)
        all_scores.extend((batch_embs @ jd_emb).tolist())
        del batch_embs

    ranked = sorted(zip(resumes, all_scores), key=lambda x: x[1], reverse=True)

    result = []
    for resume, score in ranked[:top_k]:
        r = dict(resume)
        r["bi_score"] = score
        r["keyword_score"] = score
        result.append(r)

    print(f"[BGE] Ranked: {len(resumes)} → top {len(result)}")
    return result
