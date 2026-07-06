"""Model-agnostic LLM extraction (SCHEMA_HANDOVER §3, ADR-002).

One extract(text, doc_type) function behind a provider setting:

    EXTRACTOR=anthropic:claude-sonnet-4-6   # subscription/API today
    EXTRACTOR=ollama:qwen2.5-14b            # free local model later

The contract: one JSON Schema + one versioned prompt + a provider setting.
Output is validated with Pydantic (pipeline/models.py); on validation failure
we retry up to MAX_RETRIES times with the validator errors appended to the
prompt; when retries are exhausted the row is stored with
status='needs_review' (validation_errors kept). A transport/provider error
stores status='failed'. Every row records extractor, extraction_method,
prompt_version, schema_version.

DB access goes through db/client.py (the one-file adapter) and is imported
lazily so this module is usable without a database (e.g. unit tests of the
validation loop).

CLI:
    python -m pipeline.extract --all-pending      # extract raw docs lacking a current extraction
    python -m pipeline.extract --raw-id 42        # re-extract one raw document
"""

from __future__ import annotations

import argparse
import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from pydantic import ValidationError

from pipeline.models import DOC_MODELS

PROMPT_VERSION = "v1"
PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / f"extract_{PROMPT_VERSION}.md"
SCHEMAS_DIR = Path(__file__).resolve().parent.parent / "schemas"

MAX_RETRIES = 2  # initial attempt + 2 retries with validator errors appended

# raw_documents.source_type -> extraction doc type
SOURCE_TYPE_TO_DOC_TYPE = {
    "syllabus_html": "syllabus",
    "syllabus_pdf": "syllabus",
    "catalog_page": "degree_plan",
    # schedule_csv rows are structured raw_payload — loaded directly, no LLM
}


@dataclass
class ExtractionResult:
    status: str                      # ok | failed | needs_review
    data: Optional[dict] = None
    validation_errors: Optional[list] = None
    extractor: str = ""
    extraction_method: str = ""
    prompt_version: str = PROMPT_VERSION
    schema_version: str = ""
    attempts: int = 0
    raw_responses: list = field(default_factory=list)  # for debugging; not stored


# ---------------------------------------------------------------------------
# Provider plumbing
# ---------------------------------------------------------------------------

def parse_extractor_setting(setting: Optional[str] = None) -> tuple[str, str]:
    """EXTRACTOR='provider:model' -> (provider, model)."""
    setting = setting or os.environ.get("EXTRACTOR", "")
    if ":" not in setting:
        raise SystemExit(
            "EXTRACTOR is not set (expected 'anthropic:<model>' or 'ollama:<model>'; see .env.example)"
        )
    provider, model = setting.split(":", 1)
    provider = provider.strip().lower()
    if provider not in ("anthropic", "ollama"):
        raise SystemExit(f"Unknown EXTRACTOR provider {provider!r} (anthropic | ollama)")
    return provider, model.strip()


def _call_anthropic(model: str, prompt: str) -> str:
    import anthropic  # lazy: only needed when provider=anthropic

    client = anthropic.Anthropic()  # ANTHROPIC_API_KEY from env
    msg = client.messages.create(
        model=model,
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}],
    )
    return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")


def _call_ollama(model: str, prompt: str) -> str:
    import requests  # lazy

    base = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    resp = requests.post(
        f"{base}/api/chat",
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "format": "json",   # decode-time JSON enforcement
            "stream": False,
            "options": {"temperature": 0},
        },
        timeout=600,
    )
    resp.raise_for_status()
    return resp.json()["message"]["content"]


def call_model(provider: str, model: str, prompt: str) -> str:
    if provider == "anthropic":
        return _call_anthropic(model, prompt)
    return _call_ollama(model, prompt)


# ---------------------------------------------------------------------------
# Prompt assembly + validation loop
# ---------------------------------------------------------------------------

def load_schema_json(doc_type: str) -> str:
    _, _, schema_file = DOC_MODELS[doc_type]
    return (SCHEMAS_DIR / schema_file).read_text(encoding="utf-8")


def build_prompt(text: str, doc_type: str, retry_errors: Optional[str] = None) -> str:
    template = PROMPT_PATH.read_text(encoding="utf-8")
    retry_block = ""
    if retry_errors:
        retry_block = (
            "\n## Your previous attempt FAILED validation — fix exactly these "
            "errors and output the corrected JSON object\n\n"
            f"```\n{retry_errors}\n```\n"
        )
    return (
        template
        .replace("{{DOC_TYPE}}", doc_type)
        .replace("{{SCHEMA}}", load_schema_json(doc_type))
        .replace("{{RETRY_ERRORS}}", retry_block)
        .replace("{{DOCUMENT}}", text)
    )


_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def parse_json_response(raw: str) -> dict:
    cleaned = _FENCE_RE.sub("", raw.strip()).strip()
    # tolerate leading prose before the first brace (some local models chat)
    if not cleaned.startswith("{"):
        brace = cleaned.find("{")
        if brace == -1:
            raise ValueError("no JSON object in model response")
        cleaned = cleaned[brace:]
    return json.loads(cleaned)


def validate_payload(doc_type: str, payload: dict) -> tuple[Optional[dict], Optional[list]]:
    """Validate a candidate payload. Returns (normalized_dict, None) or (None, errors)."""
    model_cls, _, _ = DOC_MODELS[doc_type]
    try:
        validated = model_cls.model_validate(payload)
        return validated.model_dump(mode="json"), None
    except ValidationError as e:
        return None, e.errors(include_url=False)


