# Story ID LF - 01
# Feature - Lost And found

**Persona:** Maria — P1 — Traditional Student (Freshman / Sophomore)
**Priority:** P0 | **Effort:** L / 5

**System context**: The Lost & Found Board is a peer-to-peer reporting system.
Students submit lost or found item reports through the chatbot. Found item is return to student life or (any relavent student office), then posts
enter an admin approval queue before becoming publicly visible on the board.
Lost item reports are immediately logged and matched against approved found posts.

**Persona Reference**
Maria is a recently enrolled student, typically around 18–20 years old,
who lost her belongings on campus during her class. She doesn’t have any time to look all over the campus, so she decides to submit a lost item report through the chatbot.

**User Story:**
As a traditional student who has lost an item on campus,
I want to submit a lost item report through the chatbot by describing what I lost, when, and where,
so that I am notified if someone found and turned it in,(without having to keep checking with the office in person).

**Acceptance Criteria:**

Scenario: Student submits a complete lost item report
    Given a traditional student is chatting with the Dallas College AI advisor
    When the student says "I lost my backpack on campus"
    Then the bot initiates a guided report flow
    And collects the following fields one at a time: item description, date lost, campus, and student email or phone
    And once all fields are collected, displays a summary for the student to confirm
    And upon confirmation, saves the report to the Lost & Found database
    And returns a unique report ID and confirmation message to the student

Scenario: If student provides all details in a single message
    Given the student sends "I lost my black North Face backpack at Richland on Tuesday"
    When the bot parses the message
    Then it extracts the item description, campus, and approximate date from the single message
    And only asks for the missing required fields (contact info) rather than repeating what was already provided

