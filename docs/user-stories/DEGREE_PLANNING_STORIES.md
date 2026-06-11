# Story ID DP - 01
# Feature - AI Degree Planning

**Persona:** Maria — P1 — Traditional Student (Freshman / Sophomore)
**Priority:** P0 | **Effort:** L / 5

**Persona Reference**
Maria is a recently enrolled student, typically around 18-20 years old,
who is not familar with the degree catalog and does not know the exact course
code she need to take. She also does not know what to take in her first semester and degree requirements and what are the prerequisite for each course. She prefer to chat with AI chatbot for planning her degree over scheduling an appointment with advisor.  

**User Story:**
As a first-year student,
I want to ask the chatbot about courses using plain language,
So that I don't have to know exact course codes to get accurate degree information.

**Acceptance Criteria:**

Given a student asks questions such as 
- "what courses will I need to take to complete associate degree in Computer Science?", 
- "What should I take in my first semester?"
- "Do I need any prerequisites for this class?"
When the chatbot processes the query
Then it identifies the intent as degree planning
And maps the course requirements such as COSC I, COSC II, Calculus I and II etc. 
And returns the result in context of the CS degree plan. The bot may also return prerequisites and sugesstions based on the user question.


**Edge Cases:**
- Given the student uses a broad question with no specific one, 
  When the bot cannot map it
  Then it asks a clarifying question or useful question rather than guessing, such as bot would say, "You will need 60 semester credit hours to graduate, how would you like to plan for this semester?"

**QA Verification:**
- Bot asks for clarification when confidence score is below threshold
- Response cites source at the bottom (catalog year + program name)

###### End ######

# Story ID DP - 02
# Feature - AI Degree Planning
**Persona:** John — P2 — Transfer Student
**Priority:** P0 | **Effort:** L / 5

**Persona Reference**
John is a transfer student from Collin College who is planning to continue
studying Mechanical Engineering at Dallas College. He does not know how many
credits he will be able to transfer to Dallas College. At the same time, he
is not certain about the courses he will need to take for his third semester.
He decided to ask the AI chatbot to figure out what courses he still has left
to take and what credits will transfer.

**User Story:**
As a transfer student,
I want to ask the chatbot how many of my credits will transfer
(e.g., MATH 1245, PHYS 2425, PHYS 2426, COSC 1223 — already taken),
So that I don't have to enroll in the same courses I have already taken.

**Acceptance Criteria:**

Given a student types 
- "Are these courses transferable? (MATH 2337, COSC 2319, PHYS 2234) — if they transfer, how many credit hours are remaining for my Mechanical Engineering degree?"
- "Do I need to retake any of my classes?"
- "Does my course from my old college match this course here?"

When the chatbot processes the query
Then it identifies the intent as degree_planning
And checks if MATH 2337, COSC 2319, and PHYS 2234 are transferable —
if so, remaps and calculates the remaining credit hours and the exact
courses he will need to take
And the bot will also check if the course from the previous College also match with Dallas College course.
And returns the result in structured plain English

**Edge Cases:**
- Given the student uses a different course code from their previous school,
  even though the course is transferable
  When the bot cannot find a matching course code
  Then it responds: "I couldn't find an exact match for that course code.
  This course may still be transferable and I recommend confirming with an
  academic advisor."

**QA Verification:**
- Bot correctly identifies `degree_planning` intent when student lists course codes in the query
- Bot accurately checks if MATH 2337, COSC 2319, and PHYS 2234
      are transferable 
- Bot correctly calculates the remaining credit hours after confirmed transfer credits are removed from the degree plan
- Bot successsfully returns the exact list of remaining courses the student will still needs to take
- When the bot unrecognized the course code, then bot responds with the advisor referral message instead of crashing or trying to guess

###### End ######

# Story ID DP - 03
# Feature - AI Degree Planning
**Persona:** Hannah — P3 — Lifelong Learners (Continuing Ed / Certification)
**Priority:** P0 | **Effort:** L / 5

**Persona Reference**
Hannah is a 45 years old student who decided to take her Bussiness Administration Certificate at Dallas College. She needs help with the courses she will be taking. She is hoping to take all of her classes `online` (As far as I know, most of the lifelong learners are taking online classes)

**User Story:**
As a Lifelong Learner,
I want to ask the chatbot what courses I need to take
and whether they are all available completely online,
So that I can plan my schedule around my life
and confirm I can complete my certificate from home.

**Acceptance Criteria:**

Given Hannah asks about her Business Administration Certificate courses
When she also asks 
- "if they are available online?"
- "What courses do I need to complete my Business Administration certificate?"
- "What classes should I take next semester if I work full time?"
Then the chatbot returns a list of required courses, check if they are online, in-person, hybrid, and also plan the course for Hannah
  And the bot clearly marks each one as Online, In-Person, or Hybrid
  And lets her know if any course is not available online
  And the bot also suggest what courses she should take allign with her work schedule

**Edge Cases:**
- Given Hannah asks about online availability
When the chatbot retrieves course data from a previous semester
Then it includes a disclaimer that availability may vary semester by semester
  And recommends that she verify on the Dallas College course schedule

**QA Verification:**
- Bot correctly identifies certificate program 
- Response includes a disclaimer (this is important) that availability may vary by semester
#The disclaimer really matters here because even when I try to enroll for classes, it some how brings me to last year class schedule which could be really confusing 

###### End ######

# Story ID DP - 04
# Feature - AI Degree Planning
**Persona:** Sean — P4 — International Students
**Priority:** P0 | **Effort:** L / 5

**Persona Reference**

Sean is a 22-year-old international student from South Korea who just got accepted
to Dallas College. He needs help understanding which courses he needs to take,
whether his English level meets the prerequisites, and how many credit hours
he is allowed to take on his student visa.

**User Story:**

As an International Student,
I want to ask the chatbot about English prerequisites (TSI requirement) 
I also want to know how many minimum/maximum credits must I take as an International Student to maintain my visa,
I also want to know how many credits can I take online and how many must be in-person.
So that I can plan my schedule without accidentally violating
my visa requirements or enrolling in a class I'm not ready for.

**Acceptance Criteria:**
Given Sean asks about requirements for class registeration and how many credits must he take in-person and how many can he take online
Given Sean also asks "Do I really need to take TSI test, eventhough I have IELTS or TOFEL or SAT or ACT?"
When the chatbot processes his query and confirm the student status
Then it returns the required ESL/TSI for his program, or may be waived from those requirements
it also returns the number of credits allowed to take online and in-person
And clearly states the minimum credit hours required for his visa status

**Edge Cases:**

Given Sean asks in informal English
When the query is unclear
Then the chatbot asks one simple clarifying question before responding

**QA Verification:**

- Bot returns correct ESL/TSI prerequisites 
- Bot includes minimum credit hour info relevant to F-1 visa status
- Bot does not guess visa requirements — if unsure, directs it to international office 
- Bot handles informal or broken English queries without returning an error

###### End ######
