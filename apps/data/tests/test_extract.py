"""Offline unit tests for pipeline/extract.py (#61 engine hardening).

No network, no API keys: the model is faked by monkeypatching call_model.
"""

import json
from pathlib import Path

import pytest
from dallasai.pipeline import extract as ex

# --------------------------------------------------------------------------- registry stamps


def test_registry_stamp_accepts_wired_doc_types_and_methods():
    for doc_type in ex.DOC_SCHEMAS:
        for method in (
            "api",
            "local_ollama",
            "local_lmstudio",
            "claude_code_session",
            "seed",
        ):
            ex.validate_registry_stamp(doc_type, method)


def test_registry_stamp_accepts_null_facts_schema_doc_type():
    # syllabus has facts_schema: null in the registry ON PURPOSE (facts embed in
    # the section row); the stamp check must not treat that as unknown.
    ex.validate_registry_stamp("syllabus", "api")


def test_registry_stamp_rejects_unknown_doc_type():
    with pytest.raises(ValueError, match="doc_type"):
        ex.validate_registry_stamp("not_a_doc_type", "api")


def test_registry_stamp_rejects_unknown_extraction_method():
    with pytest.raises(ValueError, match="extraction_method"):
        ex.validate_registry_stamp("syllabus", "carrier_pigeon")


# --------------------------------------------------------------------------- parsing


def test_parse_json_response_handles_fences_and_prose():
    assert ex.parse_json_response('```json\n{"a": 1}\n```') == {"a": 1}
    assert ex.parse_json_response('Here is the JSON:\n{"a": 1}') == {"a": 1}
    with pytest.raises(ValueError):
        ex.parse_json_response("no json here at all")


def test_parse_json_response_tolerates_trailing_prose():
    # chat-tuned free models append trailers exactly when response_format was
    # dropped; the trailer must not cost a retry
    assert ex.parse_json_response(
        'Sure! Here it is:\n```json\n{"confidence": "high"}\n```\n'
        "Let me know if you need anything else."
    ) == {"confidence": "high"}
    assert ex.parse_json_response(
        'Here you go: {"confidence": "high"} Hope that helps!'
    ) == {"confidence": "high"}


def test_parse_json_response_rejects_non_object():
    with pytest.raises(ValueError, match="object"):
        ex.parse_json_response("[1, 2, 3]")  # no '{' at all -> "no JSON object"


def test_build_prompt_injects_document_and_schema_exactly_once():
    # the template's header comment lists the literal placeholder names; filling
    # them there used to double every prompt's schema + document payload
    marker_doc = "PROBE_DOCUMENT_9f2d1c"
    prompt = ex.build_prompt(
        "syllabus", marker_doc, {"course_code": "PROBE 1234"}
    )
    assert prompt.count(marker_doc) == 1
    schema_head = json.dumps(ex.load_schema("syllabus"), indent=2)[:80]
    assert prompt.count(schema_head) == 1
    assert prompt.count('"PROBE 1234"') == 1
    assert "<!--" not in prompt


def test_build_prompt_guards_unimplemented_examples_placeholder(
    monkeypatch, tmp_path
):
    t = tmp_path / "extract_vX.md"
    t.write_text("{{DOC_TYPE}}\n{{EXAMPLES}}\n{{DOCUMENT}}", encoding="utf-8")
    monkeypatch.setattr(ex, "PROMPT_PATH", t)
    with pytest.raises(NotImplementedError, match="EXAMPLES"):
        ex.build_prompt("syllabus", "doc", {})


# --------------------------------------------------------------------------- validation


def test_validate_flags_schema_violations():
    errs = ex.validate(
        "syllabus", {"confidence": "very sure"}
    )  # bad enum value
    assert errs and any("confidence" in e for e in errs)
    assert ex.validate("syllabus", {"confidence": "high"}) is None


def test_extract_manual_rejects_invalid_payload():
    with pytest.raises(ValueError, match="failed validation"):
        ex.extract_manual("syllabus", {"confidence": "very sure"})


def test_extract_manual_quarantines_low_confidence():
    assert (
        ex.extract_manual("syllabus", {"confidence": "low"}).status
        == "needs_review"
    )
    assert ex.extract_manual("syllabus", {"confidence": "high"}).status == "ok"


# --------------------------------------------------------------------------- extract loop


def test_extract_retries_with_errors_then_succeeds(monkeypatch):
    calls = []

    def fake_model(provider, model, prompt, max_tokens=ex.DEFAULT_MAX_TOKENS):
        calls.append(prompt)
        if len(calls) == 1:
            return '{"confidence": "very sure"}'  # fails enum validation
        return '{"confidence": "high"}'

    monkeypatch.setattr(ex, "call_model", fake_model)
    res = ex.extract(
        "syllabus", "doc text", {}, extractor_setting="lmstudio:test-model"
    )
    assert res.status == "ok" and res.attempts == 2
    # the retry prompt must carry the exact validator errors back to the model —
    # assert on the offending VALUE ('very sure'), which only the validator
    # error can contribute ('confidence' alone also appears in the schema)
    assert "FAILED validation" in calls[1] and "very sure" in calls[1]
    assert "FAILED validation" not in calls[0]


