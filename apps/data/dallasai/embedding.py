from functools import cache

import numpy as np
from sentence_transformers import SentenceTransformer


@cache
def get_model() -> SentenceTransformer:
    return SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


def embed(data: str) -> np.ndarray:
    model = get_model()
    return model.encode(data, normalize_embeddings=True).numpy()
