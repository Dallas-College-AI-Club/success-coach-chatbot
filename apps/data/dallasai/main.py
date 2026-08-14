"""
===============================================================================
5-Function Local Data Processing & Ingestion Orchestrator (< 200 Lines)
===============================================================================
Author: Antigravity AI / Neftali
Project: Success Coach Chatbot (Issue #91 / Issue #128 Harmonization)

5-Function Architecture:
  - Function 1: Document Preprocessing (preprocess_document)
  - Function 2: Semantic Markdown Chunking (chunk_markdown)
  - Function 3: JSON Payload Assembly (extract_to_json_payload)
  - Function 4: Vector Embedding Generator (generate_embeddings)
  - Function 5: Validation Gate & Database Upsert (validate_and_upsert_payload)

Strict Dependency Policy:
  - Requires sentence-transformers and psycopg (v3). Refuses dummy zero vectors.
  - If required dependencies are missing, raises an explicit exception instructing
    the developer to execute 'uv sync' in apps/data.
===============================================================================
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
<<<<<<< HEAD
=======
import time
>>>>>>> upstream/main
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

<<<<<<< HEAD
MAIN_DIR = Path(__file__).resolve().parent
SYS_DATA_DIR = MAIN_DIR.parent / "apps" / "data" if MAIN_DIR.name == ".tmp" else MAIN_DIR.parent
=======
from dallasai.embedding import embed

# Auto-inject apps/data directory into Python path
SYS_DATA_DIR = Path(__file__).resolve().parent.parent
>>>>>>> upstream/main
if str(SYS_DATA_DIR) not in sys.path:
    sys.path.insert(0, str(SYS_DATA_DIR))
if str(MAIN_DIR) not in sys.path:
    sys.path.insert(0, str(MAIN_DIR))

from dotenv import load_dotenv
load_dotenv(SYS_DATA_DIR / ".env")

from bs4 import BeautifulSoup
try:
    if MAIN_DIR.name == ".tmp" and (MAIN_DIR / "embedding.py").exists():
        import embedding
        embed = embedding.embed
    else:
        from dallasai.embedding import embed
except (ImportError, ModuleNotFoundError) as err:
    raise ImportError(
        "Required dependencies (sentence-transformers) are not installed or failed to import. "
        "Please run 'uv sync' in the 'apps/data' directory to install required dependencies."
    ) from err

try:
    if MAIN_DIR.name == ".tmp" and (MAIN_DIR / "markdown_converter.py").exists():
        from markdown_converter import MarkdownConverter
    else:
        from dallasai.markdown_converter import MarkdownConverter
    if MAIN_DIR.name == ".tmp" and (MAIN_DIR / "semantic_chunker.py").exists():
        from semantic_chunker import SemanticChunker
    else:
        from dallasai.semantic_chunker import SemanticChunker
except (ImportError, ModuleNotFoundError) as err:
    from dallasai.markdown_converter import MarkdownConverter
    from dallasai.semantic_chunker import SemanticChunker

VALID_DOC_TYPES = {"course", "section", "program_map", "syllabus", "cv"}
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
DIMS = 384


def parse_frontmatter(text: str) -> Tuple[Dict[str, Any], str]:
    """Parse YAML frontmatter header from pre-converted Markdown files."""
    if not text.startswith("---"):
        return {}, text
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not m:
        return {}, text
    meta: Dict[str, Any] = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip().strip('"\'')
    return meta, text[m.end():]


def infer_doc_type(path_str: str, text: str) -> str:
    """Infer document type from file path, DOM elements, or text structure."""
    lp, lt = path_str.lower(), text[:1000].lower()
    if "course" in lp or "coid=" in lt or "course_preview_title" in lt:
        return "course"
    if "section" in lp or "crn" in lt or "meeting_times" in lt:
        return "section"
    if "program" in lp or "poid=" in lt or "degree plan" in lt:
        return "program_map"
    if "cv" in lp or "curriculum vitae" in lt or "resume" in lt:
        return "cv"
    return "syllabus"


def resolve_canonical_url(
    source_url: str = "",
    doc_type: str = "syllabus",
    metadata: Optional[Dict[str, Any]] = None,
    raw_html: str = "",
    file_name: str = "",
) -> str:
    """Resolves local file paths or fallbacks to web-accessible Dallas College HTTPS URLs."""
    meta = metadata or {}

    if source_url and (source_url.startswith("http://") or source_url.startswith("https://")):
        return source_url

    meta_url = meta.get("source_url") or meta.get("canonical_url") or meta.get("url")
    if meta_url and (str(meta_url).startswith("http://") or str(meta_url).startswith("https://")):
        return str(meta_url)

    if raw_html:
        try:
            soup = BeautifulSoup(raw_html[:4000], "html.parser")
            canon = soup.find("link", attrs={"rel": re.compile(r"canonical", re.I)})
            if canon and canon.get("href") and canon["href"].startswith("http"):
                return canon["href"]
            og_url = soup.find("meta", attrs={"property": re.compile(r"og:url", re.I)})
            if og_url and og_url.get("content") and og_url["content"].startswith("http"):
                return og_url["content"]
        except Exception:
            pass

    stem = Path(source_url or file_name).stem if (source_url or file_name) else ""
    numeric_id_match = re.search(r"(\d+)", stem)
    numeric_id = numeric_id_match.group(1) if numeric_id_match else ""

    if doc_type == "course":
        coid = meta.get("coid") or numeric_id
        if coid:
            return f"https://catalog.dallascollege.edu/preview_course_nopop.php?catoid=5&coid={coid}"
        return "https://catalog.dallascollege.edu"

    if doc_type == "program_map":
        poid = meta.get("poid") or numeric_id
        if poid:
            return f"https://catalog.dallascollege.edu/preview_program.php?catoid=5&poid={poid}"
        return "https://catalog.dallascollege.edu"

    if doc_type == "syllabus":
        concourse_id = meta.get("concourse_id") or numeric_id
        if concourse_id and concourse_id != "UNKNOWN":
            return f"https://concourse.dallascollege.edu/syllabus/view/{concourse_id}"
        return "https://concourse.dallascollege.edu"

    if doc_type == "cv":
        cv_id = meta.get("cv_id") or numeric_id
        if cv_id and cv_id != "UNKNOWN":
            return f"https://concourse.dallascollege.edu/cv/view/{cv_id}"
        return "https://concourse.dallascollege.edu"

    return "https://www.dallascollege.edu"


# FUNCTION 1: Preprocessing & HTML DOM Cleaning (Separated)
def preprocess_document(raw_html: str, source_url: str = "") -> Tuple[str, Dict[str, Any]]:
    """Function 1: Cleans HTML DOM and extracts Markdown & canonical metadata."""
    conv = MarkdownConverter()
    clean_md, clean_html = conv.clean_html_and_markdown(raw_html, source_url=source_url)
    dt = infer_doc_type(source_url, raw_html)
    soup_raw = BeautifulSoup(raw_html, "html.parser")
    soup_clean = BeautifulSoup(clean_html, "html.parser")

    if dt == "course":
        meta = conv.extract_catalog_course_metadata(soup_raw, source_url=source_url)
    else:
        meta = conv.extract_metadata_from_html(soup_clean, clean_md, source_url=source_url)

    canonical_url = resolve_canonical_url(source_url=source_url, doc_type=dt, metadata=meta, raw_html=raw_html)
    meta.update({"doc_type": dt, "source_url": canonical_url, "module": "degree_planning"})
    return clean_md, meta


# FUNCTION 2: Semantic Markdown Chunking
<<<<<<< HEAD
def chunk_markdown(clean_md: str, size: int = 800, overlap: int = 100) -> List[str]:
=======
def chunk_markdown(
    clean_md: str, chunk_size: int = 800, chunk_overlap: int = 100
) -> List[str]:
>>>>>>> upstream/main
    """Function 2: Breaks Clean Markdown into semantically meaningful section chunks."""
    if not clean_md.strip():
        return []
    chunks = SemanticChunker(chunk_size=size, chunk_overlap=overlap).chunk_markdown(clean_md)
    return [c["content"] for c in chunks] if chunks else [clean_md]


# FUNCTION 3: JSON Payload Extraction Assembly
def extract_to_json_payload(
    file_name: str,
    chunks: List[str],
<<<<<<< HEAD
    meta: Dict[str, Any],
    facts: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """Function 3: Combines chunks, metadata, and facts into canonical JSON payloads."""
=======
    metadata: Dict[str, Any],
    facts: Optional[Dict[str, Any]] = None,
    document_text: str = "",
) -> List[Dict[str, Any]]:
    """Function 3: Combines chunks, metadata, and facts into Issue #61 JSON payloads with SHA-256 hashes."""
    from dallasai.pipeline.extract import extract

    doc_type = metadata.get("doc_type", "syllabus")

    if facts is None:
        if document_text and doc_type in ["syllabus", "course", "program_map", "cv"]:
            try:
                result = extract(doc_type, document_text, context=metadata)
                facts = (
                    result.data
                    if result.status in ["ok", "needs_review"] and result.data
                    else {}
                )
            except (Exception, SystemExit) as e:
                print(f"   [warn] extraction unavailable ({type(e).__name__}): {e}")
                facts = {}

    # Empty facts must FAIL the Function 5 gate — never fabricate a fallback (issue #128).
    facts = facts or {}

