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
    python -m dallasai.pipeline.extract --doc-type syllabus --html raw/syllabi/2026SP/87180.html \
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

REPO = Path(__file__).resolve().parents[4]  # …/success-coach-chatbot
SCHEMAS_DIR = REPO / "src" / "config" / "facts-schemas"
REGISTRY_PATH = REPO / "src" / "config" / "metadata-registry.json"
# Prompt version is PER DOC_TYPE: the catalog gold gate validated v3 byte-exact,
# and v4's rewritten ### cv section measurably degraded catalog verbatim fidelity
# when shipped in catalog prompts (gate run 2026-07-26: flattened newlines,
# dropped "Prerequisites:" prefix, case-normalized group names). Catalog stays on
# its validated prompt; cv moves independently.
PROMPT_VERSION_BY_DOC_TYPE = {
    "syllabus": "v3",
    "course": "v3",
    "program_map": "v3",
    "cv": "v4",
}
PROMPTS_DIR = Path(__file__).resolve().parents[2] / "reference" / "prompts"
# test hook: when set (monkeypatch), overrides the per-doc_type template
PROMPT_PATH: Optional[Path] = None


def prompt_version(doc_type: str) -> str:
    return PROMPT_VERSION_BY_DOC_TYPE[doc_type]


def prompt_path(doc_type: str) -> Path:
    return PROMPT_PATH or PROMPTS_DIR / f"extract_{prompt_version(doc_type)}.md"


EXAMPLES_DIR = (
    Path(__file__).resolve().parents[2] / "reference" / "prompts" / "examples"
)
MAX_RETRIES = 2
# cv gets more retry rounds: its in-loop quality gates (verbatim spans,
# objectivity, figures) give the model more to converge on than schema shape,
# and the largest CVs carry 25+ spans — 2026-07-26 pilot saw two big CVs still
# non-convergent after 3 attempts
MAX_RETRIES_BY_DOC_TYPE = {"cv": 4}

# doc_type -> (schema file, schema_version)
DOC_SCHEMAS = {
    "syllabus": ("facts-syllabus-v1.schema.json", "1"),
    "course": ("facts-course-v1.schema.json", "1"),
    "program_map": ("facts-program-map-v1.schema.json", "1"),
    "cv": ("facts-cv-v2.schema.json", "2"),
}

# Output-token budget per doc_type. program_map needs headroom: poid=3388
# (Core Curriculum) emits nine component-area groups[] with full option lists —
# a truncated response fails validation identically on every retry and
# quarantines the single most load-bearing document in the corpus.
DEFAULT_MAX_TOKENS = 8192
MAX_TOKENS_BY_DOC_TYPE = {
    "program_map": 16384,
    # cv v2 four-tier output: the longest CVs (Vail-class,
    # ~7KB source) emit ~6-7K tokens of JSON — 8192 would
    # truncate and quarantine exactly the richest profiles
    "cv": 16384,
}

# claude-sonnet-5 defaults to ADAPTIVE THINKING, and thinking tokens come out of
# max_tokens: on the largest pilot CV it burned 15,645/16,384 tokens thinking and
# truncated the JSON at 739 text tokens (2026-07-26 pilot, 3/20 quarantined this
# way). Extraction is few-shot mechanical — the exemplars carry the reasoning —
# so cv runs with thinking disabled: no truncation, ~2-3x cheaper output. Catalog
# doc_types are untouched (their gate baselines predate this setting).
THINKING_DISABLED_DOC_TYPES = {"cv"}


@dataclass
class ExtractionResult:
    status: str  # ok | needs_review | failed
    doc_type: str
    data: Optional[dict] = None
    validation_errors: Optional[list] = None
    extractor: str = ""
    extraction_method: str = ""
    prompt_version: str = ""
    schema_version: str = ""
    attempts: int = 0
    raw_responses: list = field(default_factory=list)


# --------------------------------------------------------------------------- providers


