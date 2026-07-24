#!/usr/bin/env python3
import os
import sys
import glob
from pathlib import Path
from dotenv import load_dotenv
import chromadb
from chromadb.utils import embedding_functions
from openai import OpenAI

# ---------------------------------------------------------
# Path and Environment Setup
# ---------------------------------------------------------
DATA_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = DATA_DIR.parent.parent

# Append to sys.path
sys.path.append(str(REPO_ROOT))

# Load environment variables
load_dotenv(str(REPO_ROOT / ".env"))
api_key = os.getenv("OPENROUTER_API_KEY")

if not api_key:
    # Try parent directory .env
    load_dotenv(str(REPO_ROOT.parent / ".env"))
    api_key = os.getenv("OPENROUTER_API_KEY")

if not api_key:
    print("⚠️  Warning: OPENROUTER_API_KEY not found in environment. LLM queries will fail.")
else:
    print("🔑  OpenRouter API Key found.")


# ---------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------
def parse_syllabus_to_chunks(filepath: Path) -> list[dict]:
    """
    Parses a syllabus text file semantically.
    Splits the file at every header level (# or ## or ###).
    Extracts metadata fields: course_id, professor.
    """
    print(f"Parsing: {filepath.name}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    chunks = []
    current_header = "Header"
    current_content = []
    
    course_id = "UNKNOWN"
    professor = "UNKNOWN"
    
    # Simple heuristic to extract Metadata from syllabus lines
    for line in lines:
        line_clean = line.strip().replace("*", "").replace("`", "")
        if "course id" in line_clean.lower() or "course_id" in line_clean.lower():
            parts = line_clean.split(":")
            if len(parts) > 1:
                course_id = parts[1].strip()
        if "instructor" in line_clean.lower() or "professor" in line_clean.lower():
            parts = line_clean.split(":")
            if len(parts) > 1:
                professor = parts[1].strip()

    # Split into structural blocks
    for line in lines:
        if line.startswith("#"):
            # If we already have content, save the previous chunk
            if current_content:
                chunks.append({
                    "section_name": current_header,
                    "content": "\n".join(current_content).strip(),
                })
            # Start a new chunk
            current_header = line.lstrip("#").strip()
            current_content = [line.rstrip()]
        else:
            current_content.append(line.rstrip())
            
    # Save the last chunk
    if current_content:
        chunks.append({
            "section_name": current_header,
            "content": "\n".join(current_content).strip(),
        })

    # Enrich metadata for each chunk
    final_chunks = []
    for chunk in chunks:
        # Ignore empty or very short header chunks
        if len(chunk["content"]) < 15:
            continue
        final_chunks.append({
            "course_id": course_id,
            "professor": professor,
            "section_name": chunk["section_name"],
            "content": chunk["content"],
            "source_file": filepath.name
        })
        
    print(f"  └─ Extracted {len(final_chunks)} semantic chunks (Course: {course_id}, Prof: {professor})")
    return final_chunks


# Initialize OpenAI/OpenRouter client
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=api_key or "placeholder_key",
    default_headers={
        "HTTP-Referer": "https://github.com/Dallas-College-AI-Club/success-coach-chatbot",
        "X-Title": "Success Coach Chatbot RAG PoC",
    }
)

def query_llm(prompt: str) -> str:
    """Queries OpenRouter using a cascading fallback of free models."""
    models = [
        "openrouter/free",
        "liquid/lfm-2.5-1.2b-instruct:free",
        "mistralai/mistral-7b-instruct:free"
    ]
    
    if not api_key:
        return "[MOCK LLM RESPONSE] API key is missing. Cannot perform LLM synthesis."
        
    for model in models:
        try:
            print(f"  🤖 Querying LLM via '{model}'...")
            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a helpful, direct Academic Success Coach chatbot for Dallas College. "
                            "Answer the student's question accurately using ONLY the provided context. "
                            "If the context does not contain the answer, say 'I cannot find that information in the syllabi.' "
                            "Keep your response concise (2-4 sentences max)."
                        )
                    },
                    {"role": "user", "content": prompt}
                ],
                timeout=15
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            print(f"  ⚠️  Model '{model}' failed: {e}. Trying next fallback...")
            
    return "❌ All fallback models failed to respond."