>>>>>>> upstream/main
    scraped_at = datetime.now(timezone.utc).isoformat()
    dt = meta.get("doc_type", "syllabus")
    src = resolve_canonical_url(source_url=meta.get("source_url", ""), doc_type=dt, metadata=meta, file_name=file_name)
    recs: List[Dict[str, Any]] = []

    for idx, text in enumerate(chunks):
        canon = json.dumps({"t": text, "f": facts or {}, "m": meta}, sort_keys=True, separators=(",", ":"))
        h = hashlib.sha256(canon.encode("utf-8")).hexdigest()
        recs.append({
            "source_url": src,
            "chunk_index": idx,
            "content_hash": h,
            "scraped_at": scraped_at,
<<<<<<< HEAD
            "chunk_text": text,
            "metadata": meta,
            "facts": facts or {},
            "embedding": []
        })
    return recs


# FUNCTION 4: Pluggable Vector Embedding Generator (384-dim, Strict Guard)
def generate_embeddings(records: List[Dict[str, Any]], embedder: Optional[Any] = None) -> List[Dict[str, Any]]:
    """Function 4: Populates 384-dim vector embeddings via all-MiniLM-L6-v2."""
    fn = embedder or embed
    for idx, r in enumerate(records):
        try:
            vec = fn(r["chunk_text"])
        except Exception as err:
            raise RuntimeError(
                f"Failed generating vector embedding at index {idx} in {r.get('source_url')}. "
                f"Ensure dependencies are installed via 'uv sync'. Details: {err}"
            ) from err

        vec_list = vec.tolist() if hasattr(vec, "tolist") else list(vec)

        if not vec_list or all(v == 0.0 for v in vec_list):
            raise ValueError(f"FATAL: Refusing dummy zero-vector at index {idx} in {r.get('source_url')}")
        if len(vec_list) != DIMS:
            raise ValueError(f"FATAL: Vector dim error: got {len(vec_list)}, expected {DIMS}")

        r["embedding"] = vec_list
        r["metadata"]["embedding_model"] = MODEL_NAME
        r["metadata"]["embedding_dimensions"] = DIMS