def parse_extractor_setting(setting: Optional[str] = None) -> tuple[str, str]:
    setting = setting or os.environ.get("EXTRACTOR", "")
    if ":" not in setting:
        raise SystemExit(
            "EXTRACTOR not set (e.g. 'anthropic:claude-sonnet-4-6' | "
            "'lmstudio:qwen2.5-14b-instruct' | 'ollama:qwen2.5:14b')"
        )
    provider, model = setting.split(":", 1)
    provider = provider.strip().lower()
    if provider not in ("anthropic", "ollama", "lmstudio", "openai", "openrouter"):
        raise SystemExit(f"unknown EXTRACTOR provider {provider!r}")
    return provider, model.strip()


def _method_for(provider: str) -> str:
    return {
        "anthropic": "api",
        "ollama": "local_ollama",
        "lmstudio": "local_lmstudio",
        "openai": "api",
        "openrouter": "api",
    }[provider]


# dynamic-tail marker: everything BEFORE it is a per-doc_type-constant prefix
# safe to cache; everything after (context, retry errors, document) varies
CACHE_SPLIT_MARKER = "\n## Identity context"
# only templates laid out prefix-first participate (v4/cv); catalog v3 keeps
# its validated layout with context near the top, where caching buys nothing
CACHED_PROMPT_DOC_TYPES = {"cv"}


def _call_anthropic(
    model: str,
    prompt: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    disable_thinking: bool = False,
    cache_prefix: bool = False,
) -> str:
    import anthropic

    client = anthropic.Anthropic()  # ANTHROPIC_API_KEY from env
    content: object = prompt
    if cache_prefix and CACHE_SPLIT_MARKER in prompt:
        # prompt caching is billing-only — identical tokens, identical model
        # behavior; the shared ~18K-token prefix bills at ~1/10 price on reads
        i = prompt.index(CACHE_SPLIT_MARKER)
        content = [
            {
                "type": "text",
                "text": prompt[:i],
                "cache_control": {"type": "ephemeral"},
            },
            {"type": "text", "text": prompt[i:]},
        ]
    kwargs: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": content}],
    }
    if disable_thinking:
        kwargs["thinking"] = {"type": "disabled"}
    # temperature=0 is gate-blocking: the golden gate diffs expected JSON on
    # this path, and a sampled response makes the diff flake. Claude 5-family
    # models reject the parameter outright ("`temperature` is deprecated for
    # this model") — retry without it; the gate still enforces determinism.
    try:
        msg = client.messages.create(temperature=0, **kwargs)
    except anthropic.BadRequestError as e:
        if "temperature" not in str(e):
            raise
        msg = client.messages.create(**kwargs)
    return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")


def _call_ollama(model: str, prompt: str, max_tokens: int = DEFAULT_MAX_TOKENS) -> str:
    import requests

    base = os.environ.get("OLLAMA_HOST") or "http://localhost:11434"
    # num_ctx is mandatory (EXTRACTION_PLAYBOOK.md provider matrix): without it
    # Ollama silently truncates the PROMPT at the model default (~2-4k tokens)
    # and returns plausible-wrong JSON — the worst failure mode. Size it to
    # prompt + output; len//3 over-estimates prompt tokens on purpose.
    num_ctx = int(os.environ.get("OLLAMA_NUM_CTX") or 0) or max(
        16384, len(prompt) // 3 + max_tokens
    )
    r = requests.post(
        f"{base}/api/chat",
        timeout=600,
        json={
            "model": model,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0,
                "num_predict": max_tokens,
                "num_ctx": num_ctx,
            },
            "messages": [{"role": "user", "content": prompt}],
        },
    )
    r.raise_for_status()
    data = r.json()
    if data.get("prompt_eval_count", 0) >= num_ctx - 8:  # input hit the ceiling
        raise RuntimeError(
            f"ollama truncated the prompt (prompt_eval_count "
            f"{data['prompt_eval_count']} at num_ctx {num_ctx}); "
            f"raise OLLAMA_NUM_CTX"
        )
    return data["message"]["content"]


def _call_openai_compatible(
    model: str,
    prompt: str,
    provider: str = "openai",
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> str:
    """LM Studio / OpenRouter / any OpenAI Chat Completions endpoint.

    OpenRouter specifics (the repo's selected free LLM gateway): base URL and
    OPENROUTER_API_KEY default in automatically; free-tier models rate-limit with
    HTTP 429 (the documented failure mode in docs/mitigations), so 429/5xx get an
    exponential backoff retry here; and providers that reject response_format get
    one retry without it (the parse+validate loop tolerates prose-wrapped JSON)."""
    import time as _time

    import requests

    if provider == "openrouter":
        # `or` (not a .get default) so an empty LLM_BASE_URL= line sourced from
        # .env falls back instead of producing a request to ""
        base = os.environ.get("LLM_BASE_URL") or "https://openrouter.ai/api/v1"
        key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("LLM_API_KEY", "")
        extra = {
            "HTTP-Referer": "https://dc-success-coach.vercel.app",
            "X-Title": "Dallas College Success Coach Chatbot",
        }
    else:
        base = os.environ.get("LLM_BASE_URL") or "http://localhost:1234/v1"
        key = os.environ.get("LLM_API_KEY") or "lm-studio"
        extra = {}
    # current OpenAI models reject max_tokens in favor of max_completion_tokens;
    # LM Studio / OpenRouter speak classic max_tokens
    tokens_key = "max_completion_tokens" if provider == "openai" else "max_tokens"
    body = {
        "model": model,
        "temperature": 0,
        tokens_key: max_tokens,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "user", "content": prompt}],
    }
    MAX_TRANSIENT_RETRIES = 5
    attempt = 0
    while True:
        r = requests.post(
            f"{base}/chat/completions",
            timeout=600,
            headers={"Authorization": f"Bearer {key}", **extra},
            json=body,
        )
        if r.status_code in (429, 500, 502, 503, 504):  # rate limit / transient
            attempt += 1
            if attempt >= MAX_TRANSIENT_RETRIES:
                r.raise_for_status()  # out of retries: surface it
            _time.sleep(min(4 * 2 ** (attempt - 1), 60))
            continue
        if (
            r.status_code == 400
            and "response_format" in body
            and "response_format" in r.text
        ):
            body.pop("response_format")  # provider rejects json mode; free retry
            continue  # (does not consume a transient-retry slot)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


def call_model(
    provider: str,
    model: str,
    prompt: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    disable_thinking: bool = False,
    cache_prefix: bool = False,
) -> str:
    if provider == "anthropic":
        return _call_anthropic(
            model, prompt, max_tokens, disable_thinking, cache_prefix
        )
    if provider == "ollama":
        return _call_ollama(model, prompt, max_tokens)
    return _call_openai_compatible(
        model, prompt, provider, max_tokens
    )  # lmstudio | openai | openrouter


# --------------------------------------------------------------------------- prompt + validation


def load_schema(doc_type: str) -> dict:
    fname, _ = DOC_SCHEMAS[doc_type]
    return json.loads((SCHEMAS_DIR / fname).read_text(encoding="utf-8"))


_HTML_COMMENT_RE = re.compile(r"<!--.*?-->\s*", re.DOTALL)


def build_prompt(
    doc_type: str, document: str, context: dict, retry_errors: Optional[str] = None
) -> str:
    # Strip the template's header comment BEFORE filling placeholders: the
    # comment lists the literal placeholder names, so replacing on the raw
    # template used to inject the full schema + document TWICE per prompt
    # (nearly doubling every prompt's token cost — measured on the 337-program
    # catalog sweep, and enough to push the largest documents past a 32K
    # local-model context window).
    tpl_path = prompt_path(doc_type)
    template = _HTML_COMMENT_RE.sub("", tpl_path.read_text(encoding="utf-8"), count=1)
    schema_json = json.dumps(load_schema(doc_type), indent=2)
    retry_block = ""
    if retry_errors:
        retry_block = (
            "\n## Your previous attempt FAILED validation — fix EXACTLY "
            f"these errors and output corrected JSON only\n```\n{retry_errors}\n```\n"
        )
    # The v2 EXAMPLES splice: worked exemplars for this doc_type, in file order.
    # A plain glob deliberately excludes the counterexamples/ subfolder — wrong
    # outputs must never enter the prompt as positives.
    examples = "\n\n---\n\n".join(
        f.read_text(encoding="utf-8")
        for f in sorted((EXAMPLES_DIR / doc_type).glob("*.md"))
    )
    prompt = (
        template.replace("{{DOC_TYPE}}", doc_type)
        .replace("{{CONTEXT}}", json.dumps(context, indent=2))
        .replace("{{SCHEMA}}", schema_json)
        .replace("{{EXAMPLES}}", examples)
        .replace("{{RETRY_ERRORS}}", retry_block)
        .replace("{{DOCUMENT}}", document)
    )
    if "{{EXAMPLES}}" in prompt:
        # the splice ran, so a residual literal token means an exemplar file
        # itself contains "{{EXAMPLES}}" — fail loudly rather than ship the
        # literal token to the model.
        raise NotImplementedError(
            f"{tpl_path.name}: literal {{{{EXAMPLES}}}} survived the splice — "
            "an exemplar file under reference/prompts/examples/ contains the placeholder "
            "token; remove it before activating this prompt version"
        )
    return prompt


_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def parse_json_response(raw: str) -> dict:
    cleaned = _FENCE_RE.sub("", raw.strip()).strip()
    if not cleaned.startswith("{"):
        brace = cleaned.find("{")
        if brace == -1:
            raise ValueError("no JSON object in model response")
        cleaned = cleaned[brace:]
    # raw_decode tolerates trailing prose after the object ("...} Hope that
    # helps!") — chat-tuned free models emit exactly that once response_format
    # has been dropped, and json.loads would burn every retry on 'Extra data'.
    payload, _end = json.JSONDecoder().raw_decode(cleaned)
    if not isinstance(payload, dict):
        raise ValueError("model response was JSON but not an object")
    return payload


def validate(doc_type: str, payload: dict) -> Optional[list]:
    """None if valid, else a list of jsonschema error strings."""
    import jsonschema

    schema = load_schema(doc_type)
    validator = jsonschema.Draft7Validator(schema)
    errors = [
        f"{'/'.join(map(str, e.path)) or '<root>'}: {e.message}"
        for e in validator.iter_errors(payload)
    ]
    return errors or None


# --------------------------------------------------------------------------- registry stamps

_registry_cache: Optional[dict] = None


def _registry() -> dict:
    global _registry_cache
    if _registry_cache is None:
        _registry_cache = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    return _registry_cache


def validate_registry_stamp(doc_type: str, extraction_method: str) -> None:
    """Contract-sync check against src/config/metadata-registry.json (#61):
    the doc_type must be in the registry vocabulary and extraction_method in
    its enum, so a row can never be stamped with values the registry doesn't
    know. Deliberately does NOT require a non-null facts_schema — the registry
    sets syllabus facts_schema to null on purpose (syllabus facts embed in the
    section row as facts.syllabus; the schema file stays the extractor's
    output contract). Exhaustive per-key validation is #51's CI contract-sync,
    not this check."""
    reg = _registry()
    doc_types = reg["doc_types"]
    if doc_type not in doc_types:
        raise ValueError(
            f"doc_type {doc_type!r} not in metadata-registry "
            f"doc_types (have {sorted(doc_types)})"
        )
    methods = reg["keys"]["extraction_method"]["enum"]
    if extraction_method not in methods:
        raise ValueError(
            f"extraction_method {extraction_method!r} not in "
            f"metadata-registry enum {methods}"
        )


# --------------------------------------------------------------------------- extract


def extract(
    doc_type: str, document: str, context: dict, extractor_setting: Optional[str] = None
) -> ExtractionResult:
    if doc_type not in DOC_SCHEMAS:
        raise ValueError(f"unknown doc_type {doc_type!r} (have {sorted(DOC_SCHEMAS)})")
    provider, model = parse_extractor_setting(extractor_setting)
    validate_registry_stamp(doc_type, _method_for(provider))
    _, schema_version = DOC_SCHEMAS[doc_type]
    max_tokens = MAX_TOKENS_BY_DOC_TYPE.get(doc_type, DEFAULT_MAX_TOKENS)
    res = ExtractionResult(
        status="failed",
        doc_type=doc_type,
        extractor=model,
        extraction_method=_method_for(provider),
        prompt_version=prompt_version(doc_type),
        schema_version=schema_version,
    )
    errors_text: Optional[str] = None
    for attempt in range(1 + MAX_RETRIES_BY_DOC_TYPE.get(doc_type, MAX_RETRIES)):
        res.attempts = attempt + 1
        prompt = build_prompt(doc_type, document, context, retry_errors=errors_text)
        try:
            raw = call_model(
                provider,
                model,
                prompt,
                max_tokens,
                disable_thinking=doc_type in THINKING_DISABLED_DOC_TYPES,
                cache_prefix=doc_type in CACHED_PROMPT_DOC_TYPES,
            )
        except Exception as e:  # transport failure
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
        if errs is None and doc_type == "cv":
            # cv quality gates run IN the retry loop (2026-07-26 pilot lesson):
            # schema-valid output can still stitch quotes or overrun the summary
            # limit — feed those back as retry errors instead of shipping them
            # to the downstream verifier
            from .verify_cv import extraction_stage_errors

            errs = extraction_stage_errors(payload, document) or None
        if errs is None:
            res.data = payload
            res.status = "needs_review" if payload.get("confidence") == "low" else "ok"
            res.validation_errors = None
            return res
        res.validation_errors = errs
        errors_text = json.dumps(errs, indent=2)
    res.status = "needs_review"  # retries exhausted, keep evidence
    return res


def extract_manual(
    doc_type: str, payload: dict, extractor: str = "claude-code-session"
) -> ExtractionResult:
    """No-API-key path: validate already-produced schema-valid JSON."""
    validate_registry_stamp(doc_type, "claude_code_session")
    _, schema_version = DOC_SCHEMAS[doc_type]
    errs = validate(doc_type, payload)
    if errs:
        raise ValueError(f"manual payload failed validation: {errs}")
    return ExtractionResult(
        status="needs_review" if payload.get("confidence") == "low" else "ok",
        doc_type=doc_type,
        data=payload,
        extractor=extractor,
        extraction_method="claude_code_session",
        prompt_version=prompt_version(doc_type),
        schema_version=schema_version,
    )


