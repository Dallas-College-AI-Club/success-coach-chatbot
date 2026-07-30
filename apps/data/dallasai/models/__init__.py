from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""

    pass


# isort: off
from .chat_session import ChatSession  # noqa: E402
from .knowledge_entry import KnowledgeEntry  # noqa: E402

# isort: on

__all__ = ["Base", "KnowledgeEntry", "ChatSession"]