=======
            "chunk_text": chunk_text,
            "metadata": metadata,
            "facts": facts,
            "embedding": [],
        }
        records.append(record)
    return records


# FUNCTION 4: Pluggable Vector Embedding Generator
def generate_embeddings(
    records: List[Dict[str, Any]],
    embedder_func: Optional[Any] = embed,
    model_name: str = "local-768",
) -> List[Dict[str, Any]]:
    """Function 4: Populates 768-dim float vector list into record['embedding'].

    Output format matches upstream embed_rows.py (branch 99):
      record['embedding'] = [float, float, ...]  (flat list, 768 dims)
      record['metadata']['embedding_model'] = model_name
      record['metadata']['embedding_dimensions'] = 768
    """
    for record in records:
        chunk_text = record.get("chunk_text", "")
        vector_values = (
            embedder_func(chunk_text) if callable(embedder_func) else [0.0] * 768
        )
        record["embedding"] = vector_values
        record["metadata"]["embedding_model"] = model_name
        record["metadata"]["embedding_dimensions"] = len(vector_values)
>>>>>>> upstream/main
    return records


# FUNCTION 5: Schema Validation Gate & Database Upsert
<<<<<<< HEAD
def validate_and_upsert_payload(records: List[Dict[str, Any]], load_to_db: bool = True) -> Dict[str, Any]:
=======
def validate_and_upsert_payload(
    records: List[Dict[str, Any]], db_session: Optional[Any] = None
) -> Dict[str, Any]:
>>>>>>> upstream/main
    """Function 5: Schema validation gate & Neon PostgreSQL database upserts."""
    valid, quant = [], []
    for r in records:
        dt = r.get("metadata", {}).get("doc_type")
        if r.get("source_url") and isinstance(r.get("chunk_index"), int) and r.get("chunk_text") and dt in VALID_DOC_TYPES:
            valid.append(r)
        else:
            quant.append(r)

    upserted = 0
    if valid and load_to_db:
        try:
            from dallasai.load_catalog_to_neon import load_into_neon