Scenario: Student asks about the status of a previously submitted report
    Given a student provides their report ID
    When they ask "Any updates on my lost backpack? My report ID is LF-20260512-003"
    Then the bot queries the database for that report ID
    And returns the current status (e.g., "Open — no match found yet" or "Match found — see details below")
    And it will also return instructions on how to claim that item(For example, "Your item can be claim at Richland Campus Building S 223, Student Life Center)

**Edge Cases:**
Scenario: Student abandons the report flow midway
    Given a student has started the report flow but stops responding after the second field
    When the session times out
    Then the bot does NOT save an incomplete report to the database
    And the partial data is discarded (for saving the memory)
    And if the student returns, the bot offers to start the report again from the beginning

Scenario: Student submits a duplicate report for the same item
    Given a student has already submitted a report for a lost laptop at Richland
    When they submit another report with an identical or near-identical description, date, and campus
    Then the bot detects the likely duplicate and alerts the student before saving it
    And asks whether they want to submit a new report or update the existing one

**QA Verification:**
- Completed reports appear in the Lost & Found database with all required fields populated.
- Bot extracts pre-supplied details from a single message and only prompts for missing fields.
- Incomplete reports (abandoned sessions) are not saved to the database.
- Each submitted report receives a unique report ID returned to the student.
- Duplicate detection triggers when description, campus, and date match an existing open report.

###### End ######

# Story ID LF - 02
# Feature - Lost And found

**Persona:** John — P2 — Transfer Student
**Priority:** P0 | **Effort:** L / 5

**Persona Reference**
John is a transfer student from Collin College who is not familiar with Dallas College and its different campuses. He found an item on his way to another class, but he doesn’t know what to do or where to return it. He decides to ask the chatbot where to return the item.

**User Story:**
As a transfer student who has found an item left behind on campus,
I want to report the found item through the chatbot so it enters the admin approval queue,
so that the rightful owner can be notified and I can hand it off to the right person without keeping it myself.

**Acceptance Criteria:**

Scenario: Student submits a found item report through the chatbot
    Given a transfer student tells the chatbot "I found someone's ID card near the library at Eastfield"
    When the bot initiates the found item report flow
    Then it collects: item description, location found, date found, campus, and the finder's contact info
    And upon confirmation, saves the report with status "Pending Admin Approval"
    And the report appears in the admin moderation queue
    And the student receives a confirmation message stating the report is under review

    For this scenario, student may also initiate the conversation with
    - "I found an ID card. What should I do?"
    - "Can you help me report a found item?" followed by
    - "Where should I take this item?"

Scenario: Admin approves a found item report
    Given a found item report is sitting in the admin queue with status "Pending"
    When the admin reviews and approves the report
    Then the report status changes to "Approved — Live"
    And the item becomes visible on the public Lost & Found board
    And if a matching lost item report exists, the original reporter is notified automatically

Scenario: Admin rejects a found item report
    Given an admin reviews a report that is unclear, inappropriate, or violates policy
    When the admin rejects the report
    Then the report status changes to "Rejected"
    And the finder receives a notification explaining the report was not approved
    And the item does NOT appear on the public board

**Edge Cases:**
Scenario: Finder submits a report with no item description
    Given a student initiates a found item report but skips the description field
    When they attempt to submit
    Then the bot blocks submission and prompts for a description before proceeding
    And clearly states that a description is required to help identify the owner

Scenario: Admin queue is unreviewed for more than 48 hours
    Given a found item report has been in "Pending" status for over 48 hours
    When the system checks queue age
    Then an automated alert is sent to the admin or designated staff member
    And the report remains in "Pending" status; it does NOT auto-approve or auto-reject

**QA Verification:**
- Submitted found item reports appear in the admin queue with status "Pending" immediately after submission.
- Approved reports become visible on the public board and trigger matching notifications if applicable.
- Rejected reports do not appear on the public board and the finder receives a rejection notification.
- Bot blocks submission when the item description field is empty.
 A 48-hour queue alert fires correctly in a simulated test with a backdated "Pending" report.

###### End ######

# Story ID LF - 03
# Feature - Lost And found
**Persona:** Hannah — P3 — Lifelong Learners (Continuing Ed / Certification)
**Priority:** P0 | **Effort:** L / 5

**Persona Reference**
Hannah is a life long learner who balances school, work, and personal life. Hannah has a pretty hectic schedule and most of her classes are all online. She sometimes attends campus event on the weekend at the Richland campus. After the event, she realize that she forgets her laptop charger in the event room.
Because Hannah is busy, she cannot spend time searching around campus or going to different offices. She wants a quick and simple way to report or find her item.She prefers a process that is easy to follow, with clear steps and no extra work.

**User Story:**
As a life long learner who has lost an item on campus during events,
I want to submit a lost item report through the chatbot by describing what I lost, when, and where,
so that I am notified if someone found and turned it in,(without having to keep checking with the office in person).

**Acceptance Criteria:**

Scenario: Student submits a complete lost item report
    Given a student started chatting with the Dallas College AI chatbot
    When the student says "I lost my white laptop charger, what should I do?"
    Then the bot initiates a guided report flow
    And collects the following fields one at a time: item description, date lost, campus, and student email or phone
    And once all fields are collected, displays a summary for the student to confirm
    And upon confirmation, saves the report to the Lost & Found database
    And returns a unique report ID and confirmation message to the student

Scenario: If student provides all details in a single message
    Given the student sends "I lost my white laptop charger on campus around 5:00pm in building E at Richland on Tuesday"
    When the bot parses the message
    Then it extracts the item description, campus, and approximate date from the single message
    And only asks for the missing required fields (contact info) rather than repeating what was already provided

Scenario: Student asks about the status of a previously submitted report
    Given a student provides their report ID
    When they ask "Any updates on my lost charger? My report ID is LF-20260512-029"
    Then the bot queries the database for that report ID
    And returns the current status (e.g., "Open — no match found yet" or "Match found — see details below")
    And it will also return instructions on how to claim that item(For example, "Your item can be claim at Richland Campus Building S 223, Student Life Center)

**Edge Cases:**
#We can apply edge cases from traditional student as well

Scenario: Student abandons the report flow midway
    Given a student has started the report flow but stops responding after the second field
    When the session times out
    Then the bot does NOT save an incomplete report to the database
    And the partial data is discarded (for saving the memory)
    And if the student returns, the bot offers to start the report again from the beginning

Scenario: Student submits a duplicate report for the same item
    Given a student has already submitted a report for a lost laptop at Richland
    When they submit another report with an identical or near-identical description, date, and campus
    Then the bot detects the likely duplicate and alerts the student before saving it
    And asks whether they want to submit a new report or update the existing one

**QA Verification:**
- Completed reports appear in the Lost & Found database with all required fields populated.
- Bot extracts pre-supplied details from a single message and only prompts for missing fields.
- Incomplete reports (abandoned sessions) are not saved to the database.
- Each submitted report receives a unique report ID returned to the student.
- Duplicate detection triggers when description, campus, and date match an existing open report.


###### End ######

# Story ID EF - 04
# Feature - Event Finder

**Persona:** Sean — P4 — International Students
**Priority:** P0 | **Effort:** L / 5

**Persona Reference**
Sean is a 22-year-old international student from South Korea who just lost his passport while he was registering for his TSI/ALEKS exam at the Brookhaven campus. He urgently reports the case to the chatbot.

**User Story:**
As an international student who has lost a government-issued ID or passport on campus,
I want to ask the chatbot to urgently search the Lost & Found board and tell me exactly how to claim it,
so that I can recover a document that affects my visa status and legal residency as quickly as possible.


**Acceptance Criteria:**

Scenario: International student reports a lost passport or government ID
    Given an international student says "I lost my passport at Richland Campus"
    When the bot detects a high-urgency item type (passport, visa card, government ID, I-20, permanent resident card, credit/debit, driver license)
    Then it immediately acknowledges the urgency of the situation
    And searches the approved Lost & Found board for matching records at the stated campus
    And regardless of search results, also provides the International Student Services (ISS) office contact for that campus
    And advises the student to contact ISS as soon as possible

Scenario: Matching government ID found on the board
    Given the search returns a record matching the student's described document
    When the bot presents the result
    Then it send an automatic email to student and provides instructions such as, claim location, office hours, and required documentation
    And reminds the student to bring their student ID and any secondary identification when claiming

Scenario: Student asks what to do if their government ID is not found
    Given no matching records are found on the board for the described document
    When the student asks "What should I do if my document is not found?"
    Then the bot provides a clear next-step checklist:
      - File a lost item report to be notified if it turns up
      - Contact the ISS office immediately
      - Contact campus security to check if it was handed in directly
    And does NOT attempt to give legal or immigration advice beyond directing to the appropriate offices

    Student may also initiate the conversation with
    - "Where should I go for help?"
    - "Can you connect me to International Student Services?"



**Edge Cases:**

Scenario: Student does not specify when and where they lost the item at
    Given the student says "I lost my Passport" without mentioning when and where
    When the bot processes the query
    Then it asks when and which campus the item was lost at before running the search
    And does NOT search all campuses simultaneously without confirmation, to avoid returning confusing multi-campus results


**QA Verification:**
- Bot correctly detects government ID keywords (passport, I-20, visa, government ID, permanent resident card) and triggers as urgent
- ISS office contact information is included in every response involving a lost government document, regardless of whether a board match was found.
- Next-step checklist is returned correctly when no match is found and student asks what to do.
- Bot asks for campus clarification and the time before searching 

###### End ######

