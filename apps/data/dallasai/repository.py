import json
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import case, delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from dallasai.models import ChatSession, KnowledgeEntry


class UserRepository:
    """Export chat sessions grouped by student ID."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def export_sessions_to_json(
        self,
        output_path: str | Path,
    ) -> int:
        """Export all chat sessions to JSON for post-processing."""

        statement = select(ChatSession).order_by(
            ChatSession.student_id,
            ChatSession.created_at,
        )

        sessions = self.session.scalars(statement).all()

        grouped_sessions: dict[str, list[dict[str, Any]]] = {}

        for chat_session in sessions:
            student_key = (
                str(chat_session.student_id)
                if chat_session.student_id is not None
                else "anonymous"
            )

            grouped_sessions.setdefault(student_key, []).append(
                {
                    "id": str(chat_session.id),
                    "student_id": (
                        str(chat_session.student_id)
                        if chat_session.student_id is not None
                        else None
                    ),
                    "profile": chat_session.profile,
                    "history": chat_session.history,
                    "message_count": chat_session.message_count,
                    "created_at": chat_session.created_at.isoformat(),
                    "updated_at": chat_session.updated_at.isoformat(),
                    "archived_at": (
                        chat_session.archived_at.isoformat()
                        if chat_session.archived_at is not None
                        else None
                    ),
                }
            )

        destination = Path(output_path)
        destination.parent.mkdir(parents=True, exist_ok=True)

        destination.write_text(
            json.dumps(
                grouped_sessions,
                indent=2,
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        return len(sessions)


@dataclass(slots=True)
class DocumentChunk:
    """One ordered chunk produced by the knowledge pipeline."""

    text: str
    embedding: list[float]
    content_hash: str
    facts: dict[str, Any] | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class Document:
    """A source document and its ordered knowledge chunks."""

    source_url: str
    chunks: Sequence[DocumentChunk]
    catalog_year: str | None = None


class KnowledgeRepository:
    """Persist knowledge documents using upsert and reconcile semantics."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def add_or_update(self, document: Document) -> int:
        """Upsert every chunk and remove stale chunks in one transaction."""

        run_started_at = datetime.now(timezone.utc)

        rows = [
            {
                "source_url": document.source_url,
                "chunk_index": chunk_index,
                "content_hash": chunk.content_hash,
                "scraped_at": run_started_at,
                "chunk_text": chunk.text,
                "facts": chunk.facts,
                "metadata_": chunk.metadata,
                "embedding": chunk.embedding,
            }
            for chunk_index, chunk in enumerate(document.chunks)
        ]

        try:
            if rows:
                statement = insert(KnowledgeEntry).values(rows)
                excluded = statement.excluded

                content_changed = (
                    KnowledgeEntry.content_hash.is_distinct_from(
                        excluded.content_hash
                    )
                )

                statement = statement.on_conflict_do_update(
                    index_elements=[
                        KnowledgeEntry.source_url,
                        KnowledgeEntry.chunk_index,
                    ],
                    set_={
                        "scraped_at": excluded.scraped_at,
                        "chunk_text": case(
                            (content_changed, excluded.chunk_text),
                            else_=KnowledgeEntry.chunk_text,
                        ),
                        "facts": case(
                            (content_changed, excluded.facts),
                            else_=KnowledgeEntry.facts,
                        ),
                        "metadata": case(
                            (content_changed, excluded["metadata"]),
                            else_=KnowledgeEntry.metadata_,
                        ),
                        "embedding": case(
                            (content_changed, excluded.embedding),
                            else_=KnowledgeEntry.embedding,
                        ),
                        "content_hash": case(
                            (content_changed, excluded.content_hash),
                            else_=KnowledgeEntry.content_hash,
                        ),
                        "updated_at": case(
                            (content_changed, func.now()),
                            else_=KnowledgeEntry.updated_at,
                        ),
                    },
                )

                self.session.execute(statement)

            reconcile = delete(KnowledgeEntry).where(
                or_(
                    KnowledgeEntry.source_url == document.source_url,
                    func.starts_with(
                        KnowledgeEntry.source_url,
                        f"{document.source_url}#",
                    ),
                ),
                KnowledgeEntry.scraped_at < run_started_at,
            )

            if document.catalog_year is not None:
                reconcile = reconcile.where(
                    or_(
                        KnowledgeEntry.catalog_year.is_(None),
                        KnowledgeEntry.catalog_year
                        == document.catalog_year,
                    )
                )

            self.session.execute(reconcile)
            self.session.commit()

            return len(rows)

        except Exception:
            self.session.rollback()
            raise

    def delete_by_id(self, entry_id: int) -> bool:
        """Delete one knowledge entry by primary key."""

        try:
            result = self.session.execute(
                delete(KnowledgeEntry).where(
                    KnowledgeEntry.id == entry_id
                )
            )

            self.session.commit()

            return bool(result.rowcount)

        except Exception:
            self.session.rollback()
            raise