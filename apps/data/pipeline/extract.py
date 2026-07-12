"""Provider-agnostic LLM extraction: raw document -> validated facts JSON.

The contract is (one JSON Schema) + (one versioned prompt) + (a provider
setting), so switching models is a config change + a re-run. Every result
records extractor / extraction_method / prompt_version / schema_version.

    EXTRACTOR="anthropic:claude-sonnet-4-6"        # paid API today
    EXTRACTOR="lmstudio:qwen2.5-14b-instruct"      # free local (OpenAI-compatible)
    EXTRACTOR="ollama:qwen2.5:14b"                 # free local (Ollama-native)

The schema for each doc_type is the repo contract at
src/config/facts-schemas/facts-<doc_type>-v1.schema.json; output is validated
against it with jsonschema. On validation failure the exact errors are appended
to the prompt and the model retries (a few times); a low-confidence result is
quarantined (status='needs_review'), never used to displace good data.

No-API-key path: schema-valid JSON produced by any means (e.g. a Claude Code
session) can be validated + wrapped via extract_manual() with
extraction_method='claude_code_session'.

CLI:
    python -m pipeline.extract --doc-type syllabus --html raw/syllabi/2026SP/87180.html \
        --context '{"course_code":"ENGL 1301","professor":"Contreras, Nelda","year":2026,"semester":"spring"}'
"""

from __future__ import annotations

import argparse
import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

REPO = Path(__file__).resolve().parents[3]           # …/success-coach-chatbot
SCHEMAS_DIR = REPO / "src" / "config" / "facts-schemas"
PROMPT_VERSION = "v1"
PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / f"extract_{PROMPT_VERSION}.md"
MAX_RETRIES = 2

# doc_type -> (schema file, schema_version)
DOC_SCHEMAS = {
    "syllabus": ("facts-syllabus-v1.schema.json", "1"),
    "course": ("facts-course-v1.schema.json", "1"),
    "program_map": ("facts-program-map-v1.schema.json", "1"),
    "cv": ("facts-cv-v1.schema.json", "1"),
}


@dataclass
class ExtractionResult:
    status: str                       # ok | needs_review | failed
    doc_type: str
    data: Optional[dict] = None
    validation_errors: Optional[list] = None
    extractor: str = ""
    extraction_method: str = ""
    prompt_version: str = PROMPT_VERSION
    schema_version: str = ""
    attempts: int = 0
    raw_responses: list = field(default_factory=list)


# --------------------------------------------------------------------------- providers

def parse_extractor_setting(setting: Optional[str] = None) -> tuple[str, str]:
    setting = setting or os.environ.get("EXTRACTOR", "")
    if ":" not in setting:
        raise SystemExit("EXTRACTOR not set (e.g. 'anthropic:claude-sonnet-4-6' | "
                         "'lmstudio:qwen2.5-14b-instruct' | 'ollama:qwen2.5:14b')")
    provider, model = setting.split(":", 1)
    provider = provider.strip().lower()
    if provider not in ("anthropic", "ollama", "lmstudio", "openai", "openrouter"):
        raise SystemExit(f"unknown EXTRACTOR provider {provider!r}")
    return provider, model.strip()


def _method_for(provider: str) -> str:
    return {"anthropic": "api", "ollama": "local_ollama",
            "lmstudio": "local_lmstudio", "openai": "api", "openrouter": "api"}[provider]


def _call_anthropic(model: str, prompt: str) -> str:
    import anthropic
    client = anthropic.Anthropic()                    # ANTHROPIC_API_KEY from env
    msg = client.messages.create(model=model, max_tokens=8192,
                                 messages=[{"role": "user", "content": prompt}])
    return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")


def _call_ollama(model: str, prompt: str) -> str:
    import requests
    base = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    r = requests.post(f"{base}/api/chat", timeout=600, json={
        "model": model, "stream": False, "format": "json",
        "options": {"temperature": 0},
        "messages": [{"role": "user", "content": prompt}]})
    r.raise_for_status()
    return r.json()["message"]["content"]


def _call_openai_compatible(model: str, prompt: str, provider: str = "openai") -> str:
    """LM Studio / OpenRouter / any OpenAI Chat Completions endpoint.

    OpenRouter specifics (the repo's selected free LLM gateway): base URL and
    OPENROUTER_API_KEY default in automatically; free-tier models rate-limit with
    HTTP 429 (the documented failure mode in docs/mitigations), so 429/5xx get an
    exponential backoff retry here; and providers that reject response_format get
    one retry without it (the parse+validate loop tolerates prose-wrapped JSON)."""
    import time as _time

    import requests
    if provider == "openrouter":
        base = os.environ.get("LLM_BASE_URL", "https://openrouter.ai/api/v1")
        key = (os.environ.get("OPENROUTER_API_KEY")
               or os.environ.get("LLM_API_KEY", ""))
        extra = {"HTTP-Referer": "https://dc-success-coach.vercel.app",
                 "X-Title": "Dallas College Success Coach Chatbot"}
    else:
        base = os.environ.get("LLM_BASE_URL", "http://localhost:1234/v1")
        key = os.environ.get("LLM_API_KEY", "lm-studio")
        extra = {}
    body = {"model": model, "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": prompt}]}
    for attempt in range(5):
        r = requests.post(f"{base}/chat/completions", timeout=600,
                          headers={"Authorization": f"Bearer {key}", **extra},
                          json=body)
        if r.status_code in (429, 500, 502, 503, 504):     # rate limit / transient
            _time.sleep(min(4 * 2 ** attempt, 60))
            continue
        if r.status_code == 400 and "response_format" in body:
            body.pop("response_format")                    # provider rejects it
            continue
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    r.raise_for_status()
    raise RuntimeError("unreachable")


def call_model(provider: str, model: str, prompt: str) -> str:
    if provider == "anthropic":
        return _call_anthropic(model, prompt)
    if provider == "ollama":
        return _call_ollama(model, prompt)
    return _call_openai_compatible(model, prompt, provider)  # lmstudio | openai | openrouter


# --------------------------------------------------------------------------- prompt + validation

def load_schema(doc_type: str) -> dict:
    fname, _ = DOC_SCHEMAS[doc_type]
    return json.loads((SCHEMAS_DIR / fname).read_text(encoding="utf-8"))


def build_prompt(doc_type: str, document: str, context: dict,
                 retry_errors: Optional[str] = None) -> str:
    template = PROMPT_PATH.read_text(encoding="utf-8")
    schema_json = json.dumps(load_schema(doc_type), indent=2)
    retry_block = ""
    if retry_errors:
        retry_block = ("\n## Your previous attempt FAILED validation — fix EXACTLY "
                       f"these errors and output corrected JSON only\n```\n{retry_errors}\n```\n")
    return (template
            .replace("{{DOC_TYPE}}", doc_type)
            .replace("{{CONTEXT}}", json.dumps(context, indent=2))
            .replace("{{SCHEMA}}", schema_json)
            .replace("{{RETRY_ERRORS}}", retry_block)
            .replace("{{DOCUMENT}}", document))


_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def parse_json_response(raw: str) -> dict:
    cleaned = _FENCE_RE.sub("", raw.strip()).strip()
    if not cleaned.startswith("{"):
        brace = cleaned.find("{")
        if brace == -1:
            raise ValueError("no JSON object in model response")
        cleaned = cleaned[brace:]
    return json.loads(cleaned)


def validate(doc_type: str, payload: dict) -> Optional[list]:
    """None if valid, else a list of jsonschema error strings."""
    import jsonschema
    schema = load_schema(doc_type)
    validator = jsonschema.Draft7Validator(schema)
    errors = [f"{'/'.join(map(str, e.path)) or '<root>'}: {e.message}"
              for e in validator.iter_errors(payload)]
    return errors or None


# --------------------------------------------------------------------------- extract

def extract(doc_type: str, document: str, context: dict,
            extractor_setting: Optional[str] = None) -> ExtractionResult:
    if doc_type not in DOC_SCHEMAS:
        raise ValueError(f"unknown doc_type {doc_type!r} (have {sorted(DOC_SCHEMAS)})")
    provider, model = parse_extractor_setting(extractor_setting)
    _, schema_version = DOC_SCHEMAS[doc_type]
    res = ExtractionResult(status="failed", doc_type=doc_type, extractor=model,
                           extraction_method=_method_for(provider),
                           schema_version=schema_version)
    errors_text: Optional[str] = None
    for attempt in range(1 + MAX_RETRIES):
        res.attempts = attempt + 1
        prompt = build_prompt(doc_type, document, context, retry_errors=errors_text)
        try:
            raw = call_model(provider, model, prompt)
        except Exception as e:                          # transport failure
            res.status = "failed"
            res.validation_errors = [f"provider_error: {type(e).__name__}: {e}"]
            return res
        res.raw_responses.append(raw)
        try:
            payload = parse_json_response(raw)
        except (ValueError, json.JSONDecodeError) as e:
            errors_text = f"response was not valid JSON: {e}"
            res.validation_errors = [errors_text]
            continue
        errs = validate(doc_type, payload)
        if errs is None:
            res.data = payload
            res.status = "needs_review" if payload.get("confidence") == "low" else "ok"
            res.validation_errors = None
            return res
        res.validation_errors = errs
        errors_text = json.dumps(errs, indent=2)
    res.status = "needs_review"                          # retries exhausted, keep evidence
    return res


def extract_manual(doc_type: str, payload: dict,
                   extractor: str = "claude-code-session") -> ExtractionResult:
    """No-API-key path: validate already-produced schema-valid JSON."""
    _, schema_version = DOC_SCHEMAS[doc_type]
    errs = validate(doc_type, payload)
    if errs:
        raise ValueError(f"manual payload failed validation: {errs}")
    return ExtractionResult(
        status="needs_review" if payload.get("confidence") == "low" else "ok",
        doc_type=doc_type, data=payload, extractor=extractor,
        extraction_method="claude_code_session", schema_version=schema_version)


def html_to_text(html: str) -> str:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript", "head"]):
        tag.decompose()
    return re.sub(r"\n\s*\n+", "\n\n", soup.get_text("\n")).strip()


def main(argv: Optional[list[str]] = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--doc-type", required=True, choices=sorted(DOC_SCHEMAS))
    ap.add_argument("--html", type=Path, help="raw HTML file to extract")
    ap.add_argument("--text", type=Path, help="already-plain-text file to extract")
    ap.add_argument("--context", default="{}", help="JSON identity context")
    ap.add_argument("--out", type=Path, help="write the facts JSON here")
    args = ap.parse_args(argv)

    if args.html:
        document = html_to_text(args.html.read_text(encoding="utf-8", errors="replace"))
    elif args.text:
        document = args.text.read_text(encoding="utf-8", errors="replace")
    else:
        ap.error("give --html or --text")

    res = extract(args.doc_type, document, json.loads(args.context))
    print(f"[{res.status}] {res.doc_type} via {res.extractor} "
          f"({res.extraction_method}) attempts={res.attempts}")
    if res.validation_errors:
        print("  errors:", res.validation_errors)
    if res.data and args.out:
        args.out.write_text(json.dumps(res.data, indent=2), encoding="utf-8")
        print(f"  wrote {args.out}")


if __name__ == "__main__":
    main()
