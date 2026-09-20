"""Database connection, non-destructive setup and read-only corpus inspection.

Run as ``python -m dallasai.database --help`` from apps/data.
"""

import argparse
import os
from collections.abc import Generator
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from dallasai.models import Base

SYS_DATA_DIR = Path(__file__).resolve().parent.parent

load_dotenv()


def get_database_url() -> str:
    """
    Retrieves PostgreSQL connection string from environment or .env file.

    Precedence:
        1. DATABASE_URL_UNPOOLED (direct Neon connection for batch operations)
        2. DATABASE_URL (pooled connection)
        3. NEON_DATABASE_URL
        4. Root .env fallback lookup
        5. Individual PG* environment variables
           (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)

    Enforces psycopg v3 ('postgresql+psycopg://') dialect exclusively.
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

    # Force the psycopg (v3) dialect strictly — no fallback to psycopg2.
    if db_url.startswith("postgresql://"):
        return db_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return db_url


DATABASE_URL = get_database_url()

try:
    engine: Engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
    )
except ModuleNotFoundError as err:
    if "psycopg" in str(err):
        raise ModuleNotFoundError(
            "psycopg (v3) is required for PostgreSQL connections, "
            "but it is not installed. Please run 'uv sync' in the "
            "'apps/data' directory to install required dependencies."
        ) from err
    raise err


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """Provide a database session for routes and close it afterward."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def schema_sql() -> str:
    """Render the fresh-database baseline without connecting to any database."""
    from sqlalchemy.dialects.postgresql import dialect
    from sqlalchemy.schema import CreateIndex, CreateTable

    statements = [
        "-- Generated from dallasai.models; regenerate with "
        "python -m dallasai.database --schema",
        "-- Fresh databases only. Existing databases need a reviewed migration; "
        "this never drops tables.",
        "BEGIN;",
        "CREATE EXTENSION IF NOT EXISTS vector;",
        "CREATE EXTENSION IF NOT EXISTS pg_trgm;",
    ]
    for table in Base.metadata.sorted_tables:
        statements.append(
            str(
                CreateTable(table, if_not_exists=True).compile(dialect=dialect())
            ).strip()
            + ";"
        )
        for index in sorted(table.indexes, key=lambda x: x.name):
            statements.append(
                str(
                    CreateIndex(index, if_not_exists=True).compile(dialect=dialect())
                ).strip()
                + ";"
            )
    return (
        "\n".join(
            line.rstrip() for line in "\n\n".join(statements + ["COMMIT;"]).splitlines()
        )
        + "\n"
    )


def init_db(database_url: Optional[str] = None) -> None:
    """Non-destructive fresh-database setup; never an implicit migration."""
    eng = create_engine(
        database_url or get_database_url(),
        pool_pre_ping=True,
        connect_args={"connect_timeout": 5},
    )
    try:
        with eng.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
            Base.metadata.create_all(bind=conn)
        print("Schema initialized. Existing tables were preserved.")
    except Exception:
        raise RuntimeError(
            "Schema initialization failed; transaction rolled back"
        ) from None
    finally:
        eng.dispose()


def check_db_status(database_url: Optional[str] = None) -> None:
    """Read-only status: no extension creation, table creation, or migration."""
    eng = create_engine(
        database_url or get_database_url(),
        pool_pre_ping=True,
        connect_args={"connect_timeout": 5},
    )
    try:
        with eng.connect() as conn:
            conn.execute(text("SET TRANSACTION READ ONLY"))
            tables = (
                conn.execute(
                    text(
                        "SELECT table_name FROM information_schema.tables "
                        "WHERE table_schema='public' ORDER BY table_name"
                    )
                )
                .scalars()
                .all()
            )
            print("Tables: " + ", ".join(tables))
            if "knowledge_entry" in tables:
                for kind, count in conn.execute(
                    text(
                        "SELECT doc_type, count(*) FROM knowledge_entry "
                        "GROUP BY doc_type ORDER BY doc_type"
                    )
                ):
                    print(f"{kind}: {count}")
    except Exception:
        raise RuntimeError(
            "Database status failed; no database changes were attempted"
        ) from None
    finally:
        eng.dispose()


def export_snapshot(path, database_url: Optional[str] = None) -> None:
    """Export public corpus facts and schedule coverage in a read-only transaction."""
    import json

    target = Path(path)
    if target.exists():
        raise ValueError(
            "Choose a new snapshot path; existing evidence is never overwritten"
        )
    eng = create_engine(
        database_url or get_database_url(),
        pool_pre_ping=True,
        connect_args={"connect_timeout": 5},
    )
    try:
        with eng.connect() as conn:
            conn.execute(text("SET TRANSACTION READ ONLY"))
            docs = [
                dict(row)
                for row in conn.execute(
                    text("""
                SELECT id, doc_type, course_code, program_code, instructor_slug,
                       source_url, chunk_index, chunk_text, facts, metadata,
                       content_hash, scraped_at
                FROM knowledge_entry
                WHERE doc_type IN ('course','program_map','cv','catalog','resource')
                ORDER BY doc_type,id
            """)
                ).mappings()
            ]
            schedules = [
                dict(row)
                for row in conn.execute(
                    text("""
                SELECT course_code, year, semester, count(*) AS sections,
                       min(scraped_at) AS oldest_source,
                       max(scraped_at) AS newest_source
                FROM knowledge_entry WHERE doc_type='section'
                GROUP BY course_code,year,semester ORDER BY year,semester,course_code
            """)
                ).mappings()
            ]
        with target.open("x", encoding="utf-8") as output:
            json.dump(
                {"docs": docs, "schedules": schedules},
                output,
                ensure_ascii=False,
                default=lambda value: value.isoformat(),
            )
        print(
            f"Exported {len(docs)} public records and {len(schedules)} "
            "schedule groups; database unchanged."
        )
    except Exception:
        raise RuntimeError(
            "Snapshot export failed; no database changes were attempted"
        ) from None
    finally:
        eng.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Non-destructive database setup and read-only status"
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--init",
        action="store_true",
        help="Create missing tables; never drops or migrates existing tables",
    )
    mode.add_argument(
        "--status", "--check", action="store_true", help="Read-only table counts"
    )
    mode.add_argument(
        "--schema",
        action="store_true",
        help="Print fresh-database SQL without connecting",
    )
    mode.add_argument(
        "--export-snapshot",
        metavar="NEW_PATH",
        help="Export public corpus facts read-only for local reconciliation",
    )
    args = parser.parse_args()
    if args.schema:
        print(schema_sql(), end="")
    elif args.export_snapshot:
        export_snapshot(args.export_snapshot)
    elif args.init:
        init_db()
    else:
        check_db_status()
