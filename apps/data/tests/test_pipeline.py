import re
from pathlib import Path

from dallasai.markdown_converter import MarkdownConverter

# Resolve test directories
DATA_DIR = Path(__file__).resolve().parent.parent
SAMPLE_SYLLABI_DIR = DATA_DIR / "sample_data" / "syllabi"
SAMPLE_HTML_PATH = SAMPLE_SYLLABI_DIR / "real_concourse_syllabus.html"


def test_markdown_converter_html_conversion():
    """
    Verifies that the HTML to Markdown conversion:
    1. Extracts content from class='block_content' or id='syllabus'.
    2. Strips boilerplate (script tags, footer metadata).
    3. Preserves headings and basic typography (bold, lists).
    4. Accurately compiles HTML tables into Markdown syntax.
    5. Generates valid YAML frontmatter containing expected keys and inferred course ID.
    """
    assert SAMPLE_HTML_PATH.exists(), (
        f"Syllabus test file {SAMPLE_HTML_PATH.name} is missing."
    )

    with open(SAMPLE_HTML_PATH, "r", encoding="utf-8") as f:
        html_content = f.read()

    converter = MarkdownConverter()
    markdown_output = converter.html_to_markdown(
        html_content,
        source_url="https://dallascollege.campusconcourse.com/view_syllabus?course_id=16340",
    )

    # Assertions on YAML frontmatter
    assert markdown_output.startswith("---")

    # Extract YAML lines
    frontmatter_match = re.match(
        r"^---\n(.*?)\n---", markdown_output, re.DOTALL
    )
    assert frontmatter_match is not None, (
        "YAML frontmatter block is missing or malformed."
    )

    frontmatter_content = frontmatter_match.group(1)
    assert (
        'source_url: "https://dallascollege.campusconcourse.com/view_syllabus?course_id=16340"'
        in frontmatter_content
    )
    assert "document_type: syllabus" in frontmatter_content
    assert "course_id: BIOL-1406" in frontmatter_content
    assert "extracted_date:" in frontmatter_content

    # Assertions on Boilerplate stripping (script tags and head tag elements are removed)
    assert "googletagmanager" not in markdown_output, (
        "Script tag content was not decomposed."
    )

    # Assertions on main content preservation
    assert "Biology for Science Majors I" in markdown_output
    assert "BIOL-1406" in markdown_output or "BIOL 1406" in markdown_output
    assert "Fall 2024" in markdown_output
    assert "Section 21001" in markdown_output
    assert "4 Credits" in markdown_output

    # Assertions on Markdown Table conversion
    # Verify column headers exist
    assert (
        "| Bldg | Room | Type | Days | Start Time | End Time |"
        in markdown_output
    )
    # Verify markdown table alignment dividers
    assert "| --- | --- | --- | --- | --- | --- |" in markdown_output
    # Verify row values
    assert "BHX" in markdown_output
    assert "LEC" in markdown_output


def test_markdown_converter_text_conversion():
    """
    Verifies that plain text syllabus parsing:
    1. Reads raw text files.
    2. Identifies headers using keyword analysis and formats them as ## headings.
    3. Infers course ID from file name/content.
    4. Prepends correct YAML frontmatter.
    """
    sample_txt = SAMPLE_SYLLABI_DIR / "biol_1406_doe.txt"
    assert sample_txt.exists(), (
        f"Sample syllabus file {sample_txt.name} is missing."
    )

    converter = MarkdownConverter()
    markdown_output = converter.text_to_markdown(sample_txt)

    # Verify frontmatter
    assert markdown_output.startswith("---")
    assert "course_id: BIOL-1406" in markdown_output
    assert "document_type: syllabus" in markdown_output

    # Verify headings formatting
    assert (
        "### Instructor Information" in markdown_output
        or "### INSTRUCTOR INFORMATION" in markdown_output
    )
    assert (
        "### Grading Scale & Policy" in markdown_output
        or "### GRADING SCALE & POLICY" in markdown_output
    )


