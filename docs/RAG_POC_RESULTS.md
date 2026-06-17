# RAG Proof-of-Concept Pipeline Run Results
> **Date**: June 10, 2026
> **Status**: RUN COMPLETED SUCCESSFULLY
> **Indexed Chunks**: 25

---

## Test Case 1: Query: *"I need a biology class that doesn't require a physical textbook."*
### Retrieved Chunks:
* **Source**: `BIOL-1406-11001` | **Section**: `Required Materials` | **Similarity**: `0.2220`
  ```
  ### Required Materials  * **Textbook Policy**: Campbell Biology (12th Edition) by Urry et al.  * **Inclusive Access**: A digital copy of the textbook is provided free to all students on the first day of class via eCampus (Canvas) through the Dallas College Inclusive Access program. **No physical textbook purchase is required.**  * **Lab Manual**: BIOL 1406 Lab Exercises (provided as free downloadable PDFs on eCampus).  
  ```
* **Source**: `BIOL-1406-11001` | **Section**: `Course Description` | **Similarity**: `0.1127`
  ```
  ### Course Description  This course focuses on the fundamental principles of living organisms, including physical and chemical properties of life, cellular organization and function, concepts of metabolic processes, cellular reproduction, genetics, and molecular biology.  
  ```
* **Source**: `BIOL-1406-11001` | **Section**: `BIOL 1406: Biology for Science Majors I (4 Credit Hours)` | **Similarity**: `-0.0492`
  ```
  ## BIOL 1406: Biology for Science Majors I (4 Credit Hours)  
  ```
### LLM Answer:
> Based on the BIOL-1406-11001 syllabus, this biology class provides a **digital textbook free** through the Dallas College Inclusive Access program via eCampus (Canvas). **No physical textbook purchase is required**, and the lab manual is also available as free downloadable PDFs. This class fully meets your need for a textbook-free biology course.


---

## Test Case 2: Query: *"How many essays are required in the history class (HIST 1301)?"*
### Retrieved Chunks:
* **Source**: `HIST-1301-22005` | **Section**: `Historiography Essay Details` | **Similarity**: `0.4448`
  ```
  ### Historiography Essay Details  Students are required to write exactly **1 essay** (1,500 - 2,000 words) analyzing a primary document of their choice from the pre-Civil War era. This constitutes the entirety of the essay requirement for this course.  
  ```
* **Source**: `HIST-1301-22005` | **Section**: `HIST 1301: History of the United States I (3 Credit Hours)` | **Similarity**: `-0.0424`
  ```
  ## HIST 1301: History of the United States I (3 Credit Hours)  
  ```
* **Source**: `ENGL-1301-44012` | **Section**: `Course Schedule` | **Similarity**: `-0.0532`
  ```
  ### Course Schedule  * Week 1: Introduction to Writing Processes & Rhetorical Situations  * Week 2: Narrative Structures and Drafting  * Week 3: Peer Review & Essay 1 Submission (Narrative)  * Week 4: Rhetorical Analysis Strategies  * Week 5: Peer Review & Essay 2 Submission (Rhetorical)  * Week 6: Argumentation and Logical Fallacies  * Week 7: Peer Review & Essay 3 Submission (Argumentative)  * Week 8: Research Methodologies and Annotated Bibliographies  * Week 9: Peer Review & Essay 4 Submission (Research Paper)  * Week 10: Portfolio Presentation and Reflection  
  ```
### LLM Answer:
> HIST 1301 requires **one** essay— a 1,500–2,000‑word historiography paper analyzing a primary document from the pre‑Civil War era.


---

## Test Case 3: Query: *"Compare the essay requirements between the history and English classes."*
### Retrieved Chunks:
* **Source**: `HIST-1301-22005` | **Section**: `Historiography Essay Details` | **Similarity**: `0.2938`
  ```
  ### Historiography Essay Details  Students are required to write exactly **1 essay** (1,500 - 2,000 words) analyzing a primary document of their choice from the pre-Civil War era. This constitutes the entirety of the essay requirement for this course.  
  ```
* **Source**: `ENGL-1301-44012` | **Section**: `Course Description` | **Similarity**: `-0.1278`
  ```
  ### Course Description  Intensive study of and practice in writing processes, from invention and researching to drafting, revising, and editing, both individually and collaboratively. Emphasis on rhetorical analysis and critical thinking.  
  ```
* **Source**: `HIST-1301-22005` | **Section**: `Course Schedule` | **Similarity**: `-0.1327`
  ```
  ### Course Schedule  * Week 1: Pre-Columbian Societies and Transatlantic Encounters  * Week 2: Colonial America and the Atlantic World  * Week 3: Causes of the American Revolution  * Week 4: The Revolutionary War and the Constitution  * Week 5: The Early Republic & Jacksonian Democracy (Midterm Quiz)  * Week 6: Industrialization, Market Revolution, and Westward Expansion  * Week 7: Sectional Conflict and the Compromise of 1850  * Week 8: The Civil War (Essay Submission due by Friday)  * Week 9: Reconstruction and its Aftermath  * Week 10: Final Course Exam  
  ```
### LLM Answer:
> The History class (HIST-1301) requires **one 1,500–2,000-word essay** analyzing a pre-Civil War primary document. The English class (ENGL-1301) focuses on **writing processes and rhetorical analysis** but does not specify an essay requirement in the provided syllabi. Thus, the History essay is a central, graded assignment, while the English course emphasizes skill development without a mandatory essay.


---
