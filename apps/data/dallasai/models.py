from datetime import datetime
from uuid import UUID

from pgvector.sqlalchemy import HALFVEC
from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Computed,
    Identity,
    Index,
    Integer,
    SmallInteger,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import (
    JSONB,
    TIMESTAMP,
    TSVECTOR,
    UUID as PG_UUID,
)
from sqlalchemy.orm import Mapped, mapped_column

from dallasai.database import Base


class KnowledgeEntry(Base):
    __tablename__ = "knowledge_entry"

    id: Mapped[int] = mapped_column(
        BigInteger,
        Identity(always=True),
        primary_key=True,
    )

    source_url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    chunk_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0"),
    )

    content_hash: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    scraped_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    chunk_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    facts: Mapped[dict | None] = mapped_column(JSONB)

    metadata_: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )

    embedding: Mapped[list[float]] = mapped_column(
        HALFVEC(768),
        nullable=False,
    )

    doc_type: Mapped[str | None] = mapped_column(
        Text,
        Computed("metadata->>'doc_type'", persisted=True),
    )

    module: Mapped[str | None] = mapped_column(
        Text,
        Computed("metadata->>'module'", persisted=True),
    )

    course_code: Mapped[str | None] = mapped_column(
        Text,
        Computed(
            "upper(trim(regexp_replace("
            "regexp_replace(metadata->>'course_code', "
            "'([A-Za-z])([0-9])', '\\1 \\2'), "
            "'[^A-Za-z0-9]+', ' ', 'g')))",
            persisted=True,
        ),
    )

    program_code: Mapped[str | None] = mapped_column(
        Text,
        Computed("upper(metadata->>'program_code')", persisted=True),
    )

    year: Mapped[int | None] = mapped_column(
        Integer,
        Computed("((metadata->>'year'))::integer", persisted=True),
    )

    semester: Mapped[str | None] = mapped_column(
        Text,
        Computed("lower(metadata->>'semester')", persisted=True),
    )

    term_ord: Mapped[int | None] = mapped_column(
        SmallInteger,
        Computed(
            "(((metadata->>'year'))::integer * 10 + "
            "CASE lower(metadata->>'semester') "
            "WHEN 'spring' THEN 1 "
            "WHEN 'may' THEN 2 "
            "WHEN 'summer' THEN 3 "
            "WHEN 'fall' THEN 4 "
            "WHEN 'winter' THEN 5 "
            "END)::smallint",
            persisted=True,
        ),
    )

    catalog_year: Mapped[str | None] = mapped_column(
        Text,
        Computed("metadata->>'catalog_year'", persisted=True),
    )

    event_starts_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        Computed(
            "to_timestamp((metadata->>'event_start_epoch')::bigint)",
            persisted=True,
        ),
    )

    professor: Mapped[str | None] = mapped_column(
        Text,
        Computed("metadata->>'professor'", persisted=True),
    )

    instructor_slug: Mapped[str | None] = mapped_column(
        Text,
        Computed("metadata->>'instructor_slug'", persisted=True),
    )

    chunk_tsv = mapped_column(
        TSVECTOR,
        Computed(
            "to_tsvector('english', chunk_text)",
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

    __table_args__ = (
        UniqueConstraint(
            "source_url",
            "chunk_index",
            name="uq_knowledge_entry_source_chunk",
        ),
        CheckConstraint(
            "metadata->>'doc_type' IS NOT NULL",
            name="ck_ke_doc_type",
        ),
        CheckConstraint(
            "metadata->>'semester' IS NULL OR "
            "lower(metadata->>'semester') IN "
            "('fall','spring','summer','winter','may')",
            name="ck_ke_semester",
        ),
        CheckConstraint(
            "(metadata->>'year') IS NULL OR "
            "(metadata->>'year')::integer BETWEEN 2020 AND 2035",
            name="ck_ke_year",
        ),
        Index(
            "ix_ke_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "halfvec_cosine_ops"},
            postgresql_with={"m": 16, "ef_construction": 64},
        ),
        Index(
            "ix_ke_tsv",
            "chunk_tsv",
            postgresql_using="gin",
        ),
        Index(
            "ix_ke_metadata",
            "metadata",
            postgresql_using="gin",
            postgresql_ops={"metadata": "jsonb_path_ops"},
        ),
        Index(
            "ix_ke_course",
            "course_code",
            "doc_type",
            "catalog_year",
        ),
        Index(
            "ix_ke_program",
            "program_code",
            "doc_type",
            "catalog_year",
        ),
        Index(
            "ix_ke_doc_mod",
            "doc_type",
            "module",
        ),
        Index(
            "ix_ke_term",
            "year",
            "semester",
        ),
        Index(
            "ix_ke_instructor",
            "instructor_slug",
        ),
        Index(
            "ix_ke_event_start",
            "event_starts_at",
            postgresql_where=text("doc_type = 'event'"),
        ),
    )


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