def extract(text: str, doc_type: str, extractor_setting: Optional[str] = None) -> ExtractionResult:
    """Run the extract → validate → retry×2 loop for one document."""
    if doc_type not in DOC_MODELS:
        raise ValueError(f"unknown doc_type {doc_type!r} (expected {sorted(DOC_MODELS)})")
    provider, model = parse_extractor_setting(extractor_setting)
    _, schema_version, _ = DOC_MODELS[doc_type]
    result = ExtractionResult(
        status="failed",
        extractor=model,
        extraction_method="api" if provider == "anthropic" else "local_ollama",
        schema_version=schema_version,
    )

    errors_text: Optional[str] = None
    last_errors: Optional[list] = None
    for attempt in range(1 + MAX_RETRIES):
        result.attempts = attempt + 1
        prompt = build_prompt(text, doc_type, retry_errors=errors_text)
        try:
            raw = call_model(provider, model, prompt)
        except Exception as e:  # transport/provider failure — not a data problem
            result.status = "failed"
            result.validation_errors = [{"provider_error": f"{type(e).__name__}: {e}"}]
            return result
        result.raw_responses.append(raw)

        try:
            payload = parse_json_response(raw)
        except (ValueError, json.JSONDecodeError) as e:
            last_errors = [{"json_error": str(e)}]
            errors_text = f"response was not parseable JSON: {e}"
            continue

        data, errors = validate_payload(doc_type, payload)
        if errors is None:
            result.data = data
            # low LLM confidence routes to human review (SCHEMA_HANDOVER §4)
            result.status = "needs_review" if data.get("confidence") == "low" else "ok"
            result.validation_errors = None
            return result
        last_errors = errors
        errors_text = json.dumps(errors, indent=2, default=str)

    # retries exhausted -> keep the evidence, flag for review
    result.status = "needs_review"
    result.validation_errors = last_errors
    return result


# ---------------------------------------------------------------------------
# Database I/O (lazy import of the one-file adapter; scrapers own raw_documents)
# ---------------------------------------------------------------------------

def insert_extraction(conn, raw_document_id: int, result: ExtractionResult) -> int:
    """Insert an extractions row and make it the current one for its raw doc."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE extractions SET is_current = false WHERE raw_document_id = %s",
            (raw_document_id,),
        )
        cur.execute(
            """
            INSERT INTO extractions
                (raw_document_id, extractor, extraction_method, prompt_version,
                 schema_version, extracted_at, status, data, validation_errors,
                 is_current)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, true)
            RETURNING id
            """,
            (
                raw_document_id,
                result.extractor,
                result.extraction_method,
                result.prompt_version,
                result.schema_version,
                datetime.now(timezone.utc),
                result.status,
                json.dumps(result.data) if result.data is not None else json.dumps({}),
                json.dumps(result.validation_errors) if result.validation_errors else None,
            ),
        )
        return cur.fetchone()[0]


def insert_manual_extraction(
    conn,
    raw_document_id: int,
    payload: dict,
    doc_type: str,
    extractor: str = "claude-code-interactive",
) -> int:
    """Interactive path (extraction_method='claude_code_session', SCHEMA_HANDOVER §3):
    schema-valid JSON produced in a Claude Code session, no API key required."""
    data, errors = validate_payload(doc_type, payload)
    if errors:
        raise ValueError(f"manual payload failed validation: {errors}")
    _, schema_version, _ = DOC_MODELS[doc_type]
    result = ExtractionResult(
        status="needs_review" if data.get("confidence") == "low" else "ok",
        data=data,
        extractor=extractor,
        extraction_method="claude_code_session",
        schema_version=schema_version,
    )
    return insert_extraction(conn, raw_document_id, result)


def _pending_raw_docs(conn, raw_id: Optional[int]) -> list[tuple[int, str, str]]:
    """(id, source_type, text) for docs to extract: --raw-id, or all latest raw
    docs of LLM-extractable types lacking a current extraction."""
    q_one = "SELECT id, source_type, raw_text FROM raw_documents WHERE id = %s"
    q_pending = """
        SELECT rd.id, rd.source_type, rd.raw_text
        FROM raw_documents rd
        WHERE rd.is_latest
          AND rd.source_type = ANY(%s)
          AND NOT EXISTS (SELECT 1 FROM extractions e
                          WHERE e.raw_document_id = rd.id AND e.is_current)
        ORDER BY rd.id
    """
    with conn.cursor() as cur:
        if raw_id is not None:
            cur.execute(q_one, (raw_id,))
        else:
            cur.execute(q_pending, (list(SOURCE_TYPE_TO_DOC_TYPE),))
        return cur.fetchall()


def main(argv: Optional[list[str]] = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--raw-id", type=int, help="re-extract one raw_documents row")
    g.add_argument("--all-pending", action="store_true",
                   help="extract every latest raw doc lacking a current extraction")
    args = ap.parse_args(argv)

    from db.client import get_connection  # the one-file adapter (ADR-008)

    done = 0
    with get_connection() as conn:
        for rid, source_type, raw_text in _pending_raw_docs(conn, args.raw_id):
            doc_type = SOURCE_TYPE_TO_DOC_TYPE.get(source_type)
            if doc_type is None:
                print(f"raw#{rid}: source_type={source_type} is not LLM-extracted; skipping")
                continue
            if not raw_text:
                print(f"raw#{rid}: no raw_text; skipping")
                continue
            result = extract(raw_text, doc_type)
            eid = insert_extraction(conn, rid, result)
            conn.commit()
            done += 1
            print(f"raw#{rid} -> extraction#{eid} [{result.status}] "
                  f"({result.extractor}, attempts={result.attempts})")
    print(f"{done} document(s) processed.")


if __name__ == "__main__":
    main()