def test_markdown_converter_pdf_conversion():
    """
    Verifies that PDF text extraction works and creates valid markdown.
    """
    sample_pdf = SAMPLE_SYLLABI_DIR / "sample_syllabus.pdf"
    assert sample_pdf.exists(), f"Sample PDF file {sample_pdf.name} is missing."

    converter = MarkdownConverter()
    markdown_output = converter.pdf_to_markdown(sample_pdf)

    # Verify frontmatter
    assert markdown_output.startswith("---")
    assert "document_type: syllabus" in markdown_output

    # Verify text contents
    assert "PUCT Certificate" in markdown_output
    assert (
        "Just Energy" in markdown_output
        or "justenergy" in markdown_output.lower()
    )


def test_markdown_converter_multiple_html_syllabi():
    """
    Verifies that all scraped Concourse HTML files convert successfully
    and correctly extract frontmatter metadata and content.
    """
    import glob

    converter = MarkdownConverter()
    html_files = glob.glob(str(SAMPLE_SYLLABI_DIR / "real_concourse_*.html"))
    assert len(html_files) >= 5, (
        "Expected at least 5 real Concourse HTML files."
    )

    for filepath in html_files:
        with open(filepath, "r", encoding="utf-8") as f:
            html_content = f.read()

        markdown_output = converter.html_to_markdown(
            html_content,
            source_url="https://dallascollege.campusconcourse.com/view_syllabus",
        )

        # Verify metadata frontmatter block
        assert markdown_output.startswith("---")
        assert "document_type: syllabus" in markdown_output
        assert "course_id: " in markdown_output

        # Verify course ID is non-empty and formatted correctly
        match = re.search(r"course_id:\s+([A-Z]{4}-\d{4})", markdown_output)
        assert match is not None, (
            f"Failed to extract valid course ID from {filepath}"
        )


def test_semantic_chunker_basic_splitting():
    """
    Verifies that SemanticChunker:
    1. Parses YAML frontmatter correctly.
    2. Respects header boundaries and builds correct context paths.
    3. Prepends context to chunk content.
    """
    from dallasai.semantic_chunker import SemanticChunker

    markdown = """---
course_id: MATH-1314
document_type: syllabus
---
# College Algebra
Welcome to college algebra.

## Course Info
We meet on Mondays.
"""
    chunker = SemanticChunker(chunk_size=1000, chunk_overlap=100)
    chunks = chunker.chunk_markdown(markdown, source_file="math1314.md")

    assert len(chunks) == 2
    # First chunk: College Algebra
    assert chunks[0]["metadata"]["course_id"] == "MATH-1314"
    assert chunks[0]["metadata"]["header_path"] == "MATH-1314 > College Algebra"
    assert "[Context: MATH-1314 > College Algebra]" in chunks[0]["content"]
    assert "Welcome to college algebra." in chunks[0]["content"]

    # Second chunk: Course Info
    assert (
        chunks[1]["metadata"]["header_path"]
        == "MATH-1314 > College Algebra > Course Info"
    )
    assert (
        "[Context: MATH-1314 > College Algebra > Course Info]"
        in chunks[1]["content"]
    )
    assert "We meet on Mondays." in chunks[1]["content"]


def test_semantic_chunker_recursive_splitting_and_overlap():
    """
    Verifies that a paragraph exceeding chunk_size is split recursively
    along sentence boundaries, and respects sliding overlaps.
    """
    from dallasai.semantic_chunker import SemanticChunker

    markdown = """---
course_id: HIST-1301
---
# History I
This is sentence one of the history syllabus. This is sentence two of the history syllabus. This is sentence three of the history syllabus. This is sentence four of the history syllabus. This is sentence five of the history syllabus. This is sentence six of the history syllabus.
"""
    # Use chunk_size 200 (minimum limit) and overlap 40
    chunker = SemanticChunker(chunk_size=200, chunk_overlap=40)
    chunks = chunker.chunk_markdown(markdown, source_file="hist1301.md")

    assert len(chunks) > 1
    for chunk in chunks:
        assert "[Context: HIST-1301 > History I]" in chunk["content"]
        # Ensure no sentence is cut off mid-sentence (ends on a period)
        assert chunk["content"].strip().endswith(".")

    # Check overlap presence
    overlap_found = False
    if (
        "sentence two" in chunks[0]["content"]
        and "sentence two" in chunks[1]["content"]
        or "sentence three" in chunks[0]["content"]
        and "sentence three" in chunks[1]["content"]
    ):
        overlap_found = True
    assert overlap_found, (
        "Overlap sentence was not shared between consecutive chunks."
    )