# ---------------------------------------------------------
# Main Execution Pipeline
# ---------------------------------------------------------
def main():
    print("=" * 60)
    print("Dallas College Success Coach Chatbot - RAG PoC Pipeline")
    print("=" * 60)
    
    # 1. Parse all sample syllabi
    syllabi_dir = DATA_DIR / "sample_syllabi"
    txt_files = glob.glob(str(syllabi_dir / "*.txt"))
    
    if not txt_files:
        print(f"❌ Error: No text syllabi found in {syllabi_dir}. Please create them first.")
        sys.exit(1)
        
    all_chunks = []
    for filepath in txt_files:
        all_chunks.extend(parse_syllabus_to_chunks(Path(filepath)))
        
    print(f"\n📊 Total chunks extracted for indexing: {len(all_chunks)}")
    
    # 2. Initialize ChromaDB (local persistent storage)
    chroma_db_dir = DATA_DIR / "chroma_db"
    print(f"📦 Initializing ChromaDB at: {chroma_db_dir}")
    
    db_client = chromadb.PersistentClient(path=str(chroma_db_dir))
    
    # Clear collection if it exists to ensure a fresh indexing
    try:
        db_client.delete_collection("syllabi_collection")
        print("  🧹 Cleared existing 'syllabi_collection' collection.")
    except Exception:
        pass
        
    # Get built-in CPU-based MiniLM embedding function
    embedding_fn = embedding_functions.DefaultEmbeddingFunction()
    
    collection = db_client.create_collection(
        name="syllabi_collection",
        embedding_function=embedding_fn
    )
    
    # 3. Add chunks to database
    documents = [c["content"] for c in all_chunks]
    metadatas = [{
        "course_id": c["course_id"],
        "professor": c["professor"],
        "section_name": c["section_name"],
        "source_file": c["source_file"]
    } for c in all_chunks]
    ids = [f"chunk_{i}" for i in range(len(all_chunks))]
    
    print("📥 Loading chunks into ChromaDB...")
    collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )
    print("✅ Indexing completed successfully!")
    
    # 4. Run Test Queries
    queries = [
        "I need a biology class that doesn't require a physical textbook.",
        "How many essays are required in the history class (HIST 1301)?",
        "Compare the essay requirements between the history and English classes."
    ]
    
    results_md = []
    results_md.append("# RAG Proof-of-Concept Pipeline Run Results")
    results_md.append(f"> **Date**: June 10, 2026")
    results_md.append(f"> **Status**: RUN COMPLETED SUCCESSFULLY")
    results_md.append(f"> **Indexed Chunks**: {len(all_chunks)}")
    results_md.append("\n---\n")
    
    for idx, q in enumerate(queries, 1):
        print("\n" + "-" * 50)
        print(f"🔍 Test Query #{idx}: '{q}'")
        print("-" * 50)
        
        # Query ChromaDB (retrieve top 3 matching chunks)
        res = collection.query(
            query_texts=[q],
            n_results=3
        )
        
        retrieved_docs = res["documents"][0]
        retrieved_meta = res["metadatas"][0]
        distances = res["distances"][0]
        
        print("💡 Retrieved Context Chunks:")
        context_parts = []
        for i in range(len(retrieved_docs)):
            score = 1.0 - distances[i]  # Convert distance to simple similarity score
            meta = retrieved_meta[i]
            doc = retrieved_docs[i]
            print(f"  [{i+1}] Course: {meta['course_id']} | Section: {meta['section_name']} (Similarity: {score:.4f})")
            context_parts.append(f"Source: {meta['course_id']} ({meta['section_name']})\nContent:\n{doc}")
        
        # Form RAG prompt
        context_str = "\n\n".join(context_parts)
        rag_prompt = (
            f"Context from course syllabi:\n{context_str}\n\n"
            f"Question: {q}\n"
        )
        
        # Call LLM
        answer = query_llm(rag_prompt)
        print(f"💬 LLM Answer:\n{answer}")
        
        # Save to markdown report
        results_md.append(f"## Test Case {idx}: Query: *\"{q}\"*")
        results_md.append("### Retrieved Chunks:")
        for i in range(len(retrieved_docs)):
            score = 1.0 - distances[i]
            meta = retrieved_meta[i]
            results_md.append(
                f"* **Source**: `{meta['course_id']}` | **Section**: `{meta['section_name']}` "
                f"| **Similarity**: `{score:.4f}`\n"
                f"  ```\n  {retrieved_docs[i].replace(chr(10), '  ')}  \n  ```"
            )
        results_md.append("### LLM Answer:")
        results_md.append(f"> {answer}\n")
        results_md.append("\n---\n")

    # Save results to a file
    results_path = REPO_ROOT / "docs/RAG_POC_RESULTS.md"
    with open(results_path, "w", encoding="utf-8") as rf:
        rf.write("\n".join(results_md))
        
    print("\n" + "=" * 60)
    print(f"🎉 RAG POC Test Complete! Results written to {results_path.name}")
    print("=" * 60)

if __name__ == "__main__":
    main()
