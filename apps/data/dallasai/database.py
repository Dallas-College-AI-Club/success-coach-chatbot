"""
===============================================================================
Neon PostgreSQL Database Connection & Session Manager
===============================================================================
Author: Antigravity AI / Neftali
Project: Success Coach Chatbot (Issue #91 / Issue #36)

Description:
    Single authoritative module providing database URL resolution, connection
    engine creation, session management, DDL table initialization, and status
    checking for the data ingestion pipeline.

Usage:
    - Initialize tables:
      python3 apps/data/dallasai/database.py --init

    - Check status:
      python3 apps/data/dallasai/database.py --status

    - Import in code:
      from dallasai.database import get_db, get_db_session, init_db, check_db_status
===============================================================================
"""

import argparse
import os
import sys
from collections.abc import Generator
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from dallasai.models import Base

# Auto-inject apps/data directory into sys.path
SYS_DATA_DIR = Path(__file__).resolve().parent.parent
if str(SYS_DATA_DIR) not in sys.path:
    sys.path.insert(0, str(SYS_DATA_DIR))

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


load_dotenv()


def get_database_url() -> str:
    """
    Retrieves PostgreSQL connection string from environment or .env file.

    Precedence:
        1. DATABASE_URL_UNPOOLED (direct Neon connection for heavy Python batch operations)
        2. DATABASE_URL (pooled connection)
        3. NEON_DATABASE_URL
        4. Root .env fallback lookup
        5. Individual PG* environment variables (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)
    """
    db_url = (
        os.getenv("DATABASE_URL_UNPOOLED")
        or os.getenv("DATABASE_URL")
        or os.getenv("NEON_DATABASE_URL")
    )

    if not db_url:
        env_file = SYS_DATA_DIR.parent.parent / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if (
                    line.startswith("DATABASE_URL_UNPOOLED=")
                    or line.startswith("DATABASE_URL=")
                    or line.startswith("NEON_DATABASE_URL=")
                ):
                    db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if db_url:
                        break

    if not db_url:
        pghost = os.getenv("PGHOST", "localhost")
        pgport = os.getenv("PGPORT", "5432")
        pguser = os.getenv("PGUSER", "postgres")
        pgpass = os.getenv("PGPASSWORD", "postgres")
        pgdb = os.getenv("PGDATABASE", "chatbot_test")
        db_url = f"postgresql://{pguser}:{pgpass}@{pghost}:{pgport}/{pgdb}"

    # Force the psycopg (v3) dialect — same rewrite as alembic/env.py; the
    # project ships psycopg v3, not psycopg2 (SQLAlchemy's bare-URL default).
    return db_url.replace("postgresql://", "postgresql+psycopg://", 1)


DATABASE_URL = get_database_url()

engine: Engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """Provide a database session generator for web/API routes and close it afterward."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(database_url: Optional[str] = None) -> None:
    """Initializes pgvector extension and creates all ORM tables in Neon PostgreSQL."""
    url = database_url or get_database_url()
    print("🔌 Connecting to Neon PostgreSQL database...")

    try:
        eng = create_engine(
            url, pool_pre_ping=True, connect_args={"connect_timeout": 5}
        )

        # 1. Enable pgvector extension
        with eng.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
            print("✅ 'pgvector' extension verified/enabled.")

        # 2. Create tables defined in models.py (KnowledgeEntry, ChatSession)
        Base.metadata.create_all(bind=eng)
        print(
            "✅ Database tables ('knowledge_entry', 'chat_session') successfully initialized."
        )
    except Exception as err:
        print(f"⚠️ Note: Database initialization step: {err}")


def check_db_status(database_url: Optional[str] = None) -> None:
    """Queries and displays table record counts and latest ingested entries in Neon PostgreSQL."""
    url = database_url or get_database_url()
    init_db(url)
    print("📊 Querying Neon PostgreSQL database status...\n")

    try:
        eng = create_engine(
            url, pool_pre_ping=True, connect_args={"connect_timeout": 5}
        )
        with eng.connect() as conn:
            # Discover tables in schema
            t_res = conn.execute(
                text(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
                )
            ).fetchall()
            tbl_names = [t[0] for t in t_res]

            print(
                "========================================================================="
            )
            print("🐘 Neon PostgreSQL Database Status")
            print(
                "========================================================================="
            )
            print(
                f"  • Existing Database Tables: {', '.join(tbl_names) if tbl_names else 'None'}"
            )

            if "knowledge_entry" in tbl_names:
                total_count = conn.execute(
                    text("SELECT COUNT(*) FROM knowledge_entry;")
                ).scalar()
                syl_count = conn.execute(
                    text(
                        "SELECT COUNT(*) FROM knowledge_entry WHERE metadata->>'doc_type' = 'syllabus';"
                    )
                ).scalar()
                cat_count = conn.execute(
                    text(
                        "SELECT COUNT(*) FROM knowledge_entry WHERE metadata->>'doc_type' = 'course';"
                    )
                ).scalar()
                recent = conn.execute(
                    text(
                        "SELECT id, source_url, metadata->>'doc_type' AS doc_type, LEFT(chunk_text, 60) AS snippet FROM knowledge_entry ORDER BY id DESC LIMIT 3;"
                    )
                ).fetchall()

                print(f"  • Total Knowledge Entries: {total_count}")
                print(f"  • Syllabi Entries        : {syl_count}")
                print(f"  • Catalog Course Entries : {cat_count}")
                print(
                    "-------------------------------------------------------------------------"
                )
                print("📋 Latest Ingested Entries:")
                if recent:
                    for r in recent:
                        print(
                            f"  [ID: {r.id}] Type: {r.doc_type:<10} File: {r.source_url:<25} Text: '{r.snippet}...'"
                        )
                else:
                    print("  (No records found in database yet)")
            elif "embeddings" in tbl_names:
                emb_count = conn.execute(
                    text("SELECT COUNT(*) FROM embeddings;")
                ).scalar()
                print(f"  • Total Embeddings Vector Count: {emb_count}")

            print(
                "=========================================================================\n"
            )
    except Exception as err:
        print(f"❌ Error connecting to database: {err}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Neon Database Setup & Verification Helper"
    )
    parser.add_argument(
        "--init", action="store_true", help="Initialize DDL schema tables in Neon"
    )
    parser.add_argument(
        "--status",
        "--check",
        action="store_true",
        help="Check database record count and view latest entries",
    )
    args = parser.parse_args()

    if args.init:
        init_db()
    elif args.status:
        check_db_status()
    else:
        print("Usage:")
        print(
            "  python3 apps/data/dallasai/database.py --init    # Initialize database tables"
        )
        print(
            "  python3 apps/data/dallasai/database.py --status  # Check database records & counts"
        )