def test_extract_exhausted_retries_quarantines(monkeypatch):
    monkeypatch.setattr(
        ex, "call_model", lambda *a, **k: '{"confidence": "very sure"}'
    )
    res = ex.extract(
        "syllabus", "doc text", {}, extractor_setting="lmstudio:test-model"
    )
    assert res.status == "needs_review"
    assert res.attempts == 1 + ex.MAX_RETRIES
    assert res.validation_errors and res.raw_responses


def test_extract_uses_doc_type_token_budget(monkeypatch):
    seen = {}

    def fake_model(provider, model, prompt, max_tokens=ex.DEFAULT_MAX_TOKENS):
        seen["max_tokens"] = max_tokens
        return (
            '{"program_code": "CORE-42", "name": "Core Curriculum", '
            '"confidence": "high"}'
        )  # fully schema-valid

    monkeypatch.setattr(ex, "call_model", fake_model)
    res = ex.extract(
        "program_map", "doc text", {}, extractor_setting="lmstudio:test-model"
    )
    assert seen["max_tokens"] == ex.MAX_TOKENS_BY_DOC_TYPE["program_map"]
    assert res.status == "ok" and res.attempts == 1


# --------------------------------------------------------------------------- quarantine persistence


def test_persist_quarantine_writes_full_provenance(tmp_path):
    res = ex.ExtractionResult(
        status="needs_review",
        doc_type="syllabus",
        data={"confidence": "low"},
        validation_errors=None,
        extractor="test-model",
        extraction_method="local_lmstudio",
        schema_version="1",
        attempts=3,
        raw_responses=['{"confidence": "low"}'],
    )
    src = Path("raw/syllabi/2026SP/ACCT-2301-24.html")
    ctx = {"course_code": "ACCT 2301", "term_code": "2026SP"}
    path = ex.persist_quarantine(
        res, tmp_path, "2026SP-ACCT-2301-24", source=src, context=ctx
    )
    assert path == tmp_path / "syllabus" / "2026SP-ACCT-2301-24.json"
    saved = json.loads(path.read_text(encoding="utf-8"))
    assert saved["status"] == "needs_review"
    assert saved["doc_id"] == "2026SP-ACCT-2301-24"
    assert saved["source"] == str(src) and saved["context"] == ctx
    assert saved["extraction_method"] == "local_lmstudio"
    assert saved["prompt_version"] == ex.PROMPT_VERSION
    assert saved["attempts"] == 3 and saved["raw_responses"]


def test_persist_quarantine_never_overwrites_on_collision(tmp_path):
    res = ex.ExtractionResult(
        status="needs_review", doc_type="syllabus", data={"confidence": "low"}
    )
    first = ex.persist_quarantine(res, tmp_path, "ACCT-2301")
    second = ex.persist_quarantine(res, tmp_path, "ACCT-2301")
    assert first != second and first.exists() and second.exists()
    assert second.name == "ACCT-2301.2.json"


def test_pdf_to_text_raises_on_blank_pdf(tmp_path):
    from pypdf import PdfWriter

    blank = tmp_path / "blank.pdf"
    w = PdfWriter()
    w.add_blank_page(width=612, height=792)
    with open(blank, "wb") as fh:
        w.write(fh)
    with pytest.raises(ValueError, match="no extractable text"):
        ex.pdf_to_text(blank)


class _FakeResp:
    def __init__(self, payload, status=200):
        self._payload, self.status_code, self.text = (
            payload,
            status,
            json.dumps(payload),
        )

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


def test_ollama_sends_num_ctx_sized_to_prompt(monkeypatch):
    import requests

    sent = {}

    def fake_post(url, timeout, json):
        sent.update(json)
        return _FakeResp(
            {"message": {"content": "{}"}, "prompt_eval_count": 100}
        )

    monkeypatch.setattr(requests, "post", fake_post)
    ex._call_ollama("test-model", "x" * 3000, max_tokens=16384)
    assert sent["options"]["num_ctx"] >= 16384
    assert sent["options"]["num_predict"] == 16384
    assert sent["options"]["temperature"] == 0


def test_openai_compatible_tokens_key_per_provider(monkeypatch):
    import requests

    bodies = []

    def fake_post(url, timeout, headers, json):
        bodies.append(json)
        return _FakeResp({"choices": [{"message": {"content": "{}"}}]})

    monkeypatch.setattr(requests, "post", fake_post)
    ex._call_openai_compatible("m", "p", provider="lmstudio", max_tokens=8192)
    ex._call_openai_compatible("m", "p", provider="openai", max_tokens=8192)
    assert (
        "max_tokens" in bodies[0] and "max_completion_tokens" not in bodies[0]
    )
    assert (
        "max_completion_tokens" in bodies[1] and "max_tokens" not in bodies[1]
    )