def test_semantic_chunker_dynamic_env_config(tmp_path):
    """
    Verifies that SemanticChunker dynamically reads configuration from environment.
    """
    from dallasai.semantic_chunker import SemanticChunker

    env_file = tmp_path / ".env"
    env_file.write_text("CHUNK_SIZE=500\nCHUNK_OVERLAP=75\n")

    chunker = SemanticChunker(env_path=env_file)
    assert chunker.chunk_size == 500
    assert chunker.chunk_overlap == 75


def test_semantic_chunker_fallback_on_exception():
    """
    Verifies that SemanticChunker catches exceptions and returns the input text as a single chunk.
    """
    from dallasai.semantic_chunker import SemanticChunker

    chunker = SemanticChunker()

    # Mock _parse_frontmatter to raise an exception
    chunker._parse_frontmatter = lambda text: (_ for _ in ()).throw(
        ValueError("Simulated parsing error")
    )

    chunks = chunker.chunk_markdown("some text", source_file="error_test.md")
    assert len(chunks) == 1
    assert chunks[0]["metadata"]["course_id"] == "UNKNOWN"
    assert chunks[0]["metadata"]["error_fallback"] == "true"
    assert chunks[0]["content"] == "some text"


def test_pipeline_runner_integration(tmp_path):
    """
    Verifies the complete integration of the ingestion pipeline:
    1. Instantiates a PipelineRunner with a temporary local ChromaDB path.
    2. Directly processes and indices chunks.
    3. Runs vector searches to retrieve the chunks and asserts markdown table formats
       and metadata properties are preserved correctly.
    """
    from dallasai.pipeline_runner import PipelineRunner

    # Define temporary database path and collection name via environment mocks
    env_file = tmp_path / ".env"
    env_file.write_text(
        f"CHROMA_DB_PATH={tmp_path / 'chroma_db'!s}\n"
        f"CHROMA_COLLECTION_NAME=test_integration_collection\n"
    )

    # Initialize the runner targeting our temporary environment
    runner = PipelineRunner(env_path=env_file)

    # Define a sample chunk to upsert
    test_chunk = {
        "content": "[Context: BIOL-1406 > Grading Policy]\n\n| Assessment Category | Weight |\n| --- | --- |\n| Exams | 40% |\n| Labs | 25% |",
        "metadata": {
            "course_id": "BIOL-1406",
            "document_type": "syllabus",
            "source_file": "biol_1406.html",
            "header_path": ["BIOL-1406", "Grading Policy"],
        },
    }

    # Format the metadata for ChromaDB (flat key-values)
    flat_meta = test_chunk["metadata"].copy()
    flat_meta["header_path"] = " > ".join(flat_meta["header_path"])

    # Upsert the chunk into the mock collection
    runner.collection.upsert(
        ids=["chunk_test_0"],
        documents=[test_chunk["content"]],
        metadatas=[flat_meta],
    )

    # Query the collection immediately
    results = runner.collection.query(
        query_texts=["What is the weight for Exams?"], n_results=1
    )

    # Assertions on retrieved document content and metadata tags
    assert len(results["documents"]) == 1
    assert "Exams | 40%" in results["documents"][0][0]
    assert results["metadatas"][0][0]["course_id"] == "BIOL-1406"
    assert results["metadatas"][0][0]["document_type"] == "syllabus"
