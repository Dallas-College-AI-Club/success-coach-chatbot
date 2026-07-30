from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    Computed,
    Index,
    Integer,
    text,
)
from sqlalchemy.dialects.postgresql import (
    JSONB,
    TIMESTAMP,
)
from sqlalchemy.dialects.postgresql import (
    UUID as PG_UUID,
)
from sqlalchemy.orm import Mapped, mapped_column

from . import Base


class ChatSession(Base):
    __tablename__ = "chat_session"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
    )

    student_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
    )

    profile: Mapped[dict | None] = mapped_column(JSONB)

    history: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
    )

    message_count: Mapped[int] = mapped_column(
        Integer,
        Computed(
            "jsonb_array_length(history)",
            persisted=True,
        ),
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    archived_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
    )

    __table_args__ = (
        CheckConstraint(
            "profile IS NULL OR "
            "profile - 'campus' - 'major' - 'student_type' = '{}'::jsonb",
            name="ck_cs_profile_allowlist",
        ),
        CheckConstraint(
            "jsonb_array_length(history) <= 200",
            name="ck_cs_history_cap",
        ),
        Index(
            "ix_cs_student",
            "student_id",
        ),
        Index(
            "ix_cs_archive",
            "updated_at",
            postgresql_where=text("archived_at IS NULL"),
        ),
    )
