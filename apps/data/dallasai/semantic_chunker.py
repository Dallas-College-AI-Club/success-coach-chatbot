"""
Semantic Chunking Strategy.
Splits markdown documents based on header hierarchy and applies recursive sentence-boundary
splitting and sliding window overlaps.
"""

import datetime
import os
import re
from pathlib import Path

from dotenv import load_dotenv


class SemanticChunker:
    """
    Splits Markdown files into context-rich, size-bounded semantic chunks.
    Respects header boundaries and falls back to recursive paragraph/sentence splits
    without cutting sentences mid-thought.
    """

    def __init__(
        self,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        env_path: Path | None = None,
    ):
        # Resolve repository paths
        self.repo_root = Path(__file__).resolve().parent.parent.parent

        # Load environment variables
        if env_path:
            load_dotenv(str(env_path))
        else:
            load_dotenv(str(self.repo_root / ".env"))

        # Read config dynamically with fallback defaults
        env_chunk_size = os.getenv("CHUNK_SIZE")
        env_chunk_overlap = os.getenv("CHUNK_OVERLAP")

        self.chunk_size = chunk_size or (
            int(env_chunk_size) if env_chunk_size else 2000
        )
        self.chunk_overlap = chunk_overlap or (
            int(env_chunk_overlap) if env_chunk_overlap else 200
        )

        # Enforce sensible boundaries to prevent clipping
        if self.chunk_size < 200:
            self.chunk_size = 200
        if self.chunk_overlap >= self.chunk_size:
            self.chunk_overlap = int(self.chunk_size * 0.1)

    def chunk_markdown(
        self, markdown_text: str, source_file: str = ""
    ) -> list[dict]:
        """
        Main entrypoint. Parses frontmatter and body, splits by headers,
        and returns a list of chunk dictionaries with prepended context and metadata.
        """
        if markdown_text is None:
            markdown_text = ""
        else:
            markdown_text = str(markdown_text)

        try:
            # 1. Parse YAML Frontmatter
            metadata, body = self._parse_frontmatter(markdown_text)

            # Use course_id from frontmatter if available
            course_id = metadata.get("course_id", "UNKNOWN")

            # 2. Split body into sections by headers
            sections = self._split_by_headers(body, course_id)

            # 3. Process each section and split further if necessary
            chunks = []
            for sect in sections:
                sect_chunks = self._process_section(sect, metadata, source_file)
                chunks.extend(sect_chunks)

            return chunks

        except Exception as e:
            self._log_error(f"Error chunking file '{source_file}': {str(e)}")
            # Graceful fallback: return a single chunk containing the whole text to avoid crashing pipeline
            fallback_metadata = {
                "course_id": "UNKNOWN",
                "document_type": "general",
                "source_file": source_file,
                "error_fallback": "true",
            }
            return [
                {
                    "content": markdown_text,
                    "metadata": fallback_metadata,
                    "header_path": [],
                    "character_count": len(markdown_text),
                }
            ]

    def _parse_frontmatter(self, text: str) -> tuple[dict, str]:
        """
        Extracts YAML frontmatter from the top of the markdown file.
        Returns a dictionary of metadata and the remaining markdown body.
        """
        metadata = {}
        body = text

        # Match --- frontmatter block ---
        # Allow leading whitespace (like newlines in triple quoted strings)
        match = re.match(r"^\s*---\n(.*?)\n---\n*(.*)", text, re.DOTALL)
        if match:
            frontmatter_content = match.group(1)
            body = match.group(2)

            # Simple YAML parser for key-value lines
            for line in frontmatter_content.split("\n"):
                line = line.strip()
                if not line or ":" not in line:
                    continue
                k, v = line.split(":", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                metadata[k] = v

        return metadata, body

    def _split_by_headers(self, body: str, course_id: str) -> list[dict]:
        """
        Splits markdown content into sections along header boundaries (# to ######).
        Tracks header hierarchy path to build accurate context strings.
        """
        sections = []
        lines = body.split("\n")

        current_path = []
        current_buffer = []

        # Helper to push active buffer into sections list
        def flush_buffer():
            content = "\n".join(current_buffer).strip()
            # Only store if there is actual content
            if content:
                # Build context path. If course_id is known, prefix it.
                path_prefix = [course_id] if course_id != "UNKNOWN" else []
                full_path = path_prefix + current_path
                sections.append({"header_path": full_path, "content": content})
            current_buffer.clear()

        for line in lines:
            # Check for header pattern (1 to 6 hashes followed by space)
            header_match = re.match(r"^(#{1,6})\s+(.*)$", line)
            if header_match:
                # Flush the content of the previous section
                flush_buffer()

                # Determine header level and title
                hashes = header_match.group(1)
                level = len(hashes)
                title = header_match.group(2).strip()

                # Adjust current path to the new level
                current_path = current_path[: level - 1]
                # Pad intermediate levels if the document skipped headers
                while len(current_path) < level - 1:
                    current_path.append("Sub-Section")
                current_path.append(title)

                # Keep the header line as part of the section's content
                current_buffer.append(line)
            else:
                current_buffer.append(line)

        # Flush any remaining content
        flush_buffer()
        return sections

    def _process_section(
        self, section: dict, metadata: dict, source_file: str
    ) -> list[dict]:
        """
        Formats the section and prepends context. If the combined size exceeds CHUNK_SIZE,
        recursively splits it using paragraph/sentence boundaries and sliding window overlap.
        """
        header_path = section["header_path"]
        content = section["content"]

        # Build context prefix
        if header_path:
            context_str = " > ".join(header_path)
            prefix = f"[Context: {context_str}]"
        else:
            prefix = ""

        # Total size check
        prefix_len = len(prefix) + 2 if prefix else 0
        combined_len = prefix_len + len(content)

        if combined_len <= self.chunk_size:
            # Keep as single chunk
            chunk_content = f"{prefix}\n\n{content}" if prefix else content
            chunk_meta = metadata.copy()
            chunk_meta["header_path"] = " > ".join(header_path)
            chunk_meta["source_file"] = source_file
            return [
                {
                    "content": chunk_content,
                    "metadata": chunk_meta,
                    "header_path": header_path,
                    "character_count": len(chunk_content),
                }
            ]

        # Section is too large; must sub-split recursively into atoms
        atoms = self._split_into_atoms(content, prefix_len)

        # Assemble sub-chunks with sliding window overlap
        sub_chunks = []
        i = 0
        n = len(atoms)

        while i < n:
            # Find the largest k such that atoms[i...k] fits
            current_len = prefix_len + len(atoms[i][0])
            k = i
            while k + 1 < n:
                next_atom_len = len(atoms[k][1]) + len(atoms[k + 1][0])
                if current_len + next_atom_len <= self.chunk_size:
                    current_len += next_atom_len
                    k += 1
                else:
                    break

            # Reconstruct the text for this sub-chunk
            sub_body_parts = []
            for idx in range(i, k + 1):
                sub_body_parts.append(atoms[idx][0])
                if idx < k:
                    sub_body_parts.append(atoms[idx][1])

            sub_body = "".join(sub_body_parts)
            sub_content = f"{prefix}\n\n{sub_body}" if prefix else sub_body

            chunk_meta = metadata.copy()
            chunk_meta["header_path"] = " > ".join(header_path)
            chunk_meta["source_file"] = source_file
            chunk_meta["is_sub_chunk"] = "true"

            sub_chunks.append(
                {
                    "content": sub_content,
                    "metadata": chunk_meta,
                    "header_path": header_path,
                    "character_count": len(sub_content),
                }
            )

            if k == n - 1:
                break

            # Sliding window overlap: step backward from k
            next_start = k
            overlap_accumulated = len(atoms[k][0])
            for j in range(k - 1, i - 1, -1):
                overlap_accumulated += len(atoms[j][1]) + len(atoms[j][0])
                next_start = j
                if overlap_accumulated >= self.chunk_overlap:
                    break

            # Safeguard to prevent infinite loop (must advance at least 1 atom)
            if next_start == i:
                next_start = i + 1

            i = next_start

        return sub_chunks

    def _split_into_atoms(
        self, text: str, prefix_len: int
    ) -> list[tuple[str, str]]:
        """
        Splits content recursively into atoms (paragraphs, sentences, or words)
        paired with their trailing join separators.
        """
        atoms = []
        paragraphs = text.split("\n\n")

        for p_idx, p in enumerate(paragraphs):
            # Determine join separator to the next paragraph
            p_sep = "\n\n" if p_idx < len(paragraphs) - 1 else ""
            p_clean = p.strip()
            if not p_clean:
                continue

            # If paragraph fits, keep it as a single atom
            if prefix_len + len(p_clean) <= self.chunk_size:
                atoms.append((p_clean, p_sep))
            else:
                # Split paragraph into sentences
                sentences = self._split_into_sentences(p_clean)
                for s_idx, s in enumerate(sentences):
                    # Separator between sentences in same paragraph is space
                    s_sep = " " if s_idx < len(sentences) - 1 else p_sep
                    s_clean = s.strip()
                    if not s_clean:
                        continue

                    if prefix_len + len(s_clean) <= self.chunk_size:
                        atoms.append((s_clean, s_sep))
                    else:
                        # Split sentence into words/tokens
                        words = s_clean.split(" ")
                        for w_idx, w in enumerate(words):
                            # Separator between words is space
                            w_sep = " " if w_idx < len(words) - 1 else s_sep
                            w_clean = w.strip()
                            if not w_clean:
                                continue
                            atoms.append((w_clean, w_sep))

        return atoms

    def _split_into_sentences(self, text: str) -> list[str]:
        """
        Splits a paragraph into sentences using regular expression heuristics
        that respect common abbreviations (e.g. 'Dr.', 'Prof.', 'Bldg.') and
        avoid cutting mid-thought.
        """
        abbreviations = [
            "Dr",
            "Prof",
            "Bldg",
            "Rm",
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
            "vs",
            "etc",
            "e.g",
            "i.e",
        ]
        # Convert abbreviations to lookbehinds of fixed length
        ab_escaped = [ab.replace(".", r"\.") + r"\." for ab in abbreviations]
        lookbehinds = "".join(f"(?<!{ab})" for ab in ab_escaped)
        # Prevent splitting on initials (e.g. "Jane A. Doe")
        pattern = rf"{lookbehinds}(?<![A-Z]\.)(?<=[.!?])\s+"

        sentences = re.split(pattern, text)
        return [s.strip() for s in sentences if s.strip()]

    def _log_error(self, message: str):
        """
        Writes diagnostics footprint to the .tmp/chunking_errors.log file.
        """
        try:
            log_dir = self.repo_root / ".tmp"
            log_dir.mkdir(parents=True, exist_ok=True)
            log_file = log_dir / "chunking_errors.log"

            timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(f"[{timestamp}] {message}\n")
        except Exception as e:
            print(f"Error logging failed: {e}")
