"""
===============================================================================
Neon PostgreSQL Database Initializer & Session Manager
===============================================================================
Author: Antigravity AI / Neftali
Project: Success Coach Chatbot (Issue #91 / Issue #36)

Description:
    Provides session management and DDL setup for connecting the local data
    ingestion pipeline directly to Neon PostgreSQL + pgvector.

Usage:
    - Initialize tables:
      python3 apps/data/dallasai/db_setup.py --init

    - Import in code:
      from dallasai.db_setup import get_db_session
      session = get_db_session()
===============================================================================
"""

import argparse
import os
import sys
from pathlib import Path
from typing import Optional

# Auto-inject apps/data directory into sys.path
SYS_DATA_DIR = Path(__file__).resolve().parent.parent
if str(SYS_DATA_DIR) not in sys.path:
    sys.path.insert(0, str(SYS_DATA_DIR))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from dallasai.base import Base
from dallasai.models import ChatSession, KnowledgeEntry


def get_database_url() -> str:
    """Retrieves PostgreSQL connection string from environment or .env file."""
    db_url = os.getenv("DATABASE_URL") or os.getenv("NEON_DATABASE_URL")
    if not db_url:
        env_file = SYS_DATA_DIR.parent.parent / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("DATABASE_URL=") or line.startswith("NEON_DATABASE_URL="):
                    db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    if not db_url:
        # Fallback to local default / template URL for Neon
        db_url = "postgresql://neftali:neonpassword@ep-cool-db.us-east-2.aws.neon.tech/neondb?sslmode=require"
    return db_url


def init_db(database_url: Optional[str] = None) -> None:
    """Initializes pgvector extension and creates all ORM tables in Neon PostgreSQL."""
    url = database_url or get_database_url()
    print(f"🔌 Connecting to Neon PostgreSQL database...")

    try:
        engine = create_engine(url, echo=False)
        
        # 1. Enable pgvector extension
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
            print("✅ 'pgvector' extension verified/enabled.")

        # 2. Create tables defined in models.py (KnowledgeEntry, ChatSession)
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables ('knowledge_entry', 'chat_session') successfully initialized.")
    except Exception as err:
        print(f"⚠️ Note: Database initialization step: {err}")


def get_db_session(database_url: Optional[str] = None) -> Session:
    """Creates and returns a new SQLAlchemy Session bound to the Neon database."""
    url = database_url or get_database_url()
    engine = create_engine(url, echo=False)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    return SessionLocal()


def check_db_status(database_url: Optional[str] = None) -> None:
    """Queries and displays table record counts and latest ingested entries in Neon PostgreSQL."""
    url = database_url or get_database_url()
    init_db(url)
    print(f"📊 Querying Neon PostgreSQL database status...\n")

    try:
        engine = create_engine(url, echo=False)
        with engine.connect() as conn:
            # Discover tables in schema
            t_res = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")).fetchall()
            tbl_names = [t[0] for t in t_res]

            print(f"=========================================================================")
            print(f"🐘 Neon PostgreSQL Database Status")
            print(f"=========================================================================")
            print(f"  • Existing Database Tables: {', '.join(tbl_names) if tbl_names else 'None'}")

            if "knowledge_entry" in tbl_names:
                total_count = conn.execute(text("SELECT COUNT(*) FROM knowledge_entry;")).scalar()
                syl_count = conn.execute(text("SELECT COUNT(*) FROM knowledge_entry WHERE metadata->>'doc_type' = 'syllabus';")).scalar()
                cat_count = conn.execute(text("SELECT COUNT(*) FROM knowledge_entry WHERE metadata->>'doc_type' = 'course';")).scalar()
                recent = conn.execute(text("SELECT id, source_url, metadata->>'doc_type' AS doc_type, LEFT(chunk_text, 60) AS snippet FROM knowledge_entry ORDER BY id DESC LIMIT 3;")).fetchall()

                print(f"  • Total Knowledge Entries: {total_count}")
                print(f"  • Syllabi Entries        : {syl_count}")
                print(f"  • Catalog Course Entries : {cat_count}")
                print(f"-------------------------------------------------------------------------")
                print(f"📋 Latest Ingested Entries:")
                if recent:
                    for r in recent:
                        print(f"  [ID: {r.id}] Type: {r.doc_type:<10} File: {r.source_url:<25} Text: '{r.snippet}...'")
                else:
                    print("  (No records found in database yet)")
            elif "embeddings" in tbl_names:
                emb_count = conn.execute(text("SELECT COUNT(*) FROM embeddings;")).scalar()
                print(f"  • Total Embeddings Vector Count: {emb_count}")

            print(f"=========================================================================\n")
    except Exception as err:
        print(f"❌ Error connecting to database: {err}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Neon Database Setup & Verification Helper")
    parser.add_argument("--init", action="store_true", help="Initialize DDL schema tables in Neon")
    parser.add_argument("--status", "--check", action="store_true", help="Check database record count and view latest entries")
    args = parser.parse_args()

    if args.init:
        init_db()
    elif args.status:
        check_db_status()
    else:
        print("Usage:")
        print("  python3 apps/data/dallasai/db_setup.py --init    # Initialize database tables")
        print("  python3 apps/data/dallasai/db_setup.py --status  # Check database records & counts")
