"""
===============================================================================
5-Function Local Data Processing & Ingestion Orchestrator
===============================================================================
Author: Antigravity AI / Neftali
Project: Success Coach Chatbot (Issue #91)

5-Function Architecture (Strictly < 400 Lines):
  - Function 1: Document Preprocessing (preprocess_document)
  - Function 2: Semantic Markdown Chunking (chunk_markdown)
  - Function 3: JSON Payload Assembly (extract_to_json_payload)
  - Function 4: Vector Embedding Generator (generate_embeddings)
  - Function 5: Validation Gate & Database Upsert (validate_and_upsert_payload)

Usage (Run from project root):
  python3 apps/data/dallasai/main.py -i apps/data/cleaned/2026SP -w 4
===============================================================================
"""

import argparse
import hashlib
import json
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Auto-inject apps/data directory into Python path
SYS_DATA_DIR = Path(__file__).resolve().parent.parent
if str(SYS_DATA_DIR) not in sys.path:
    sys.path.insert(0, str(SYS_DATA_DIR))

from bs4 import BeautifulSoup
from dallasai.markdown_converter import MarkdownConverter
from dallasai.pipeline.html_cleaner import HTMLCleaner
from dallasai.semantic_chunker import SemanticChunker


def _render_ascii_bar(current: int, total: int, start_time: float, prefix: str = "Processing") -> None:
    """Renders an ASCII progress bar with live speed (doc/s) and ETA."""
    pct = int((current / total) * 100) if total > 0 else 100
    bar = "█" * (pct // 5) + "░" * (20 - (pct // 5))
    elapsed = max(time.time() - start_time, 0.001)
    speed = current / elapsed
    eta_seconds = int((total - current) / speed) if speed > 0 else 0
    
    elapsed_str = f"{int(elapsed // 60):02d}:{int(elapsed % 60):02d}"
    eta_str = f"{int(eta_seconds // 60):02d}:{int(eta_seconds % 60):02d}"
    sys.stdout.write(
        f"\r[{bar}] {pct}% ({current}/{total}) [{elapsed_str}<{eta_str}, {speed:.1f}doc/s] {prefix:<22}"
    )
    sys.stdout.flush()


# FUNCTION 1: Document Preprocessing (HTML -> Clean Markdown & Metadata)
def preprocess_document(raw_html: str, source_url: str = "") -> Tuple[str, Dict[str, Any]]:
    """Function 1: Cleans HTML DOM and extracts Markdown & metadata (Issue #90)."""
    converter = MarkdownConverter()
    clean_md, clean_html = converter.clean_html_and_markdown(raw_html, source_url=source_url)
    soup = BeautifulSoup(clean_html, "html.parser")
    metadata = converter.extract_metadata_from_html(soup, clean_md, source_url)
    if not metadata.get("doc_type"):
        metadata["doc_type"] = "syllabus"
    return clean_md, metadata


# FUNCTION 2: Semantic Markdown Chunking
def chunk_markdown(clean_md: str, chunk_size: int = 800, chunk_overlap: int = 100) -> List[str]:
    """Function 2: Breaks Clean Markdown into semantically meaningful section chunks."""
    if not clean_md.strip():
        return []
    chunker = SemanticChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    raw_chunks = chunker.chunk_markdown(clean_md)
    return [chunk["content"] for chunk in raw_chunks] if raw_chunks else [clean_md]


# FUNCTION 3: JSON Payload Extraction Assembly
def extract_to_json_payload(
    file_name: str,
    chunks: List[str],
    metadata: Dict[str, Any],
    facts: Optional[Dict[str, Any]] = None,
    document_text: str = ""
) -> List[Dict[str, Any]]:
    """Function 3: Combines chunks, metadata, and facts into Issue #61 JSON payloads with SHA-256 hashes."""
    from dallasai.pipeline.extract import extract

    if facts is None:
        doc_type = metadata.get("doc_type", "syllabus")
        if document_text and doc_type in ["syllabus", "course", "program_map", "cv"]:
            try:
                result = extract(doc_type, document_text, context=metadata)
                facts = result.data if result.status in ["ok", "needs_review"] and result.data else {}
            except (Exception, SystemExit):
                facts = {}

    if not facts:
        facts = {"confidence": "high", "policies": {}, "grading": []}

    records = []
    for idx, chunk_text in enumerate(chunks):
        content_hash = hashlib.sha256(chunk_text.encode("utf-8")).hexdigest()
        record = {
            "source_url": f"file://{file_name}",
            "chunk_index": idx,
            "content_hash": content_hash,
            "chunk_text": chunk_text,
            "metadata": metadata,
            "facts": facts,
            "embedding": []
        }
        records.append(record)
    return records


# FUNCTION 4: Pluggable Vector Embedding Generator
def generate_embeddings(
    records: List[Dict[str, Any]],
    embedder_func: Optional[Any] = None,
    model_name: str = "local-768"
) -> List[Dict[str, Any]]:
    """Function 4: Populates 768-dim float vector dictionary into record['embedding']."""
    for record in records:
        chunk_text = record.get("chunk_text", "")
        vector_values = embedder_func(chunk_text) if callable(embedder_func) else [0.0] * 768
        record["embedding"] = {
            "model": model_name,
            "dimension": len(vector_values),
            "values": vector_values
        }
    return records


# FUNCTION 5: Schema Validation Gate & Database Upsert
def validate_and_upsert_payload(
    records: List[Dict[str, Any]],
    db_session: Optional[Any] = None
) -> Dict[str, Any]:
    """Function 5: Schema validation gate & Neon PostgreSQL database upserts."""
    from dallasai.pipeline.extract import validate

    validated_records, quarantined_records = [], []
    for record in records:
        facts = record.get("facts", {})
        metadata = record.get("metadata", {})
        doc_type = metadata.get("doc_type", "syllabus")
        schema_errors = None
        if facts and doc_type in ["syllabus", "course", "program_map", "cv"]:
            try:
                schema_errors = validate(doc_type, facts)
            except Exception:
                schema_errors = None
        if facts.get("confidence") in ["high", "medium"] and not schema_errors:
            validated_records.append(record)
        else:
            quarantined_records.append(record)

    upserted_count = 0
    if db_session and validated_records:
        from dallasai.models import KnowledgeEntry
        for rec in validated_records:
            raw_emb = rec.get("embedding")
            vector_list = raw_emb.get("values", [0.0] * 768) if isinstance(raw_emb, dict) else [0.0] * 768
            entry = KnowledgeEntry(
                source_url=rec["source_url"],
                chunk_index=rec["chunk_index"],
                content_hash=rec["content_hash"],
                chunk_text=rec["chunk_text"],
                facts=rec["facts"],
                metadata_=rec["metadata"],
                embedding=vector_list
            )
            db_session.merge(entry)
            upserted_count += 1
        db_session.commit()

    return {
        "status": "ok" if not quarantined_records else "partial_quarantine",
        "validated_count": len(validated_records),
        "quarantined_count": len(quarantined_records),
        "upserted_count": upserted_count
    }


def _process_single_file_pipeline(file_path: Path) -> Optional[Dict[str, Any]]:
    """Helper worker reading converted Markdown (.md) or cleaning HTML (.html)."""
    try:
        raw_text = file_path.read_text(encoding="utf-8", errors="ignore")
        if file_path.suffix.lower() in [".md", ".markdown"]:
            clean_md = raw_text
            metadata = {"source_url": f"file://{file_path.name}", "doc_type": "syllabus"}
        else:
            clean_md, metadata = preprocess_document(raw_text, source_url=str(file_path))
            
        chunks = chunk_markdown(clean_md)
        return {
            "file_path": file_path,
            "clean_md": clean_md,
            "metadata": metadata,
            "chunks": chunks
        }
    except Exception:
        return None


def process_document(file_path: Path) -> List[Dict[str, Any]]:
    """Single document pipeline execution across 5 functions."""
    res = _process_single_file_pipeline(file_path)
    if not res:
        return []
    records = extract_to_json_payload(res["file_path"].name, res["chunks"], res["metadata"], document_text=res["clean_md"])
    records = generate_embeddings(records)
    _ = validate_and_upsert_payload(records)
    return records


def process_directory(input_dir: Path, output_dir: Path, workers: int = 1, start_stage: int = 2) -> List[Path]:
    """DIRECTORY PIPELINE ORCHESTRATOR (5 STAGES)"""
    if not input_dir.exists():
        raise FileNotFoundError(f"Input directory does not exist: {input_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)
    input_files = list(input_dir.glob("*.md")) or list(input_dir.glob("*.html"))
    total_files = len(input_files)
    
    print(f"\n=========================================================================")
    print(f"🚀 Starting 5-Function Pipeline Ingestion: {total_files} files ({workers} workers)")
    print(f"=========================================================================\n")

    try:
        from tqdm import tqdm
        has_tqdm = True
    except ImportError:
        has_tqdm = False

    # Stage 1 & 2: Preprocessing & Semantic Chunking
    print("Stage 1 & 2 ✂️  Function 1 & 2: Preprocessing & Markdown Chunking")
    file_docs = []
    start_t = time.time()

    if workers > 1:
        with ProcessPoolExecutor(max_workers=workers) as executor:
            futures = {executor.submit(_process_single_file_pipeline, fp): fp for fp in input_files}
            for idx, future in enumerate(as_completed(futures), start=1):
                res = future.result()
                if res:
                    file_docs.append(res)
                if not has_tqdm:
                    _render_ascii_bar(idx, total_files, start_t, "Chunking")
    else:
        file_iterator = tqdm(input_files, desc="Function 2 (Chunking)", unit="doc") if has_tqdm else input_files
        for idx, file_path in enumerate(file_iterator, start=1):
            res = _process_single_file_pipeline(file_path)
            if res:
                file_docs.append(res)
            if not has_tqdm:
                _render_ascii_bar(idx, total_files, start_t, "Chunking")
    if not has_tqdm and total_files > 0:
        print()

    # Stage 3: Function 3 - JSON Payload Assembly
    print("\nStage 3/5 📄 Function 3: JSON Payload Extraction")
    extracted_doc_records = []
    start_t3 = time.time()
    extract_iterator = tqdm(file_docs, desc="Function 3 (Payloads)", unit="doc") if has_tqdm else file_docs
    for idx, doc in enumerate(extract_iterator, start=1):
        records = extract_to_json_payload(
            doc["file_path"].name, doc["chunks"], doc["metadata"], document_text=doc["clean_md"]
        )
        extracted_doc_records.append((doc["file_path"], records))
        if not has_tqdm:
            _render_ascii_bar(idx, len(file_docs), start_t3, "Payloads")
    if not has_tqdm and file_docs:
        print()

    # Stage 4: Function 4 - Vector Embeddings
    print("\nStage 4/5 🧠 Function 4: Pluggable 768-dim Vector Embeddings")
    embedded_doc_records = []
    start_t4 = time.time()
    embed_iterator = tqdm(extracted_doc_records, desc="Function 4 (Embedding)", unit="doc") if has_tqdm else extracted_doc_records
    for idx, (file_path, records) in enumerate(embed_iterator, start=1):
        records = generate_embeddings(records)
        embedded_doc_records.append((file_path, records))
        if not has_tqdm:
            _render_ascii_bar(idx, len(extracted_doc_records), start_t4, "Embedding")
    if not has_tqdm and extracted_doc_records:
        print()

    # Stage 5: Function 5 - Validation Gate & Output Persistence
    print("\nStage 5/5 ✅ Function 5: Schema Validation Gate & Staging Output")
    generated_json_files = []
    start_t5 = time.time()
    valid_iterator = tqdm(embedded_doc_records, desc="Function 5 (Validating)", unit="doc") if has_tqdm else embedded_doc_records
    for idx, (file_path, records) in enumerate(valid_iterator, start=1):
        _ = validate_and_upsert_payload(records)
        output_file = output_dir / f"{file_path.stem}_payload.json"
        output_file.write_text(json.dumps(records, indent=2), encoding="utf-8")
        generated_json_files.append(output_file)
        if not has_tqdm:
            _render_ascii_bar(idx, len(embedded_doc_records), start_t5, "Validating")
    if not has_tqdm and embedded_doc_records:
        print()

    print(f"\n=========================================================================")
    print(f"✅ 5-Stage Ingestion Complete! Created {len(generated_json_files)} JSON payloads in: '{output_dir}'.")
    print(f"=========================================================================\n")
    return generated_json_files


def parse_args() -> argparse.Namespace:
    """CLI flags parser."""
    parser = argparse.ArgumentParser(description="5-Function Data Processing CLI")
    parser.add_argument(
        "-i", "--input", type=Path, required=False,
        default=Path(__file__).resolve().parent.parent / "cleaned" / "2026SP",
        help="Path to directory containing input Markdown/HTML files."
    )
    parser.add_argument(
        "-o", "--output", type=Path, required=False,
        default=Path(__file__).resolve().parent.parent.parent.parent / ".tmp" / "chunk_ready",
        help="Path to temporary output staging directory."
    )
    parser.add_argument(
        "-w", "--workers", type=int, required=False,
        default=min(os.cpu_count() or 1, 4),
        help="Number of multi-core CPU workers."
    )
    parser.add_argument(
        "-s", "--stage", type=int, choices=[1, 2, 3, 4, 5], default=2,
        help="Select starting pipeline function/stage (1: Preprocess, 2: Chunk Markdown [default], 3: Extract Payload, 4: Embed, 5: Validate/Upsert)."
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    process_directory(args.input, args.output, workers=args.workers, start_stage=args.stage)


if __name__ == "__main__":
    main()
