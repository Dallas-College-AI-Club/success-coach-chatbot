from functools import cache
import numpy as np

@cache
def get_model():
    try:
        from sentence_transformers import SentenceTransformer
        return ("st", SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2"))
    except Exception:
        pass

    try:
        from chromadb.utils import embedding_functions
        return ("chroma", embedding_functions.DefaultEmbeddingFunction())
    except Exception:
        pass

    return ("fallback", None)


def embed(data: str) -> np.ndarray:
    kind, model = get_model()
    if kind == "st" and model is not None:
        return model.encode(data, normalize_embeddings=True)
    if kind == "chroma" and model is not None:
        res = model([data])
        vec = np.array(res[0], dtype=np.float32)
        norm = np.linalg.norm(vec)
        return vec / norm if norm > 0 else vec

    # Deterministic 384-dim unit-norm vector generator fallback for offline local dev
    import hashlib
    h = hashlib.sha256(data.encode("utf-8")).digest()
    vals = [float((b / 255.0) * 2.0 - 1.0) for b in (h * 12)[:384]]
    vec = np.array(vals, dtype=np.float32)
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec

