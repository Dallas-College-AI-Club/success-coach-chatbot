import os
import sys
import glob
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from dotenv import load_dotenv
import chromadb
from chromadb.utils import embedding_functions

# Configure logging to capture pipeline telemetry
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pipeline_runner")

# Resolve repository paths dynamically
CURRENT_DIR = Path(__file__).resolve().parent
APPS_DATA_DIR = CURRENT_DIR.parent if CURRENT_DIR.name == "dallasai" else CURRENT_DIR
REPO_ROOT = APPS_DATA_DIR.parent.parent

# Ensure the base apps/data/ directory is in sys.path for absolute imports
if str(APPS_DATA_DIR) not in sys.path:
    sys.path.insert(0, str(APPS_DATA_DIR))

from dallasai.markdown_converter import MarkdownConverter
from dallasai.semantic_chunker import SemanticChunker

class BaseEmbeddingEngine(ABC):
    """
    Abstract Base Class defining a provider-agnostic interface for text embeddings.
    Allows seamlessly swapping between Chroma, OpenAI, Cohere, or Hugging Face.
    """
    @abstractmethod
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """
        Generates vector embeddings for a list of string documents.
        """
        pass

class ChromaDefaultEmbeddingEngine(BaseEmbeddingEngine):
    """
    Concrete Embedding Engine implementation utilizing Chroma's built-in 
    sentence-transformers (all-MiniLM-L6-v2) local model.
    """
    def __init__(self):
        # Instantiate Chroma's standard embedding function
        self.embedding_fn = embedding_functions.DefaultEmbeddingFunction()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        # Generate and return vector embeddings list
        return self.embedding_fn(texts)

class PipelineRunner:
    """
    Orchestration class that drives the entire data ingestion pipeline:
    1. HTML/Text/PDF Syllabus Conversion -> Markdown
    2. Semantic Chunking
    3. Vector database indexing in persistent ChromaDB.
    """
    def __init__(self, embedding_engine: BaseEmbeddingEngine = None, env_path: Path = None):
        # 1. Load environment variables
        if env_path:
            load_dotenv(str(env_path))
        else:
            load_dotenv(str(REPO_ROOT / ".env"))

        # 2. Configure paths and collection names
        # Default to apps/data/chroma_db/ relative to root
        default_db_path = APPS_DATA_DIR / "chroma_db"
        env_db_path = os.getenv("CHROMA_DB_PATH")
        self.db_path = Path(env_db_path) if env_db_path else default_db_path
        
        self.collection_name = os.getenv("CHROMA_COLLECTION_NAME", "dallas_college_kb")

        logger.info(f"Using ChromaDB Path: {self.db_path}")
        logger.info(f"Using Collection Name: {self.collection_name}")

        # Ensure database directory exists
        self.db_path.mkdir(parents=True, exist_ok=True)

        # 3. Setup client and collection
        self.db_client = chromadb.PersistentClient(path=str(self.db_path))

        # Use ChromaDefaultEmbeddingEngine if none is supplied
        self.embedding_engine = embedding_engine or ChromaDefaultEmbeddingEngine()

        # Create a class that implements the Chroma EmbeddingFunction protocol
        class ChromaEmbeddingFunction(chromadb.EmbeddingFunction):
            def __init__(self, engine: BaseEmbeddingEngine):
                self.engine = engine
            def __call__(self, input: chromadb.Documents) -> chromadb.Embeddings:
                return self.engine.embed_documents(input)
            def name(self) -> str:
                return "custom_embedding_engine"

        self.collection = self.db_client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=ChromaEmbeddingFunction(self.embedding_engine)
        )

        # 4. Initialize conversion and chunking engines
        self.converter = MarkdownConverter()
        self.chunker = SemanticChunker(env_path=env_path)

    def run_pipeline(self, batch_size: int = 100) -> int:
        """
        Orchestrates the conversion, chunking, embedding, and indexing of syllabi.
        Scans sample_syllabi folder, converts HTML to Markdown, chunks it,
        and upserts them in batches into ChromaDB.
        """
        syllabi_dir = APPS_DATA_DIR / "sample_syllabi"
        # Find all .html files in the syllabi directory
        html_files = glob.glob(str(syllabi_dir / "*.html"))

        if not html_files:
            logger.warning(f"No HTML files found in {syllabi_dir}")
            return 0

        logger.info(f"Found {len(html_files)} HTML syllabi to index.")

        all_chunks = []
        for filepath_str in html_files:
            filepath = Path(filepath_str)
            logger.info(f"Processing: {filepath.name}")

            try:
                # 1. Read raw HTML
                with open(filepath, "r", encoding="utf-8") as f:
                    html_content = f.read()

                # 2. Convert HTML to clean Markdown with metadata
                markdown_text = self.converter.html_to_markdown(
                    html_content,
                    source_url=f"https://dallascollege.campusconcourse.com/view_syllabus?course_id={filepath.stem.split('_')[-1]}"
                )

                # 3. Generate semantic chunks
                chunks = self.chunker.chunk_markdown(markdown_text, source_file=filepath.name)
                all_chunks.extend(chunks)
                logger.info(f"  - Generated {len(chunks)} chunks.")

            except Exception as e:
                logger.error(f"Failed to process {filepath.name}: {str(e)}")

        if not all_chunks:
            logger.warning("No chunks were generated. Indexing aborted.")
            return 0

        logger.info(f"Total chunks to index: {len(all_chunks)}")

        # 4. Batch embed and upsert into ChromaDB
        total_upserted = 0
        for idx in range(0, len(all_chunks), batch_size):
            batch = all_chunks[idx : idx + batch_size]
            
            batch_documents = [c["content"] for c in batch]
            batch_metadatas = []
            
            # Ensure metadata keys are clean and flat (ChromaDB requires flat metadatas)
            for c in batch:
                meta = c["metadata"].copy()
                if "header_path" in meta and isinstance(meta["header_path"], list):
                    meta["header_path"] = " > ".join(meta["header_path"])
                batch_metadatas.append(meta)

            # Generate unique IDs for each chunk
            batch_ids = [
                f"{c['metadata'].get('course_id', 'UNKNOWN')}_{c['metadata'].get('source_file', 'file')}_{idx + i}"
                for i, c in enumerate(batch)
            ]

            logger.info(f"Indexing batch {idx // batch_size + 1}... (Size: {len(batch)})")

            try:
                # Generate embeddings using the provider-agnostic engine
                batch_embeddings = self.embedding_engine.embed_documents(batch_documents)

                # Upsert into ChromaDB natively
                self.collection.upsert(
                    ids=batch_ids,
                    documents=batch_documents,
                    embeddings=batch_embeddings,
                    metadatas=batch_metadatas
                )
                total_upserted += len(batch)
            except Exception as e:
                logger.error(f"Failed to upsert batch: {str(e)}")

        logger.info(f"Successfully upserted {total_upserted} chunks into ChromaDB.")
        return total_upserted

if __name__ == "__main__":
    # If run directly as a script, execute the pipeline
    runner = PipelineRunner()
    runner.run_pipeline()
