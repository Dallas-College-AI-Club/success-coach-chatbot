"""
===============================================================================
Batch HTML Preprocessor CLI Driver (Syllabi & Catalog Courses)
===============================================================================
Author: Antigravity AI / Neftali
Project: Success Coach Chatbot (Issue #90 - Data Preprocessing Engine)

Description:
    Reusable, scalable batch preprocessor script for HTML documents (Syllabi and
    Catalog Course pages). Iterates over any directory of raw HTML files, applies
    DOM cleaning, and emits both clean Markdown ({id}.md) and clean HTML ({id}_clean.html)
    into a specified output directory.
===============================================================================
"""

import argparse
import glob
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

try:
    from dallasai.markdown_converter import MarkdownConverter
except ModuleNotFoundError:
    from apps.data.dallasai.markdown_converter import MarkdownConverter


def batch_preprocess_html(input_dir: Path, output_dir: Path) -> None:
    """
    Batch processes raw HTML files (Syllabi or Catalog pages) into clean Markdown and clean HTML.

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
    print(f"Found {len(html_files)} HTML files to process in {input_dir}")

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
            print(f"Processed [{doc_id}]: emitted {md_out.name} & {html_out.name}")

        except Exception as e:
            error_count += 1
            print(f"Error processing {path.name}: {e}")

    print(f"\nBatch processing complete. Successful: {processed_count}, Errors: {error_count}")


def main():
    parser = argparse.ArgumentParser(description="Batch HTML Preprocessor for Syllabi & Catalog Pages")
    parser.add_argument("--input", "-i", type=str, required=True, help="Path to input directory containing raw HTML files")
    parser.add_argument("--output", "-o", type=str, required=True, help="Path to output directory for clean files")

    args = parser.parse_args()
    batch_preprocess_html(Path(args.input), Path(args.output))


if __name__ == "__main__":
    main()
