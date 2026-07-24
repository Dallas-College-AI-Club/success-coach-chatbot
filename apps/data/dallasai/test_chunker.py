"""
Interactive Terminal Tester for Semantic Chunking.
Displays chunking boundaries, metadata, and overlaps using vibrant ANSI color codes.
"""

import sys
from pathlib import Path

# Resolve base apps/data/ directory dynamically
CURRENT_DIR = Path(__file__).resolve().parent
APPS_DATA_DIR = CURRENT_DIR.parent if CURRENT_DIR.name == "dallasai" else CURRENT_DIR

if str(APPS_DATA_DIR) not in sys.path:
    sys.path.insert(0, str(APPS_DATA_DIR))

from dallasai.semantic_chunker import SemanticChunker

# Sample Markdown string resembling a real course syllabus
SAMPLE_MARKDOWN = """---
source_url: "https://dallascollege.campusconcourse.com/view_syllabus?course_id=16340"
document_type: "syllabus"
course_id: "BIOL-1406"
extracted_date: "2026-07-08T02:40:00"
---

# Biology for Science Majors I

Welcome to BIOL-1406. This course provides a foundation in biological principles for science majors.
Please read this syllabus carefully. If you have any questions, reach out to Prof. Jane Doe.

## Course Information
- **Course Title**: Biology for Science Majors I
- **Course Code**: BIOL-1406
- **Section**: 21001
- **Credits**: 4 Credits
- **Lecture Days**: Monday and Wednesday 9:30 AM - 10:50 AM
- **Lab Days**: Monday and Wednesday 11:00 AM - 1:50 PM in Room Rm. 302 of Bldg. BHX.

## Grading Policy
Grading is based on lecture exams, lab assignments, quizzes, and a final exam. Prof. Jane Doe does not accept late work.
All exams are in-person and closed-book. Make-up exams are only allowed for documented medical emergencies.

### Lecture Exams
There will be four lecture exams throughout the semester. Each exam covers three chapters of the textbook.
Exams consist of multiple-choice, true/false, and short-answer questions. No calculators or cell phones are permitted.
The lowest lecture exam grade will be dropped at the end of the semester.

### Laboratory Grading
Laboratory exercises are designed to reinforce lecture concepts. Students must attend all lab sessions.
Lab reports are due at the start of the next lab period. Late reports will receive a grade of zero.
Quizzes will be given at the start of each lab session covering the reading assignment for that day.

### Grading Scale & Criteria
Your final grade is calculated using the following weighted categories:

| Assessment Category | Weight | Description |
| --- | --- | --- |
| Lecture Exams (3 highest) | 40% | Covers textbook chapters and lecture slides. |
| Laboratory Assignments | 25% | Lab reports, attendance, and performance. |
| Quizzes & Homework | 15% | Weekly online homework and in-class quizzes. |
| Final Exam (Comprehensive) | 20% | Administered during finals week. |

The grading scale is standard: A (90-100%), B (80-89%), C (70-79%), D (60-69%), F (below 60%).

## Student Accommodation Services
Dallas College is committed to providing student support services and academic accommodations for students with disabilities.
Please contact the Disability Services Office (DSO) at the beginning of the semester to request accommodations.
Instructors require an official letter from the DSO before implementing accommodations. All records are confidential.

## Long Paragraph Test Section
This is the first sentence of a very long paragraph. This is the second sentence of a very long paragraph that has quite a lot of text inside it to make sure it exceeds the chunk limit. This is the third sentence of a very long paragraph that has even more text inside it. This is the fourth sentence of a very long paragraph. This is the fifth sentence of a very long paragraph that adds a significant amount of text to push it over the limit. This is the sixth sentence of a very long paragraph. This is the seventh sentence of a very long paragraph to guarantee that we trigger sentence splitting and showcase the sliding window overlap mechanic in action.
"""

# ANSI Color Codes for terminal highlight
GREEN = "\033[92m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
MAGENTA = "\033[95m"
BOLD = "\033[1m"
RESET = "\033[0m"

def main():
    print(f"{BOLD}{CYAN}=" * 80)
    print(f"  Dallas College Success Coach Chatbot - Semantic Chunker Tester")
    print(f"=" * 80 + RESET)

    # Initialize chunker with low chunk_size to force subdivision and overlap demonstration
    # Chunk size = 600 characters, overlap = 120 characters
    chunk_size = 600
    chunk_overlap = 120
    
    print(f"\n{BOLD}Configured Parameters:{RESET}")
    print(f"  - Target Chunk Size: {GREEN}{chunk_size} characters{RESET}")
    print(f"  - Target Overlap: {GREEN}{chunk_overlap} characters{RESET}\n")

    chunker = SemanticChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    
    print(f"{BOLD}Processing sample markdown text...{RESET}")
    chunks = chunker.chunk_markdown(SAMPLE_MARKDOWN, source_file="biol_1406_syllabus.md")
    
    print(f"Successfully generated {BOLD}{GREEN}{len(chunks)}{RESET} chunks.\n")

    previous_clean_body = ""

    for idx, chunk in enumerate(chunks, 1):
        content = chunk["content"]
        char_count = chunk["character_count"]
        header_path_str = " > ".join(chunk["header_path"])
        metadata = chunk["metadata"]
        
        # Identify the context prefix and the body
        context_prefix = ""
        body_text = content
        if content.startswith("[Context:"):
            parts = content.split("]\n\n", 1)
            context_prefix = parts[0] + "]"
            body_text = parts[1]

        # Calculate overlap with the previous chunk's body
        overlap_text = ""
        if previous_clean_body and body_text:
            # We can find the longest common suffix of previous_clean_body and prefix of body_text
            for overlap_len in range(min(len(previous_clean_body), len(body_text)), 0, -1):
                if previous_clean_body.endswith(body_text[:overlap_len]):
                    overlap_text = body_text[:overlap_len]
                    break
        
        # Keep body_text for the next iteration's overlap check
        previous_clean_body = body_text

        # Print Chunk Header Border
        border_char = "="
        print(f"{GREEN}{border_char * 80}{RESET}")
        print(f"{GREEN}CHUNK #{idx} {RESET}| {BOLD}{CYAN}Size: {char_count} chars{RESET} | {BOLD}{MAGENTA}Path: {header_path_str}{RESET}")
        print(f"{GREEN}Source File: {metadata.get('source_file')} | Course ID: {metadata.get('course_id')}{RESET}")
        print(f"{GREEN}{border_char * 80}{RESET}")

        # Display content with highlighted context and overlap
        if context_prefix:
            print(f"{BOLD}{CYAN}{context_prefix}{RESET}")
            print()
            
        if overlap_text:
            non_overlap_text = body_text[len(overlap_text):]
            print(f"{YELLOW}🔀 [OVERLAP START]\n{overlap_text}\n[OVERLAP END] 🔀{RESET}", end="")
            print(non_overlap_text)
        else:
            print(body_text)
            
        print(f"{GREEN}{'-' * 80}{RESET}\n")

if __name__ == "__main__":
    main()