def persist_quarantine(
    res: ExtractionResult,
    quarantine_dir: Path,
    doc_id: str,
    source: Optional[Path] = None,
    context: Optional[dict] = None,
) -> Path:
    """Persist a non-ok result to <quarantine_dir>/<doc_type>/<doc_id>.json —
    the review queue (#61). Quarantined rows are never loaded and never
    displace good data; everything needed to re-adjudicate travels with the
    row: the (possibly invalid) data, the exact validator errors, every raw
    model response, the source path + identity context, and full provenance.
    Never overwrites: a doc_id collision gets a numeric suffix, so a later run
    cannot destroy an earlier document's review evidence."""
    out_dir = quarantine_dir / res.doc_type
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{doc_id}.json"
    n = 2
    while out.exists():
        out = out_dir / f"{doc_id}.{n}.json"
        n += 1
    out.write_text(
        json.dumps(
            {
                "status": res.status,
                "doc_type": res.doc_type,
                "doc_id": doc_id,
                "source": str(source) if source else None,
                "context": context,
                "extractor": res.extractor,
                "extraction_method": res.extraction_method,
                "prompt_version": res.prompt_version,
                "schema_version": res.schema_version,
                "attempts": res.attempts,
                "validation_errors": res.validation_errors,
                "data": res.data,
                "raw_responses": res.raw_responses,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return out


def html_to_text(html: str) -> str:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript", "head"]):
        tag.decompose()
    return re.sub(r"\n\s*\n+", "\n\n", soup.get_text("\n")).strip()


def pdf_to_text(pdf_path: Path) -> str:
    """The canonical PDF -> extractor-input text rendering (2024 HB2504 corpus,
    Concourse print-to-PDFs). Deliberately bare pypdf text — no headers, no
    frontmatter, nothing time-dependent — because gold-case input.txt files are
    regenerated through this exact function and must stay byte-reproducible
    (see apps/data/tests/gold/README.md). Changing this rendering marks every
    PDF gold case stale until re-verified."""
    from pypdf import PdfReader

    try:
        pages = (page.extract_text() or "" for page in PdfReader(pdf_path).pages)
        text = "\n\n".join(p.strip() for p in pages if p.strip())
    except Exception as e:
        raise ValueError(f"{pdf_path}: unreadable PDF ({type(e).__name__}: {e})") from e
    text = re.sub(r"[ \t]+\n", "\n", re.sub(r"\n\s*\n+", "\n\n", text)).strip()
    if len(text) < 200:
        # scanned/image-only PDF: extracting against (near-)empty text would let
        # the model fabricate facts out of the context block alone
        raise ValueError(
            f"{pdf_path}: no extractable text ({len(text)} chars) — "
            "scanned/image PDF? needs OCR or quarantine"
        )
    return text


def main(argv: Optional[list[str]] = None) -> None:
    import sys

    if hasattr(sys.stdout, "reconfigure"):
        # Windows redirected stdout is cp1252: printing model-echoed document
        # text (ﬁ ligatures from pypdf are all over this corpus) must degrade,
        # not crash the run
        sys.stdout.reconfigure(errors="replace")
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--doc-type", required=True, choices=sorted(DOC_SCHEMAS))
    ap.add_argument("--html", type=Path, help="raw HTML file to extract")
    ap.add_argument(
        "--pdf", type=Path, help="raw PDF file to extract (2024 HB2504 archive)"
    )
    ap.add_argument("--text", type=Path, help="already-plain-text file to extract")
    ap.add_argument("--context", default="{}", help="JSON identity context")
    ap.add_argument("--out", type=Path, help="write the facts JSON here")
    ap.add_argument(
        "--quarantine-dir",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "out" / "quarantine",
        help="where non-ok results are persisted for review "
        "(default apps/data/out/quarantine)",
    )
    args = ap.parse_args(argv)

    src = args.html or args.pdf or args.text
    if args.html:
        document = html_to_text(args.html.read_text(encoding="utf-8", errors="replace"))
    elif args.pdf:
        document = pdf_to_text(args.pdf)
    elif args.text:
        document = args.text.read_text(encoding="utf-8", errors="replace")
    else:
        ap.error("give --html, --pdf, or --text")

    context = json.loads(args.context)
    res = extract(args.doc_type, document, context)
    if res.status != "ok":
        # persist BEFORE any printing: evidence must survive even if stdout
        # chokes on model-echoed text
        doc_id = (
            f"{src.parent.name}-{src.stem}"  # term-qualified: 2024FA-ACCT-2301-21000
        )
        qpath = persist_quarantine(
            res, args.quarantine_dir, doc_id, source=src, context=context
        )
    print(
        f"[{res.status}] {res.doc_type} via {res.extractor} "
        f"({res.extraction_method}) attempts={res.attempts}"
    )
    if res.validation_errors:
        print("  errors:", res.validation_errors)
    if res.status == "ok":
        if res.data and args.out:
            args.out.parent.mkdir(parents=True, exist_ok=True)
            args.out.write_text(json.dumps(res.data, indent=2), encoding="utf-8")
            print(f"  wrote {args.out}")
    else:
        print(f"  quarantined -> {qpath}")


if __name__ == "__main__":
    main()
