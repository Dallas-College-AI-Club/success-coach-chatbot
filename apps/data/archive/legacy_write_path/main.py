"""Legacy local inspection helpers; database writes are retired.

Use the assemble -> embed_rows -> load_catalog_to_neon workflow in REPRODUCE.md
for validated deliveries. This module's --no-db output is historical/debug
material, not a production import.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from bs4 import BeautifulSoup
from dotenv import load_dotenv

from dallasai.embedding import embed
from dallasai.markdown_converter import MarkdownConverter
from dallasai.semantic_chunker import SemanticChunker

SYS_DATA_DIR = Path(__file__).resolve().parent.parent
load_dotenv(SYS_DATA_DIR / ".env")

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
            meta[k.strip()] = v.strip().strip("\"'")
    return meta, text[m.end() :]


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
    """Resolve local paths or fall back to public Dallas College HTTPS URLs."""
    meta = metadata or {}

    if source_url and (
        source_url.startswith("http://") or source_url.startswith("https://")
    ):
        return source_url

    meta_url = meta.get("source_url") or meta.get("canonical_url") or meta.get("url")
    if meta_url and (
        str(meta_url).startswith("http://") or str(meta_url).startswith("https://")
    ):
        return str(meta_url)

    if raw_html:
        try:
            soup = BeautifulSoup(raw_html[:4000], "html.parser")
            canon = soup.find("link", attrs={"rel": re.compile(r"canonical", re.I)})
            if canon and canon.get("href") and canon["href"].startswith("http"):
                return canon["href"]
            og_url = soup.find("meta", attrs={"property": re.compile(r"og:url", re.I)})
            if (
                og_url
                and og_url.get("content")
                and og_url["content"].startswith("http")
            ):
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
def preprocess_document(
    raw_html: str, source_url: str = ""
) -> Tuple[str, Dict[str, Any]]:
    """Function 1: Cleans HTML DOM and extracts Markdown & canonical metadata."""
    conv = MarkdownConverter()
    clean_md, clean_html = conv.clean_html_and_markdown(raw_html, source_url=source_url)
    dt = infer_doc_type(source_url, raw_html)
    soup_raw = BeautifulSoup(raw_html, "html.parser")
    soup_clean = BeautifulSoup(clean_html, "html.parser")

    if dt == "course":
        meta = conv.extract_catalog_course_metadata(soup_raw, source_url=source_url)
    else:
        meta = conv.extract_metadata_from_html(
            soup_clean, clean_md, source_url=source_url
        )

    canonical_url = resolve_canonical_url(
        source_url=source_url, doc_type=dt, metadata=meta, raw_html=raw_html
    )
    meta.update(
        {
            "doc_type": dt,
            "source_url": canonical_url,
            "module": "degree_planning",
        }
    )
    return clean_md, meta


# FUNCTION 2: Semantic Markdown Chunking
def chunk_markdown(clean_md: str, size: int = 800, overlap: int = 100) -> List[str]:
    """Function 2: Breaks Clean Markdown into semantically meaningful section chunks."""
    if not clean_md.strip():
        return []
    chunks = SemanticChunker(chunk_size=size, chunk_overlap=overlap).chunk_markdown(
        clean_md
    )
    return [c["content"] for c in chunks] if chunks else [clean_md]


# FUNCTION 3: JSON Payload Extraction Assembly
def extract_to_json_payload(
    file_name: str,
    chunks: List[str],
    meta: Dict[str, Any],
    facts: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Function 3: Combines chunks, metadata, and facts into canonical JSON payloads."""
    scraped_at = datetime.now(timezone.utc).isoformat()
    dt = meta.get("doc_type", "syllabus")
    src = resolve_canonical_url(
        source_url=meta.get("source_url", ""),
        doc_type=dt,
        metadata=meta,
        file_name=file_name,
    )
    recs: List[Dict[str, Any]] = []

    for idx, text in enumerate(chunks):
        canon = json.dumps(
            {"t": text, "f": facts or {}, "m": meta},
            sort_keys=True,
            separators=(",", ":"),
        )
        h = hashlib.sha256(canon.encode("utf-8")).hexdigest()
        recs.append(
            {
                "source_url": src,
                "chunk_index": idx,
                "content_hash": h,
                "scraped_at": scraped_at,
                "chunk_text": text,
                "metadata": meta,
                "facts": facts or {},
                "embedding": [],
            }
        )
    return recs