<<<<<<< HEAD
            load_into_neon(rows=valid, batch_size=100)
            upserted = len(valid)
=======

            load_into_neon(rows=validated_records, batch_size=100)
            upserted = len(validated_records)
>>>>>>> upstream/main
        except Exception as err:
            print(f"Function 5 Upsert Note: {err}")

    return {
<<<<<<< HEAD
        "status": "ok" if not quant else "partial_quarantine",
        "validated_count": len(valid),
        "quarantined_count": len(quant),
        "upserted_count": upserted
    }


def load_md_file(path: Path) -> Tuple[str, Dict[str, Any]]:
    """Fast load pre-processed .md files (Separates preprocessing from extraction)."""
    raw = path.read_text(encoding="utf-8", errors="ignore")
    meta, body = parse_frontmatter(raw)
    dt = meta.get("doc_type") or infer_doc_type(str(path), raw)
    meta["doc_type"] = dt
    meta["source_url"] = resolve_canonical_url(
        source_url=meta.get("source_url", ""),
        doc_type=dt,
        metadata=meta,
        file_name=path.name,
    )
    meta.setdefault("module", "degree_planning")
    return body, meta


def find_dataset_files(input_dir: Path) -> List[Path]:
    """Find all .md, .markdown, and .html files recursively in input_dir."""
    if input_dir.is_file():
        return [input_dir]
    files: List[Path] = []
    for p in input_dir.rglob("*"):
        if p.is_file() and p.suffix.lower() in [".md", ".markdown", ".html"]:
            if not any(part.startswith(".") for part in p.parts):
                files.append(p)
    return files


def process_directory(input_dir: Path, output_dir: Path, load_db: bool = True) -> List[Dict[str, Any]]:
    """Directory Pipeline Orchestrator (Processes files recursively and generates deliverable rows.json)."""
    output_dir.mkdir(parents=True, exist_ok=True)
    files = find_dataset_files(input_dir)
    all_rows: List[Dict[str, Any]] = []

    print(f"\n=========================================================================")
    print(f"Starting 5-Function Orchestrator: {len(files)} dataset files -> {output_dir}")
    print(f"Model: {MODEL_NAME} ({DIMS} dims) | Database Upsert: {load_db}")
    print(f"=========================================================================\n")

    for idx, f in enumerate(files, start=1):
        if f.suffix.lower() in [".md", ".markdown"]:
            body, meta = load_md_file(f)
        else:
            body, meta = preprocess_document(f.read_text(encoding="utf-8", errors="ignore"), str(f))

        chunks = chunk_markdown(body)
        records = extract_to_json_payload(f.name, chunks, meta)
        records = generate_embeddings(records)
        gate = validate_and_upsert_payload(records, load_to_db=load_db)
        all_rows.extend(records)

        (output_dir / f"{f.stem}_payload.json").write_text(json.dumps(records, indent=2), encoding="utf-8")

        if idx % 10 == 0 or idx == len(files):
            print(f"Processed {idx}/{len(files)} files ({len(all_rows)} total chunk records)...")

    # Generate single deliverable rows.json for team handoff
    rows_json_path = output_dir / "rows.json"
    rows_json_path.write_text(json.dumps(all_rows, indent=2), encoding="utf-8")

    print(f"\n=========================================================================")
    print(f"Ingestion Complete! Total {len(all_rows)} rows processed and upserted.")
    print(f"Deliverable output generated at: '{rows_json_path}'")
    print(f"=========================================================================\n")
    return all_rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Simplified 5-Function Data Processing CLI (< 200 lines)")
    parser.add_argument("-i", "--input", type=Path, default=SYS_DATA_DIR / "sample_data", help="Input directory")
    parser.add_argument("-o", "--output", type=Path, default=SYS_DATA_DIR.parent.parent / ".tmp" / "deliverable_output", help="Output directory")
    parser.add_argument("--no-db", action="store_true", help="Run extraction & payload creation without uploading to Neon DB")
=======
        "status": "ok" if not quarantined_records else "partial_quarantine",
        "validated_count": len(validated_records),
        "quarantined_count": len(quarantined_records),
        "upserted_count": upserted,
    }


