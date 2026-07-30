import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from dallasai.models import ChatSession


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
