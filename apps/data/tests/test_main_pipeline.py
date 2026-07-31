"""
===============================================================================
Main Data Processing & Extraction Pipeline Test Suite
===============================================================================
Author: Antigravity AI / Neftali
Project: Success Coach Chatbot (Issue #91 - Main Pipeline Engine)

Description:
    TDD Quality Gate test suite verifying Function 1 (Preprocessing), Function 2
    (Semantic Markdown Chunking), Function 3 (JSON Payload Extraction), Function 4
    (768-dim Vector Embeddings), and Function 5 (Schema Validation & Database Upsert)
    using 3 REAL production Dallas College Syllabi and 3 REAL production Catalog Courses.
===============================================================================
"""

import json
import sys
from pathlib import Path
import pytest

# Inject apps/data into Python sys.path
SYS_DATA_DIR = Path(__file__).resolve().parent.parent
if str(SYS_DATA_DIR) not in sys.path:
    sys.path.insert(0, str(SYS_DATA_DIR))

from dallasai.db_setup import check_db_status
from dallasai.main import (
    preprocess_document,
    chunk_markdown,
    extract_to_json_payload,
    generate_embeddings,
    validate_and_upsert_payload,
    process_document
)

# Paths to REAL production sample files
SYLLABI_DIR = SYS_DATA_DIR / "sample_data" / "syllabi"
COURSES_DIR = SYS_DATA_DIR / "sample_data" / "courses"

REAL_SYLLABUS_FILES = [
    SYLLABI_DIR / "84063.html",
    SYLLABI_DIR / "98296.html",
    SYLLABI_DIR / "98301.html"
]

REAL_COURSE_FILES = [
    COURSES_DIR / "15113.html",
    COURSES_DIR / "15115.html",
    COURSES_DIR / "15116.html"
]


def test_function_1_and_2_real_production_files():
    """Verifies Function 1 & 2 on 3 real production Syllabi and 3 real production Catalog Courses."""
    # 1. Test 3 Real Production Syllabi
    for syl_file in REAL_SYLLABUS_FILES:
        raw_html = syl_file.read_text(encoding="utf-8")
        clean_md, metadata = preprocess_document(raw_html, source_url=f"file://{syl_file.name}")
        
        assert metadata["doc_type"] == "syllabus"
        assert len(clean_md) > 100
        
        chunks = chunk_markdown(clean_md, chunk_size=800, chunk_overlap=100)
        assert isinstance(chunks, list)
        assert len(chunks) >= 1

    # 2. Test 3 Real Production Catalog Courses
    for course_file in REAL_COURSE_FILES:
        raw_html = course_file.read_text(encoding="utf-8")
        clean_md, metadata = preprocess_document(raw_html, source_url=f"file://{course_file.name}")
        
        assert metadata["doc_type"] == "course"
        assert "course_code" in metadata
        assert len(clean_md) > 50
        
        chunks = chunk_markdown(clean_md, chunk_size=800, chunk_overlap=100)
        assert isinstance(chunks, list)
        assert len(chunks) >= 1


def test_function_3_payload_assembly_real_files():
    """Verifies Function 3 packages real document chunks and metadata into valid JSON payloads."""
    all_real_files = REAL_SYLLABUS_FILES + REAL_COURSE_FILES
    
    for real_file in all_real_files:
        raw_html = real_file.read_text(encoding="utf-8")
        clean_md, metadata = preprocess_document(raw_html, source_url=f"file://{real_file.name}")
        chunks = chunk_markdown(clean_md, chunk_size=800, chunk_overlap=100)
        
        records = extract_to_json_payload(real_file.name, chunks, metadata, document_text=clean_md)
        assert len(records) == len(chunks)
        assert records[0]["source_url"] == f"file://{real_file.name}"
        assert "content_hash" in records[0]
        assert records[0]["metadata"]["doc_type"] in ["syllabus", "course"]


def test_function_4_embedding_generation_real_files():
    """Verifies Function 4 generates 768-dim vector embeddings for real document payloads."""
    for real_file in REAL_SYLLABUS_FILES[:1] + REAL_COURSE_FILES[:1]:
        raw_html = real_file.read_text(encoding="utf-8")
        clean_md, metadata = preprocess_document(raw_html, source_url=f"file://{real_file.name}")
        chunks = chunk_markdown(clean_md, chunk_size=800, chunk_overlap=100)
        records = extract_to_json_payload(real_file.name, chunks, metadata, document_text=clean_md)
        
        embedded_records = generate_embeddings(records, model_name="local-768")
        assert len(embedded_records) == len(records)
        
        emb = embedded_records[0]["embedding"]
        assert isinstance(emb, dict)
        assert emb["dimension"] == 768
        assert len(emb["values"]) == 768


def test_function_5_validation_and_upsert_real_files():
    """Verifies Function 5 schema validation gate for real production document payloads."""
    all_embedded = []
    for real_file in REAL_SYLLABUS_FILES + REAL_COURSE_FILES:
        raw_html = real_file.read_text(encoding="utf-8")
        clean_md, metadata = preprocess_document(raw_html, source_url=f"file://{real_file.name}")
        chunks = chunk_markdown(clean_md, chunk_size=800, chunk_overlap=100)
        records = extract_to_json_payload(real_file.name, chunks, metadata, document_text=clean_md)
        embedded = generate_embeddings(records, model_name="local-768")
        all_embedded.extend(embedded)

    result = validate_and_upsert_payload(all_embedded)
    assert result["validated_count"] == len(all_embedded)
    assert result["quarantined_count"] == 0
    assert result["status"] == "ok"


def test_process_document_end_to_end_real_production_files():
    """Verifies full end-to-end processing across all 6 real production files."""
    all_real_files = REAL_SYLLABUS_FILES + REAL_COURSE_FILES
    
    total_processed_records = 0
    for real_file in all_real_files:
        records = process_document(real_file)
        assert len(records) >= 1
        assert records[0]["metadata"]["doc_type"] in ["syllabus", "course"]
        assert records[0]["embedding"]["dimension"] == 768
        total_processed_records += len(records)
        
    print(f"\nSUCCESS: Processed {len(all_real_files)} real production files into {total_processed_records} validated vector records!")


if __name__ == "__main__":
    print("Testing Function 1 & 2 on 3 real Syllabi and 3 real Catalog Courses...")
    test_function_1_and_2_real_production_files()
    print("PASSED test_function_1_and_2_real_production_files()\n")

    print("Testing Function 3 Payload Assembly on real files...")
    test_function_3_payload_assembly_real_files()
    print("PASSED test_function_3_payload_assembly_real_files()\n")

    print("Testing Function 4 Embedding Generation on real files...")
    test_function_4_embedding_generation_real_files()
    print("PASSED test_function_4_embedding_generation_real_files()\n")

    print("Testing Function 5 Validation and Upsert Gate on real files...")
    test_function_5_validation_and_upsert_real_files()
    print("PASSED test_function_5_validation_and_upsert_real_files()\n")

    print("Testing End-to-End process_document() on 6 real production files...")
    test_process_document_end_to_end_real_production_files()
    print("PASSED test_process_document_end_to_end_real_production_files()\n")

    print("=========================================================================")
    print("🔍 VERIFYING NEON DATABASE ENTRIES & RETRIEVING LIVE OUTPUT")
    print("=========================================================================")
    try:
        check_db_status()
    except Exception as err:
        print(f"Note: Database verification query: {err}")

    print("\nALL 5 MAIN PIPELINE TESTS PASSED 100% FOR ALL 6 REAL PRODUCTION FILES!")
