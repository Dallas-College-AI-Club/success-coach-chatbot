"""Initial database schema.

Revision ID: 3347575c74d0
Revises:
Create Date: 2026-07-20 15:32:58.234208
"""

from typing import Sequence, Union

import pgvector.sqlalchemy
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


# Revision identifiers used by Alembic.
revision: str = "3347575c74d0"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _get_quoted_database_name() -> str:
    """Return the current database name safely quoted."""

    connection = op.get_bind()

    database_name = connection.execute(
        sa.text("SELECT current_database()")
    ).scalar_one()

    return connection.dialect.identifier_preparer.quote(database_name)


def upgrade() -> None:
    """Create the initial database schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "chat_session",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "student_id",
            sa.UUID(),
            nullable=True,
        ),
        sa.Column(
            "profile",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "history",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "message_count",
            sa.Integer(),
            sa.Computed(
                "jsonb_array_length(history)",
                persisted=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "archived_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.CheckConstraint(
            (
                "profile IS NULL OR "
                "profile - 'campus' - 'major' - "
                "'student_type' = '{}'::jsonb"
            ),
            name="ck_cs_profile_allowlist",
        ),
        sa.CheckConstraint(
            "jsonb_array_length(history) <= 200",
            name="ck_cs_history_cap",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_cs_archive",
        "chat_session",
        ["updated_at"],
        unique=False,
        postgresql_where=sa.text("archived_at IS NULL"),
    )

    op.create_index(
        "ix_cs_student",
        "chat_session",
        ["student_id"],
        unique=False,
    )

    op.create_table(
        "knowledge_entry",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=True),
            nullable=False,
        ),
        sa.Column(
            "source_url",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "chunk_index",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "content_hash",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "scraped_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "chunk_text",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "facts",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "embedding",
            pgvector.sqlalchemy.halfvec.HALFVEC(dim=768),
            nullable=False,
        ),
        sa.Column(
            "doc_type",
            sa.Text(),
            sa.Computed(
                "metadata->>'doc_type'",
                persisted=True,
            ),
            nullable=True,
        ),
        sa.Column(
            "module",
            sa.Text(),
            sa.Computed(
                "metadata->>'module'",
                persisted=True,
            ),
            nullable=True,
        ),
        sa.Column(
            "course_code",
            sa.Text(),
            sa.Computed(
                (
                    "upper(trim(regexp_replace("
                    "regexp_replace("
                    "metadata->>'course_code', "
                    "'([A-Za-z])([0-9])', "
                    "'\\1 \\2'"
                    "), "
                    "'[^A-Za-z0-9]+', "
                    "' ', "
                    "'g'"
                    ")))"
                ),
                persisted=True,
            ),
            nullable=True,
        ),
        sa.Column(
            "program_code",
            sa.Text(),
            sa.Computed(
                "upper(metadata->>'program_code')",
                persisted=True,
            ),
            nullable=True,
        ),
        sa.Column(
            "year",
            sa.Integer(),
            sa.Computed(
                "((metadata->>'year'))::integer",
                persisted=True,
            ),
            nullable=True,
        ),
        sa.Column(
            "semester",
            sa.Text(),
            sa.Computed(
                "lower(metadata->>'semester')",
                persisted=True,
            ),
            nullable=True,
        ),
        sa.Column(
            "term_ord",
            sa.SmallInteger(),
            sa.Computed(
                (
                    "(((metadata->>'year'))::integer * 10 + "
                    "CASE lower(metadata->>'semester') "
                    "WHEN 'spring' THEN 1 "
                    "WHEN 'may' THEN 2 "
                    "WHEN 'summer' THEN 3 "
                    "WHEN 'fall' THEN 4 "
                    "WHEN 'winter' THEN 5 "
                    "END)::smallint"
                ),
                persisted=True,
            ),
            nullable=True,
        ),
        sa.Column(
            "catalog_year",
            sa.Text(),
            sa.Computed(
                "metadata->>'catalog_year'",
                persisted=True,
            ),
            nullable=True,
        ),
        sa.Column(
            "event_starts_at",
            postgresql.TIMESTAMP(timezone=True),
            sa.Computed(
                (
                    "to_timestamp("
                    "(metadata->>'event_start_epoch')::bigint"
                    ")"
                ),
                persisted=True,
            ),
            nullable=True,
        ),
        sa.Column(
            "professor",
            sa.Text(),
            sa.Computed(
                "metadata->>'professor'",
                persisted=True,
            ),
            nullable=True,
        ),
        sa.Column(
            "instructor_slug",
            sa.Text(),
            sa.Computed(
                "metadata->>'instructor_slug'",
                persisted=True,
            ),
            nullable=True,
        ),
        sa.Column(
            "chunk_tsv",
            postgresql.TSVECTOR(),
            sa.Computed(
                "to_tsvector('english', chunk_text)",
                persisted=True,
            ),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            (
                "(metadata->>'year') IS NULL OR "
                "(metadata->>'year')::integer "
                "BETWEEN 2020 AND 2035"
            ),
            name="ck_ke_year",
        ),
        sa.CheckConstraint(
            "metadata->>'doc_type' IS NOT NULL",
            name="ck_ke_doc_type",
        ),
        sa.CheckConstraint(
            (
                "(metadata->>'semester') IS NULL OR "
                "lower(metadata->>'semester') IN "
                "('fall','spring','summer','winter','may')"
            ),
            name="ck_ke_semester",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_url",
            "chunk_index",
            name="uq_knowledge_entry_source_chunk",
        ),
    )

    op.create_index(
        "ix_ke_course",
        "knowledge_entry",
        [
            "course_code",
            "doc_type",
            "catalog_year",
        ],
        unique=False,
    )

    op.create_index(
        "ix_ke_doc_mod",
        "knowledge_entry",
        [
            "doc_type",
            "module",
        ],
        unique=False,
    )

    op.create_index(
        "ix_ke_embedding",
        "knowledge_entry",
        ["embedding"],
        unique=False,
        postgresql_using="hnsw",
        postgresql_ops={
            "embedding": "halfvec_cosine_ops",
        },
        postgresql_with={
            "m": 16,
            "ef_construction": 64,
        },
    )

    op.create_index(
        "ix_ke_event_start",
        "knowledge_entry",
        ["event_starts_at"],
        unique=False,
        postgresql_where=sa.text("doc_type = 'event'"),
    )

    op.create_index(
        "ix_ke_instructor",
        "knowledge_entry",
        ["instructor_slug"],
        unique=False,
    )

    op.create_index(
        "ix_ke_metadata",
        "knowledge_entry",
        ["metadata"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={
            "metadata": "jsonb_path_ops",
        },
    )

    op.create_index(
        "ix_ke_program",
        "knowledge_entry",
        [
            "program_code",
            "doc_type",
            "catalog_year",
        ],
        unique=False,
    )

    op.create_index(
        "ix_ke_term",
        "knowledge_entry",
        [
            "year",
            "semester",
        ],
        unique=False,
    )

    op.create_index(
        "ix_ke_tsv",
        "knowledge_entry",
        ["chunk_tsv"],
        unique=False,
        postgresql_using="gin",
    )


def downgrade() -> None:
    """Remove the initial database schema."""

    op.drop_index(
        "ix_ke_tsv",
        table_name="knowledge_entry",
        postgresql_using="gin",
    )

    op.drop_index(
        "ix_ke_term",
        table_name="knowledge_entry",
    )

    op.drop_index(
        "ix_ke_program",
        table_name="knowledge_entry",
    )

    op.drop_index(
        "ix_ke_metadata",
        table_name="knowledge_entry",
        postgresql_using="gin",
        postgresql_ops={
            "metadata": "jsonb_path_ops",
        },
    )

    op.drop_index(
        "ix_ke_instructor",
        table_name="knowledge_entry",
    )

    op.drop_index(
        "ix_ke_event_start",
        table_name="knowledge_entry",
        postgresql_where=sa.text("doc_type = 'event'"),
    )

    op.drop_index(
        "ix_ke_embedding",
        table_name="knowledge_entry",
        postgresql_using="hnsw",
        postgresql_ops={
            "embedding": "halfvec_cosine_ops",
        },
        postgresql_with={
            "m": 16,
            "ef_construction": 64,
        },
    )

    op.drop_index(
        "ix_ke_doc_mod",
        table_name="knowledge_entry",
    )

    op.drop_index(
        "ix_ke_course",
        table_name="knowledge_entry",
    )

    op.drop_table("knowledge_entry")

    op.drop_index(
        "ix_cs_student",
        table_name="chat_session",
    )

    op.drop_index(
        "ix_cs_archive",
        table_name="chat_session",
        postgresql_where=sa.text("archived_at IS NULL"),
    )

    op.drop_table("chat_session")
