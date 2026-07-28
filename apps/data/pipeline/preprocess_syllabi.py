"""
===============================================================================
Batch Syllabus Preprocessor CLI Driver
===============================================================================
Author: Antigravity AI / Neftali
Project: Success Coach Chatbot (Issue #90 - Data Preprocessing Engine)

Description:
    Reusable, scalable batch preprocessor script. Iterates over any directory of
    raw HTML syllabus files, applies DOM cleaning, and emits both clean Markdown
    ({id}.md) and clean HTML ({id}_clean.html) into a specified output directory.

Usage (CLI):
    python apps/data/pipeline/preprocess_syllabi.py
    python apps/data/pipeline/preprocess_syllabi.py --input-dir path/to/raw_htmls/ --output-dir path/to/cleaned/
===============================================================================
"""

import argparse
import glob
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from apps.data.dallasai.markdown_converter import MarkdownConverter


def batch_preprocess_syllabi(input_dir: Path, output_dir: Path) -> None:
    """
    Batch processes raw HTML syllabi into clean Markdown and clean HTML.

    Args:
        input_dir (Path): Directory containing raw HTML files.
        output_dir (Path): Output directory for clean .md and _clean.html files.
    """
    if not input_dir.exists():
        print(f"Error: Input directory '{input_dir}' does not exist.")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)
    converter = MarkdownConverter()

    html_files = glob.glob(str(input_dir / "*.html")) + glob.glob(str(input_dir / "*.htm"))
    print(f"Found {len(html_files)} HTML syllabus files to process in {input_dir}")

    processed_count = 0
    error_count = 0

    for filepath in html_files:
        path = Path(filepath)
        doc_id = path.stem

        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                raw_html = f.read()

            clean_md, clean_html = converter.clean_html_and_markdown(raw_html, source_url=path.name)

            # Write clean Markdown
            md_out = output_dir / f"{doc_id}.md"
            with open(md_out, "w", encoding="utf-8") as f:
                f.write(clean_md)

            # Write clean HTML
            html_out = output_dir / f"{doc_id}_clean.html"
            with open(html_out, "w", encoding="utf-8") as f:
                f.write(clean_html)

            processed_count += 1
            if processed_count % 25 == 0 or processed_count == len(html_files):
                print(f"  Processed [{processed_count}/{len(html_files)}] files...")

        except Exception as e:
            print(f"  Error processing {path.name}: {e}")
            error_count += 1

    print(f"\nBatch Preprocessing Complete!")
    print(f"  Successfully Processed: {processed_count}")
    print(f"  Errors Encountered: {error_count}")
    print(f"  Output Directory: {output_dir.resolve()}")


def main() -> None:
    """CLI Entry Point with Argparse for Reusability and Scalability."""
    base_dir = Path(__file__).resolve().parent.parent
    default_in = base_dir / "2026SP (Unzipped Files)" / "2026SP"
    default_out = base_dir / "cleaned" / "2026SP"

    parser = argparse.ArgumentParser(
        description="Reusable Batch Syllabus Preprocessor CLI tool."
    )
    parser.add_argument(
        "-i", "--input-dir", required=False, default=str(default_in),
        help=f"Path to input directory containing HTML files. Defaults to '{default_in}'"
    )
    parser.add_argument(
        "-o", "--output-dir", required=False, default=str(default_out),
        help=f"Path to output directory for cleaned files. Defaults to '{default_out}'"
    )

    args = parser.parse_args()
    batch_preprocess_syllabi(Path(args.input_dir), Path(args.output_dir))


if __name__ == "__main__":
    main()
