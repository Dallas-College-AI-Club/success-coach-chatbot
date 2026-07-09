"""THE Python connection module (ADR-008's one-file adapter).

Every Python script — pipeline, tests, the future chatbot — obtains database
connections from here. No other file may create a connection. That keeps the
Neon/vanilla-Postgres exit a config change: pg_dump -> pg_restore -> repoint.

Settings come from the environment (a git-ignored .env is loaded if present —
see .env.example):

    DATABASE_URL   full connection string (Neon dashboard -> Connect)
    — or the standard libpq variables (PGHOST, PGPORT, PGUSER, PGPASSWORD,
      PGDATABASE), which psycopg honors natively when DATABASE_URL is unset.
    DB_POOL_MIN    pool floor (default 1)
    DB_POOL_MAX    pool ceiling (default 5)

Usage:
    from db.client import get_connection, get_pool, close_pool

    with get_connection() as conn:          # context-managed: returned to pool
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM sections")

The pool is opened lazily on first use and closed automatically at process
exit (atexit + SIGINT/SIGTERM safe).
"""

from __future__ import annotations

import atexit
import os
import signal
import sys
import threading
from contextlib import contextmanager
from typing import Iterator, Optional

from dotenv import load_dotenv
from psycopg import Connection
from psycopg_pool import ConnectionPool

load_dotenv()  # git-ignored .env at the repo root, if present

_pool: Optional[ConnectionPool] = None
_pool_lock = threading.Lock()


def _conninfo() -> str:
    """DATABASE_URL when set; otherwise '' so libpq falls back to PG* vars."""
    url = os.environ.get("DATABASE_URL", "").strip()
    if url:
        return url
    if not (os.environ.get("PGHOST") or os.environ.get("PGDATABASE")):
        raise RuntimeError(
            "No database settings found: set DATABASE_URL or the PG* variables "
            "in your environment/.env (see .env.example)."
        )
    return ""


def get_pool() -> ConnectionPool:
    """The process-wide pool, created lazily and registered for clean close."""
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = ConnectionPool(
                    conninfo=_conninfo(),
                    min_size=int(os.environ.get("DB_POOL_MIN", "1")),
                    max_size=int(os.environ.get("DB_POOL_MAX", "5")),
                    open=True,
                )
    return _pool


@contextmanager
def get_connection() -> Iterator[Connection]:
    """Context-managed connection checked out of (and returned to) the pool."""
    with get_pool().connection() as conn:
        yield conn


def close_pool() -> None:
    """Close the pool; safe to call more than once."""
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


# --- shutdown hygiene: close cleanly on normal exit and on SIGINT/SIGTERM ----

atexit.register(close_pool)


def _signal_close(signum, frame):  # pragma: no cover - signal path
    close_pool()
    signal.default_int_handler(signum, frame) if signum == signal.SIGINT else sys.exit(128 + signum)


for _sig in (signal.SIGINT, signal.SIGTERM):
    try:
        signal.signal(_sig, _signal_close)
    except (ValueError, OSError):
        # not the main thread (e.g. pytest workers) — atexit still covers us
        pass