# FUNCTION 4: Pluggable Vector Embedding Generator (384-dim, Strict Guard)
def generate_embeddings(
    records: List[Dict[str, Any]], embedder: Optional[Any] = None
) -> List[Dict[str, Any]]:
    """Function 4: Populates 384-dim vector embeddings via all-MiniLM-L6-v2."""
    fn = embedder or embed
    for idx, r in enumerate(records):
        try:
            vec = fn(r["chunk_text"])
        except Exception as err:
            raise RuntimeError(
                f"Failed generating vector embedding at index {idx} "
                f"in {r.get('source_url')}. "
                f"Ensure dependencies are installed via 'uv sync'. Details: {err}"
            ) from err

        vec_list = vec.tolist() if hasattr(vec, "tolist") else list(vec)

        if not vec_list or all(v == 0.0 for v in vec_list):
            raise ValueError(
                f"FATAL: Refusing dummy zero-vector at index {idx} "
                f"in {r.get('source_url')}"
            )
        if len(vec_list) != DIMS:
            raise ValueError(
                f"FATAL: Vector dim error: got {len(vec_list)}, expected {DIMS}"
            )

        r["embedding"] = vec_list
        r["metadata"]["embedding_model"] = MODEL_NAME
        r["metadata"]["embedding_dimensions"] = DIMS
    return records


# FUNCTION 5: Schema Validation Gate & Database Upsert
def validate_and_upsert_payload(
    records: List[Dict[str, Any]], load_to_db: bool = True
) -> Dict[str, Any]:
    """Function 5: Schema validation gate & Neon PostgreSQL database upserts."""
    valid, quant = [], []
    for r in records:
        dt = r.get("metadata", {}).get("doc_type")
        if (
            r.get("source_url")
            and isinstance(r.get("chunk_index"), int)
            and r.get("chunk_text")
            and dt in VALID_DOC_TYPES
        ):
            valid.append(r)
        else:
            quant.append(r)

    upserted = 0
    if load_to_db:
        raise ValueError(
            "Legacy database writes are retired. Generate local rows with --no-db, "
            "then use dallasai.load_catalog_to_neon with reviewed counts."
        )

    return {
        "status": "ok" if not quant else "partial_quarantine",
        "validated_count": len(valid),
        "quarantined_count": len(quant),
        "upserted_count": upserted,
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


def process_directory(
    input_dir: Path, output_dir: Path, load_db: bool = True
) -> List[Dict[str, Any]]:
    """Process files recursively and generate a local rows.json delivery."""
    output_dir.mkdir(parents=True, exist_ok=True)
    files = find_dataset_files(input_dir)
    all_rows: List[Dict[str, Any]] = []

    print("\n=========================================================================")
    print(
        f"Starting 5-Function Orchestrator: {len(files)} dataset files -> {output_dir}"
    )
    print(f"Model: {MODEL_NAME} ({DIMS} dims) | Database Upsert: {load_db}")
    print("=========================================================================\n")

    for idx, f in enumerate(files, start=1):
        if f.suffix.lower() in [".md", ".markdown"]:
            body, meta = load_md_file(f)
        else:
            body, meta = preprocess_document(
                f.read_text(encoding="utf-8", errors="ignore"), str(f)
            )

        chunks = chunk_markdown(body)
        records = extract_to_json_payload(f.name, chunks, meta)
        records = generate_embeddings(records)
        gate = validate_and_upsert_payload(records, load_to_db=load_db)
        if gate["quarantined_count"]:
            raise ValueError("Local payload validation failed; no delivery completed")
        all_rows.extend(records)

        (output_dir / f"{f.stem}_payload.json").write_text(
            json.dumps(records, indent=2), encoding="utf-8"
        )

        if idx % 10 == 0 or idx == len(files):
            print(
                f"Processed {idx}/{len(files)} files "
                f"({len(all_rows)} total chunk records)..."
            )

    # Generate single deliverable rows.json for team handoff
    rows_json_path = output_dir / "rows.json"
    rows_json_path.write_text(json.dumps(all_rows, indent=2), encoding="utf-8")

    print("\n=========================================================================")
    print(f"Ingestion Complete! Total {len(all_rows)} rows prepared locally.")
    print(f"Deliverable output generated at: '{rows_json_path}'")
    print("=========================================================================\n")
    return all_rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Legacy local extraction; never writes a database"
    )
    parser.add_argument(
        "-i",
        "--input",
        type=Path,
        default=SYS_DATA_DIR / "sample_data",
        help="Input directory",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=SYS_DATA_DIR.parent.parent / ".tmp" / "deliverable_output",
        help="Output directory",
    )
    parser.add_argument(
        "--no-db",
        action="store_true",
        help="Run extraction & payload creation without uploading to Neon DB",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.no_db:
        raise SystemExit(
            "Legacy database writes are retired. Use --no-db for local extraction "
            "and the reviewed load_catalog_to_neon workflow for imports."
        )
    process_directory(args.input, args.output, load_db=not args.no_db)


if __name__ == "__main__":
    main()
