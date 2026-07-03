#!/usr/bin/env python3
import os
import sys
import time
import glob
from pathlib import Path
from dotenv import load_dotenv
import chromadb
from chromadb.utils import embedding_functions
from openai import OpenAI

# Setup directories
DATA_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = DATA_DIR.parent.parent
sys.path.append(str(REPO_ROOT))

# Load keys
load_dotenv(str(REPO_ROOT / ".env"))
api_key = os.getenv("OPENROUTER_API_KEY")

def parse_syllabus_to_chunks(filepath: Path) -> list[dict]:
    """
    Semantic Header-Based Chunking.
    Splits the file at every header level (# or ## or ###).
    Extracts metadata fields: course_id, professor.
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    chunks = []
    current_header = "Intro"
    current_content = []
    
    course_id = "UNKNOWN"
    professor = "UNKNOWN"
    
    # Metadata pre-scan
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

    # Split into blocks
    for line in lines:
        if line.startswith("#"):
            if current_content:
                chunks.append({
                    "section_name": current_header,
                    "content": "\n".join(current_content).strip(),
                })
            current_header = line.lstrip("#").strip()
            current_content = [line.rstrip()]
        else:
            current_content.append(line.rstrip())
            
    if current_content:
        chunks.append({
            "section_name": current_header,
            "content": "\n".join(current_content).strip(),
        })

    # Filter and format chunks
    final_chunks = []
    for chunk in chunks:
        if len(chunk["content"]) < 15:
            continue
        final_chunks.append({
            "course_id": course_id,
            "professor": professor,
            "section_name": chunk["section_name"],
            "content": chunk["content"],
            "source_file": filepath.name
        })
        
    return final_chunks

def query_llm_fast(prompt: str) -> str:
    """Queries OpenRouter using a fast free model with a low timeout."""
    if not api_key:
        return "[LOCAL MOCK LLM] (No API key found in environment)."
        
    # We put openrouter/free first because it load-balances and routes around 429s automatically
    models = [
        "openrouter/free",
        "meta-llama/llama-3.2-3b-instruct:free",
        "meta-llama/llama-3.3-70b-instruct:free"
    ]
    
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        default_headers={
            "HTTP-Referer": "https://github.com/Dallas-College-AI-Club/success-coach-chatbot",
            "X-Title": "RAG Interactive PoC Test",
        }
    )

    for model in models:
        try:
            print(f"  🤖 Querying LLM via '{model}'...")
            start_time = time.time()
            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an Academic Success Coach for Dallas College. "
                            "Answer the query using ONLY the provided context. "
                            "Keep it concise (1-3 sentences)."
                        )
                    },
                    {"role": "user", "content": prompt}
                ],
                timeout=8  # Fast 8-second timeout to avoid long hangs
            )
            elapsed = time.time() - start_time
            print(f"  ⏱️ LLM response received in {elapsed:.2f} seconds.")
            return completion.choices[0].message.content.strip()
        except Exception as e:
            print(f"  ⚠️  Model '{model}' failed or timed out: {e}. Trying next...")
            
    return "❌ LLM Query failed: All models timed out or failed to respond."

def main():
    print("=" * 60)
    print("      DALLAS COLLEGE RAG INTERACTIVE POC TESTER")
    print("=" * 60)
    
    # 1. Parse syllabi
    syllabi_dir = DATA_DIR / "sample_syllabi"
    txt_files = glob.glob(str(syllabi_dir / "*.txt"))
    if not txt_files:
        print(f"❌ Error: No text syllabi found in {syllabi_dir}")
        sys.exit(1)
        
    all_chunks = []
    for f in txt_files:
        all_chunks.extend(parse_syllabus_to_chunks(Path(f)))
        
    print(f"📊 Parsed {len(txt_files)} files into {len(all_chunks)} semantic chunks.")
    
    # 2. Setup ChromaDB
    chroma_db_dir = DATA_DIR / "chroma_db"
    db_client = chromadb.PersistentClient(path=str(chroma_db_dir))
    
    # Reset collection
    try:
        db_client.delete_collection("interactive_syllabi")
    except Exception:
        pass
        
    embedding_fn = embedding_functions.DefaultEmbeddingFunction()
    collection = db_client.create_collection(
        name="interactive_syllabi",
        embedding_function=embedding_fn
    )
    
    # Load chunks
    documents = [c["content"] for c in all_chunks]
    metadatas = [{
        "course_id": c["course_id"],
        "professor": c["professor"],
        "section_name": c["section_name"],
        "source_file": c["source_file"]
    } for c in all_chunks]
    ids = [f"chunk_{i}" for i in range(len(all_chunks))]
    
    print("📥 Indexing chunks locally into ChromaDB...")
    collection.add(documents=documents, metadatas=metadatas, ids=ids)
    print("✅ ChromaDB is ready!")
    
    # 3. REPL Loop
    while True:
        print("\n" + "=" * 50)
        query = input("🔍 Enter student query (or type 'exit' / 'q' to quit): ").strip()
        if not query or query.lower() in ['exit', 'q']:
            print("Goodbye!")
            break
            
        start_retrieval = time.time()
        res = collection.query(
            query_texts=[query],
            n_results=3
        )
        elapsed_retrieval = time.time() - start_retrieval
        print(f"\n🔎 Searching ChromaDB (n_results=3)... [Took {elapsed_retrieval:.4f}s]")
        
        retrieved_docs = res["documents"][0]
        retrieved_meta = res["metadatas"][0]
        distances = res["distances"][0]
        
        print("\n💡 RETRIEVED CHUNKS:")
        context_parts = []
        for i in range(len(retrieved_docs)):
            score = 1.0 - distances[i]
            meta = retrieved_meta[i]
            doc = retrieved_docs[i]
            print("-" * 50)
            print(f"[{i+1}] COURSE: {meta['course_id']} | SECTION: {meta['section_name']} (Similarity Score: {score:.4f})")
            print(f"File: {meta['source_file']}")
            print(f"Content:\n{doc}")
            context_parts.append(f"Source: {meta['course_id']} ({meta['section_name']})\nContent:\n{doc}")
            
        print("-" * 50)
        
        # Build prompt
        context_str = "\n\n".join(context_parts)
        rag_prompt = (
            f"Context from course syllabi:\n{context_str}\n\n"
            f"Question: {query}\n"
        )
        
        run_llm = input("\n🤖 Run LLM generation over this context? (y/n): ").strip().lower()
        if run_llm == 'y':
            start_llm = time.time()
            answer = query_llm_fast(rag_prompt)
            elapsed_llm = time.time() - start_llm
            print(f"\n💬 LLM ANSWER:\n{answer}\n")
            print(f"⏱️  Performance Metrics:")
            print(f"   - Vector Search: {elapsed_retrieval:.4f}s")
            print(f"   - LLM Generation: {elapsed_llm:.2f}s")
            print(f"   - Total Processing: {elapsed_retrieval + elapsed_llm:.2f}s")
        else:
            print("\nSkipping LLM. Prompt that would be sent:")
            print("=" * 40)
            print(rag_prompt)
            print("=" * 40)

if __name__ == "__main__":
    main()
