"""The ONE write path into raw_documents — used by scrapers only.

raw_documents is immutable and append-only (DATA_DICTIONARY cross-cutting rule
1): a NEW row is written only when content_hash changes; older rows keep their
data forever and just lose is_latest. Nothing else in the repo may INSERT/
UPDATE/DELETE this table (CLAUDE.md).
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Optional


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def store_raw_document(
    conn,
    *,
    source_type: str,
    source_url: str,
    term_code: Optional[str] = None,
    raw_text: Optional[str] = None,
    raw_payload: Optional[dict[str, Any]] = None,
) -> tuple[Optional[int], bool]:
    """Insert a raw document if its content is new.

    Returns (raw_document_id, inserted). content_hash is computed over raw_text
    when present, else over the canonical JSON of raw_payload. If a row with
    the same (source_url, content_hash) already exists, nothing is written and
    (existing_id, False) is returned — re-scraping unchanged sources is free.
    When content HAS changed, previous rows for the source_url are demoted to
    is_latest=false (they are never edited otherwise) and the new row inserted.
    """
    if raw_text is None and raw_payload is None:
        raise ValueError("one of raw_text / raw_payload is required")
    canonical = raw_text if raw_text is not None else json.dumps(
        raw_payload, sort_keys=True, separators=(",", ":"))
    content_hash = sha256_text(canonical)

    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, is_latest FROM raw_documents
               WHERE source_url = %s AND content_hash = %s""",
            (source_url, content_hash),
        )
        row = cur.fetchone()
        if row:
            doc_id, is_latest = row
            if not is_latest:
                # Content REVERTED to a previously seen version (A -> B -> A):
                # re-promote the matched snapshot so is_latest tracks what is
                # actually live. Still append-only — no content is edited,
                # only the is_latest flag moves.
                cur.execute(
                    """UPDATE raw_documents SET is_latest = false
                       WHERE source_url = %s AND is_latest""",
                    (source_url,),
                )
                cur.execute(
                    "UPDATE raw_documents SET is_latest = true WHERE id = %s",
                    (doc_id,),
                )
            return doc_id, False

        # content changed (or first fetch): demote older snapshots, append new
        cur.execute(
            """UPDATE raw_documents SET is_latest = false
               WHERE source_url = %s AND is_latest""",
            (source_url,),
        )
        cur.execute(
            """
            INSERT INTO raw_documents
                (source_type, source_url, term_code, fetched_at, content_hash,
                 raw_text, raw_payload, is_latest)
            VALUES (%s, %s, %s, %s, %s, %s, %s, true)
            RETURNING id
            """,
            (source_type, source_url, term_code, datetime.now(timezone.utc),
             content_hash, raw_text,
             json.dumps(raw_payload) if raw_payload is not None else None),
        )
        return cur.fetchone()[0], True
