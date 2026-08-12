"""add program_name_squashed generated column

Revision ID: 37b31fde2d07
Revises: 3347575c74d0
Create Date: 2026-08-12 17:00:24.509424

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '37b31fde2d07'
down_revision: Union[str, Sequence[str], None] = '3347575c74d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.add_column(
        "knowledge_entry",
        sa.Column(
            "program_name_squashed",
            sa.Text(),
            sa.Computed(
                "regexp_replace(lower(facts->>'name'), '[^a-z0-9]', '', 'g')",
                persisted=True,
            ),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_ke_program_name_squashed",
        "knowledge_entry",
        ["program_name_squashed"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"program_name_squashed": "gin_trgm_ops"},
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_ke_program_name_squashed", table_name="knowledge_entry")
    op.drop_column("knowledge_entry", "program_name_squashed")
