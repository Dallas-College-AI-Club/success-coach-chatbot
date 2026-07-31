"""
===============================================================================
Main Data Processing & Extraction Pipeline Test Suite
===============================================================================
Author: Antigravity AI / Neftali
Project: Success Coach Chatbot (Issue #91 - Main Pipeline Engine)

Description:
    TDD Quality Gate test suite verifying Function 1 (Semantic Markdown Chunking)
    and Function 2 (Issue #61 JSON Payload Extraction with empty 768-dim vector reserved field).
===============================================================================
"""

import json
from pathlib import Path
import pytest

from dallasai.main import chunk_markdown, extract_to_json_payload, process_document


def test_chunk_markdown():
    """Verifies Function 1 splits clean markdown text into chunks."""
    sample_md = """# BIOL 1406 - Cellular Biology
Instructor: Dr. Jane Doe

## Course Description
An in-depth study of cellular structures and biochemical pathways.

## Grading Policy
- Exams: 60%
- Homework: 40%
"""
    chunks = chunk_markdown(sample_md, chunk_size=200, chunk_overlap=30)
    assert isinstance(chunks, list)
    assert len(chunks) >= 1
    assert "BIOL 1406" in chunks[0]


def test_extract_to_json_payload():
    """Verifies Function 2 packages markdown chunks, metadata, and facts into Neon JSON schema."""
    file_name = "BIOL-1406.html"
    chunks = ["# BIOL 1406 Section 1", "## Grading Policy\nExams: 60%"]
    metadata = {
        "doc_type": "syllabus",
        "course_code": "BIOL 1406",
        "year": 2026,
        "semester": "spring",
        "catalog_year": "2025-2026"
    }
    facts = {
        "confidence": "high",
        "policies": {"late_work": "Late work accepted with penalty."}
    }

    records = extract_to_json_payload(file_name, chunks, metadata, facts)

    assert len(records) == 2
    record_0 = records[0]

    assert record_0["source_url"] == f"file://{file_name}"
    assert record_0["chunk_index"] == 0
    assert "content_hash" in record_0
    assert record_0["chunk_text"] == chunks[0]
    assert record_0["metadata"]["course_code"] == "BIOL 1406"
    assert record_0["facts"]["confidence"] == "high"
    assert record_0["embedding"] == []  # Reserved for 768-dim vector embedder


def test_process_document_end_to_end(tmp_path: Path):
    """Verifies end-to-end processing of a document into JSON payload records."""
    sample_file = tmp_path / "84063.html"
    sample_file.write_text("""
    <html>
    <head><title>BIOL 1406 - General Biology I</title></head>
    <body>
    <div id="syllabus">
        <h1>BIOL 1406 General Biology I</h1>
        <p>Instructor: Dr. Smith</p>
        <h2>Grading</h2>
        <p>Exams count for 50% of the final grade.</p>
    </div>
    </body>
    </html>
    """, encoding="utf-8")

    records = process_document(sample_file)

    assert len(records) >= 1
    assert records[0]["metadata"]["doc_type"] in ["syllabus", "course"]
    assert "content_hash" in records[0]
    assert isinstance(records[0]["embedding"], dict)
    assert records[0]["embedding"]["dimension"] == 768


def test_generate_embeddings():
    """Verifies Function 3 generates 768-dim vector dictionary on chunk_text."""
    from dallasai.main import generate_embeddings

    records = [{
        "chunk_text": "Sample Markdown section text",
        "metadata": {"doc_type": "syllabus"}
    }]

    updated_records = generate_embeddings(records, model_name="local-768")

    emb = updated_records[0]["embedding"]
    assert isinstance(emb, dict)
    assert emb["model"] == "local-768"
    assert emb["dimension"] == 768
    assert len(emb["values"]) == 768


def test_validate_and_upsert_payload():
    """Verifies Function 4 schema validation and record quarantine logic."""
    from dallasai.main import validate_and_upsert_payload

    valid_record = {
        "source_url": "file://valid.html",
        "chunk_index": 0,
        "content_hash": "abc123hash",
        "chunk_text": "# BIOL 1406",
        "metadata": {"doc_type": "syllabus", "course_code": "BIOL 1406"},
        "facts": {"confidence": "high"},
        "embedding": {"model": "local-768", "dimension": 768, "values": [0.1] * 768}
    }

    invalid_record = {
        "source_url": "file://invalid.html",
        "chunk_index": 0,
        "content_hash": "xyz987hash",
        "chunk_text": "Bad Data",
        "metadata": {},
        "facts": {"confidence": "low"},
        "embedding": {}
    }

    res = validate_and_upsert_payload([valid_record, invalid_record])

    assert res["validated_count"] == 1
    assert res["quarantined_count"] == 1
    assert res["status"] == "partial_quarantine"


if __name__ == "__main__":
    print("Running test_chunk_markdown()...")
    test_chunk_markdown()
    print("PASSED test_chunk_markdown()")

    print("Running test_extract_to_json_payload()...")
    test_extract_to_json_payload()
    print("PASSED test_extract_to_json_payload()")

    print("Running test_generate_embeddings()...")
    test_generate_embeddings()
    print("PASSED test_generate_embeddings()")

    print("Running test_validate_and_upsert_payload()...")
    test_validate_and_upsert_payload()
    print("PASSED test_validate_and_upsert_payload()")

    print("Running test_process_document_end_to_end()...")
    import tempfile
    with tempfile.TemporaryDirectory() as tmp_dir:
        test_process_document_end_to_end(Path(tmp_dir))
    print("PASSED test_process_document_end_to_end()")

    print("\nALL 5 MAIN PIPELINE TESTS PASSED 100%!")


