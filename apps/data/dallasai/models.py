from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dallasai.database import Base


class Student(Base):
    """Represents an anonymous student using the chatbot."""

    __tablename__ = "students"

    uuid: Mapped[UUID] = mapped_column(
    PG_UUID(as_uuid=True),
    primary_key=True,
    default=uuid4,
)

    student_info: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    chat_history: Mapped[list["ChatHistory"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
    )

class ChatHistory(Base):
    """Stores conversations between a student and the AI."""

    __tablename__ = "chat_history"

    uuid: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    student_uuid: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("students.uuid"),
        nullable=False,
    )

    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    message: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    student: Mapped["Student"] = relationship(
        back_populates="chat_history",
    )