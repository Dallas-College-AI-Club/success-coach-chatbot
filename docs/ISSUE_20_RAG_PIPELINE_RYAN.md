# AI Club Success Coach Chatbot: RAG Proof of Concept (PoC) Strategy

This document outlines the architectural recommendations, code blueprint, and strategies to resolve the technical challenges of parsing, chunking, and querying Dallas College academic documents.

---

## 🛠️ Tech Stack & Technical Blueprint

For a rapid, production-grade local proof of concept (PoC), the recommended stack balances efficiency, cost, and layout fidelity.

* **Parsing Tool:** `Docling` (by IBM Research) or `LlamaParse`. Traditional parsers like `pypdf` lose structural details, turning tables into a garbled string of text. `Docling` natively handles complex documents using layout-aware models and outputs clean Markdown, converting grading tables into native Markdown tables.
* **Vector Database:** `ChromaDB` (Local Ephemeral/Persistent client). It is lightweight, requires zero server configuration, runs entirely in Python, and allows metadata filtering.
* **LLM & Embeddings:** `Ollama` running `llama3` (or `mistral`) paired with `nomic-embed-text` for completely local, free prototyping.

---

## 🎯 Answering the Key Questions

### 1. Document Parsing & Extraction
* **The Issue:** Syllabi and CVs rely on tables to display critical data (e.g., grading scales, assignment counts, schedules). If a table is flattened into plain text, the semantic relationship between a row and a column is lost.
* **The Solution:** Parse PDFs into **Markdown**. Markdown maintains tabular integrity natively (`| Header | Header |`). `Docling` or `LlamaParse` evaluates the visual layout, identifies bounding boxes for tables, and transforms them into Markdown format.

### 2. Chunking Strategy & Metadata Preservation
* **The Issue:** Fixed-length character chunking (e.g., every 500 characters) will cut off grading rubrics or textbooks mid-sentence.
* **The Solution:** Use **MarkdownHeaderTextSplitter** followed by a parent-child recursive character breakdown. This splits the document strictly by markdown sections (e.g., `# Grading`, `## Required Textbooks`), keeping unified ideas together.
* **Metadata Injector:** When a document is processed, metadata must be explicitly stamped onto every single chunk dictionary prior to database ingestion:

```python
metadata = {
    "course_id": "HIST-1301",
    "professor": "Dr. Robert Smith",
    "section": "10412",
    "term": "Fall 2026",
    "source": "history_1301_smith.pdf"
}