def _read_and_clean_single_file(file_path: Path) -> Optional[Dict[str, Any]]:
    """Function 1: Preprocesses document into clean Markdown and metadata."""
    try:
        raw_text = file_path.read_text(encoding="utf-8", errors="ignore")
        if file_path.suffix.lower() in [".md", ".markdown"]:
            metadata, clean_md = parse_markdown_frontmatter(raw_text)
            metadata.setdefault("source_url", f"file://{file_path.name}")
            metadata["doc_type"] = metadata.get("document_type", "syllabus")
        else:
            clean_md, metadata = preprocess_document(
                raw_text, source_url=str(file_path)
            )

        return {"file_path": file_path, "clean_md": clean_md, "metadata": metadata}
    except Exception:
        return None


def process_document(file_path: Path) -> List[Dict[str, Any]]:
    """Single document pipeline execution across 5 functions."""
    res = _read_and_clean_single_file(file_path)
    if not res:
        return []
    chunks = chunk_markdown(res["clean_md"])
    records = extract_to_json_payload(
        res["file_path"].name, chunks, res["metadata"], document_text=res["clean_md"]
    )
    records = generate_embeddings(records)
    _ = validate_and_upsert_payload(records)
    return records


def process_directory(
    input_dir: Path, output_dir: Path, workers: int = 1, start_stage: int = 2
) -> List[Path]:
    """DIRECTORY PIPELINE ORCHESTRATOR (5 STAGES WITH INDIVIDUAL PROGRESS BARS)"""
    if not input_dir.exists():
        raise FileNotFoundError(f"Input directory does not exist: {input_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)

    # Gather Markdown (.md) or HTML (.html) files
    input_files = list(input_dir.glob("*.md")) + list(input_dir.glob("*.markdown"))
    if not input_files:
        input_files = list(input_dir.glob("*.html"))

    total_files = len(input_files)

    print("\n=========================================================================")
    print(
        f"🚀 Starting 5-Function Ingestion Engine: {total_files} files (Stage {start_stage} ➔ 5)"
    )
    print("=========================================================================\n")

    try:
        from tqdm import tqdm

        has_tqdm = True
    except ImportError:
        has_tqdm = False

    # STAGE 1: Function 1 - Preprocessing (HTML -> Markdown)
    clean_docs = []
    if start_stage <= 1:
        print("Stage 1/5 🧹 Function 1: Preprocessing & HTML Cleaning")
        stage1_start = time.time()
        file_iterator = (
            tqdm(input_files, desc="Function 1 (Preprocessing)", unit="doc")
            if has_tqdm
            else input_files
        )
        for idx, file_path in enumerate(file_iterator, start=1):
            res = _read_and_clean_single_file(file_path)
            if res:
                clean_docs.append(res)
            if not has_tqdm:
                _render_ascii_bar(idx, total_files, stage1_start, "Preprocessing")
        if not has_tqdm and total_files > 0:
            print()
    else:
        print(
            "Stage 1/5 ⏩ Function 1 Skipped: Input files are pre-converted Markdown! (Fast disk load)"
        )
        stage1_start = time.time()
        file_iterator = (
            tqdm(input_files, desc="Fast Loading (.md Files)", unit="doc")
            if has_tqdm
            else input_files
        )
        for idx, file_path in enumerate(file_iterator, start=1):
            try:
                raw_text = file_path.read_text(encoding="utf-8", errors="ignore")
                metadata, clean_md = parse_markdown_frontmatter(raw_text)
                metadata.setdefault("source_url", f"file://{file_path.name}")
                metadata["doc_type"] = metadata.get("document_type", "syllabus")

                clean_docs.append(
                    {"file_path": file_path, "clean_md": clean_md, "metadata": metadata}
                )
            except Exception:
                pass
            if not has_tqdm:
                _render_ascii_bar(idx, total_files, stage1_start, "Fast Loading .md")
        if not has_tqdm and total_files > 0:
            print()

    # STAGE 2: Function 2 - Semantic Markdown Chunking
    print("\nStage 2/5 ✂️  Function 2: Semantic Markdown Chunking")
    file_docs = []
    stage2_start = time.time()
    chunk_iterator = (
        tqdm(clean_docs, desc="Function 2 (Chunking)", unit="doc")
        if has_tqdm
        else clean_docs
    )
    for idx, doc in enumerate(chunk_iterator, start=1):
        chunks = chunk_markdown(doc["clean_md"])
        doc["chunks"] = chunks
        file_docs.append(doc)
        if not has_tqdm:
            _render_ascii_bar(idx, len(clean_docs), stage2_start, "Chunking")
    if not has_tqdm and clean_docs:
        print()

    # STAGE 3: Function 3 - JSON Payload Extraction
    print("\nStage 3/5 📄 Function 3: JSON Payload Extraction")
    extracted_doc_records = []
    stage3_start = time.time()
    extract_iterator = (
        tqdm(file_docs, desc="Function 3 (Payloads)", unit="doc")
        if has_tqdm
        else file_docs
    )
    for idx, doc in enumerate(extract_iterator, start=1):
        records = extract_to_json_payload(
            doc["file_path"].name,
            doc["chunks"],
            doc["metadata"],
            document_text=doc["clean_md"],
        )
        extracted_doc_records.append((doc["file_path"], records))
        if not has_tqdm:
            _render_ascii_bar(idx, len(file_docs), stage3_start, "Payloads")
    if not has_tqdm and file_docs:
        print()

    # STAGE 4: Function 4 - Vector Embeddings
    print("\nStage 4/5 🧠 Function 4: Pluggable 768-dim Vector Embeddings")
    embedded_doc_records = []
    stage4_start = time.time()
    embed_iterator = (
        tqdm(extracted_doc_records, desc="Function 4 (Embedding)", unit="doc")
        if has_tqdm
        else extracted_doc_records
    )
    for idx, (file_path, records) in enumerate(embed_iterator, start=1):
        records = generate_embeddings(records)
        embedded_doc_records.append((file_path, records))
        if not has_tqdm:
            _render_ascii_bar(
                idx, len(extracted_doc_records), stage4_start, "Embedding"
            )
    if not has_tqdm and extracted_doc_records:
        print()

    # STAGE 5: Function 5 - Validation Gate & Output Persistence
    print("\nStage 5/5 ✅ Function 5: Schema Validation Gate & Staging Output")
    generated_json_files = []
    total_validated = total_quarantined = total_upserted = 0
    stage5_start = time.time()
    valid_iterator = (
        tqdm(embedded_doc_records, desc="Function 5 (Validating)", unit="doc")
        if has_tqdm
        else embedded_doc_records
    )
    for idx, (file_path, records) in enumerate(valid_iterator, start=1):
        gate = validate_and_upsert_payload(records)
        total_validated += gate["validated_count"]
        total_quarantined += gate["quarantined_count"]
        total_upserted += gate["upserted_count"]
        output_file = output_dir / f"{file_path.stem}_payload.json"
        output_file.write_text(json.dumps(records, indent=2), encoding="utf-8")
        generated_json_files.append(output_file)
        if not has_tqdm:
            _render_ascii_bar(
                idx, len(embedded_doc_records), stage5_start, "Validating"
            )
    if not has_tqdm and embedded_doc_records:
        print()

    print("\n=========================================================================")
    print(
        f"✅ 5-Stage Ingestion Complete! Created {len(generated_json_files)} JSON payloads in: '{output_dir}'."
    )
    print(
        f"   Gate: {total_validated} validated · {total_quarantined} quarantined · {total_upserted} upserted to Neon"
    )
    print("=========================================================================\n")
    return generated_json_files


def parse_args() -> argparse.Namespace:
    """CLI flags parser."""
    parser = argparse.ArgumentParser(description="5-Function Data Processing CLI")
    parser.add_argument(
        "-i",
        "--input",
        type=Path,
        required=False,
        default=Path(__file__).resolve().parent.parent / "sample_data" / "syllabi",
        help="Path to directory containing input Markdown or HTML files.",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        required=False,
        default=Path(__file__).resolve().parent.parent.parent.parent
        / ".tmp"
        / "chunk_ready",
        help="Path to temporary output staging directory.",
    )
    parser.add_argument(
        "-w",
        "--workers",
        type=int,
        required=False,
        default=1,
        help="Number of CPU worker processes (default: 1).",
    )
    parser.add_argument(
        "-s",
        "--stage",
        type=int,
        choices=[1, 2, 3, 4, 5],
        default=2,
        help="Select starting pipeline stage (1: Preprocess HTML/MD, 2: Chunk Markdown [default], 3: Extract Payload, 4: Embed, 5: Validate & Upsert).",
    )
>>>>>>> upstream/main
    return parser.parse_args()


def main() -> None:
    args = parse_args()
<<<<<<< HEAD
    process_directory(args.input, args.output, load_db=not args.no_db)
=======
    process_directory(
        args.input, args.output, workers=args.workers, start_stage=args.stage
    )
>>>>>>> upstream/main


if __name__ == "__main__":
    main()
