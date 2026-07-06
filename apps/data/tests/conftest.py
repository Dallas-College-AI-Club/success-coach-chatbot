"""Test fixture: rebuild the database from the committed SQL files, then seed.

Proves the rebuild-from-scratch property (DATA_DICTIONARY cross-cutting rule 2)
on every test run: DROP SCHEMA public -> schema.sql -> views.sql -> seeds.

Safety: refuses to run unless the target database name ends with '_test' or
ALLOW_TEST_DB_RESET=true — this fixture DROPS the public schema.

Connection settings come from the environment via db/client.py (DATABASE_URL
or PG* variables; see .env.example).
"""

from __future__ import annotations

import os
from pathlib import Path

import psycopg
import pytest

REPO = Path(__file__).resolve().parent.parent
SQL_FILES = [
    REPO / "db" / "schema.sql",
    REPO / "db" / "views.sql",
    REPO / "db" / "seed_field_visibility.sql",
    REPO / "db" / "seed_directory.sql",   # composability: directory seed + mock seed coexist
    REPO / "db" / "seed_mock.sql",
]


def _connect() -> psycopg.Connection:
    from db.client import _conninfo  # the one-file adapter's settings logic

    conn = psycopg.connect(_conninfo(), autocommit=True)
    dbname = conn.info.dbname
    if not dbname.endswith("_test") and os.environ.get("ALLOW_TEST_DB_RESET") != "true":
        conn.close()
        pytest.exit(
            f"Refusing to reset database {dbname!r}: tests DROP the public schema. "
            "Point PG*/DATABASE_URL at a *_test database or set ALLOW_TEST_DB_RESET=true.",
            returncode=2,
        )
    return conn


@pytest.fixture(scope="session")
def db():
    """Session-scoped autocommit connection to a freshly rebuilt, seeded DB."""
    conn = _connect()
    with conn.cursor() as cur:
        cur.execute("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
    for sql_file in SQL_FILES:
        try:
            conn.execute(sql_file.read_text(encoding="utf-8"))
        except Exception as e:
            pytest.exit(f"applying {sql_file.name} failed: {e}", returncode=2)
    yield conn
    conn.close()


@pytest.fixture()
def q(db):
    """Query helper: q(sql, params) -> list of tuples."""
    def run(sql: str, params=None):
        with db.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()
    return run
