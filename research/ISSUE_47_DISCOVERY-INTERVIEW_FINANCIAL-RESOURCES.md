
# Discovery Interview: Financial Resources & Grants

**Interviewee:** Tammy Clark, Associate Dean, Strategic Initiatives and Grants (ETMS Point of Contact)  
**Interviewers:** AI Club Team (Success-Coach Chatbot Project)  
**Date:** 6/26/2026 
**Related Issues:** #42 (Parent) | Informs #43, #44, #45, #46  

> **Privacy Note (Public Repo):** The interviewee is named for attribution. Other staff roles, contact details, and specific financial figures are generalized or stored in the access-controlled #45 directory.

---

## Purpose
Conducted under issue #42 to understand how Dallas College students discover and qualify for financial support (grants, scholarships, etc.). The goal is to determine what financial information the chatbot should proactively surface before and during degree planning.

---

## Key Findings

### 1. Distinct Funding Streams
Students frequently confuse three separate funding sources:
* **Grants:** Externally funded money to relieve financial burden. Grants are entirely separate from financial aid and do not impact financial aid eligibility.
* **Scholarships:** Managed by a dedicated scholarship department with distinct contacts and its own web page.
* **Financial Aid:** The standard funding channel Success Coaches use. This office **does not** administer grants, meaning referrals here miss grant funding opportunities entirely.

### 2. Decentralized Grants Management
Grants are managed independently by the specific school or department that secured them.
* There is no central grant list or single owner.
* Each school (e.g., ETMS, School of Education) has its own grant Point of Contact (POC), typically an Associate Dean or Dean. 
* **Mapping Strategy:** Connect contacts to specific programs of study/schools.
* **Scale:** Grants range from hundreds of thousands to millions of dollars (e.g., a recent multi-million dollar AI grant and a national tuition/credential grant).

### 3. Prerequisites for Grant Funding
Most government grants require two actions from the student:
1.  A **FAFSA on file**.
2.  A **declared program of study**.

*Crucial Nuance:* The FAFSA only needs to be *on file* to demonstrate diversity demographics; it does not need to be processed. Students ineligible for traditional financial aid (e.g., maxed out, loan defaults) can still receive grant assistance.

### 4. The Retention and Awareness Gap
* **Current State:** Time-constrained Success Coaches rarely address payment methods. When they do, students are routed to Financial Aid, missing grant opportunities.
* **Student Impact:** Low awareness leads to unnecessary debt or dropping out. Students who pay out-of-pocket can receive full reimbursement if grant funds are applied later.
* **Institutional Impact:** Grant funds are "use-it-or-lose-it"; unused money is returned to funders.
* **Availability:** Funds are available mid-semester as long as they last, operating on one- or two-year cycles.

### 5. Non-Tuition Student Support
The chatbot must surface holistic support to prevent financial shocks from causing dropouts:
* **Emergency Funds:** Assistance with utility bills, rent, etc.
* **Student Care Network:** Free counseling, mental health support, and tuition payment assistance.
* **Technology Support:** Free loaner laptops.
* *Trigger Recommendation:* If a student mentions rent, utilities, or mental health, surface these resources.

### 6. Bot Design Recommendations
* **Proactive Messaging:** Inform students upfront during onboarding: *"Dallas College has scholarships and grant funds available. When you register, put a FAFSA on file, declare a program of study, and tell your financial success coach."*
* **Secondary Prompts:** After selecting a program, ask if the student expects to need financial assistance. If yes, route them to the relevant school's POC.
* **Scope Constraint:** The bot should *route* students, not assess eligibility. Eligibility is determined post-enrollment by the respective office.

---

## MVP Scope Decisions

* **Feature Focus:** For a selected degree plan, display a message ("You may be eligible for grants..."), route to the correct POC, and provide a contact list for emergency/support services.
* **Information Architecture:** Exclude funding sources/donors. Focus strictly on prerequisites and contact routing.
* **Data Structure:** Build a simple directory mapping degree plans/schools to contacts.
* **Boundary:** Route only. Do not determine eligibility, award amounts, or deadlines.

---

## Deferred / Future Scope

* An organized database capable of assessing eligibility by major or enrollment status.
* Deadline tracking integrated into the chat interface or an external calendar.
* An event-finder feature (minimized for the summer MVP).

---

## Work Mapping

| Finding / Requirement | Related Issue |
| :--- | :--- |
| Decentralized grants, per-school contacts; centralized scholarships; minimal static directory | **#43** Data model & schema |
| Non-technical maintenance and governance for the directory | **#44** Maintenance interface & governance |
| Collect confirmed contacts via dean outreach; author FAFSA/prerequisite awareness messages | **#45** Collection & guidance content |
| Proactive prompt post-program selection; route by school ("route, don't determine") | **#46** Proactive financial-help prompt |

---

## Open Follow-Ups

* Gather officially confirmed grant POCs from each dean/associate dean, the scholarship contact, and support service contacts (tracked in #45).
* Confirm details of the upcoming AI grant once operational.

---

## Appendix: Out-of-Scope Club Business

*Items discussed unrelated to the chatbot project:*
* Potential grant support for AI Club activities (pending details).
* Dallas College AI-tooling approval hurdles and the need for an IT/CIO point of contact.
* Upcoming opportunities: Mark Cuban Foundation workshop, AWS/Google sessions, college-tour feature.
* Student-organization logistics: Resolving AI Club naming conflicts, bank account issues, and orientation tabling.

```