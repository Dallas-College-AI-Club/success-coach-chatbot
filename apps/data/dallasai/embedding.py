"""
===============================================================================
Vector Embedding Model Service (all-MiniLM-L6-v2)
===============================================================================
Author: Antigravity AI / Neftali
Project: Success Coach Chatbot

Description:
    Generates 384-dimensional normalized dense vector embeddings matching the
    frontend model pipeline using SentenceTransformer.

    Strict Dependency Policy:
    Does NOT use dummy fallbacks or zero vectors. If sentence-transformers is
    missing or fails to load, explicitly raises an exception instructing the
    developer to run 'uv sync' in apps/data.
===============================================================================
"""

from functools import cache
import numpy as np

try:
    from sentence_transformers import SentenceTransformer
except ImportError as err:
    raise ImportError(
        "sentence-transformers is required for vector embeddings, but it is not installed. "
        "Please run 'uv sync' in the 'apps/data' directory to install required dependencies."
    ) from err


@cache
def get_model() -> SentenceTransformer:
    """Load and cache the sentence-transformers all-MiniLM-L6-v2 embedding model."""
    try:
        return SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    except Exception as err:
        raise RuntimeError(
            f"Failed to load sentence-transformers model. Make sure dependencies are synced via 'uv sync'. Details: {err}"
        ) from err


def embed(data: str) -> np.ndarray:
    """Generate 384-dimensional normalized vector embedding for input text."""
    model = get_model()
    return model.encode(data, normalize_embeddings=True)  # type:ignore
