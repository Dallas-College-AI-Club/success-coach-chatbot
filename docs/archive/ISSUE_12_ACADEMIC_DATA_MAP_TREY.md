# 1. Course Catalog Data Discovery

## Identify if Dallas College provides a public REST API, XML feed, or standard JSON export for the current course catalog (Course names, prefixes, credit hours, prerequisites, and descriptions). If no API exists, document the feasibility and effort required to scrape the e-catalog.

Dallas College does not provide public export of the course catalog.

On `schedule.dallascollege.edu` data is stored directly in the HTML (Course names, prefixes, section, credit hours) and separated by term. Prerequisites and descriptions are NOT found in this domain. It is feasible to scrape HTML via Python with libraries such as BeautifulSoup.

# 2. HB 2504 Data Retrieval (Syllabi & Vitas)

## Locate the public repository where Dallas College hosts its HB 2504 compliance data (faculty CVs and past course syllabi).

Public repository for syllabi and CVs is `dallascollege.campusconcourse.com`. Finding classes on the site is not directly navigable, but links from `schedule.dallascollege.edu` direct to the relevant course and section.

## Determine the format of the syllabi and CVs (e.g., structured web pages, downloadable PDFs, or Word documents).
## Document any rate limits, CAPTCHAs, or anti-scraping measures on the HB 2504 search portal.

The site disallows automated access per `robots.txt` and renders data with JavaScript. Syllabi can be downloaded as PDFs. General info and CVs are loaded with JavaScript with no direct method provided for easy export. 

# 3. Data Schema & AI Viability

## Map out a proposed JSON schema linking a specific Course (e.g., COSC 1436) to its historical syllabi and the CV of the faculty member teaching it.

Classes on Concourse have a unique CourseID of at least a six-digit number which corresponds to a unique combination of Year-Term-Prefix-Class-Section. For example, `https://dallascollege.campusconcourse.com/view_syllabus?course_id=120290` is for 2026-Summer-ACNT-1277-1.

## Identify which sections of the syllabi are most valuable for the AI chatbot's context window (e.g., grading rubrics, textbook costs, major project descriptions).

Relevant information found on each syllabus:

**Required information created by professors:**
* Graded Work
* Course Schedule
* Course Policies

**Boilerplate language for the course:**
* Course Information (class type and location, start and end dates) 
* Course Description
* State-Defined Learning Outcomes
* Instructor-Defined Learning Outcomes
