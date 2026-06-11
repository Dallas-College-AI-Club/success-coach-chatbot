# Story ID EF - 01
# Feature - Event Finder

**Persona:** Maria — P1 — Traditional Student (Freshman / Sophomore)
**Priority:** P0 | **Effort:** L / 5

**Persona Reference**
Maria is a recently enrolled student, typically around 18–20 years old,
who is not familiar with Dallas College and wants to explore more and make connections by
participating in events on campus. However, she does not know which events would align the most with her interests. She also have no idea where, when and how to find those events. She decided to ask the Dallas College AI chatbot about her questions.

**User Story:**
As a first-year student,
I want to ask the chatbot about the events that are happening at Dallas College, 
So that I can discover what's going on around me without always looking through multiple flyers or bulletin board,

**Acceptance Criteria:**

Scenario: Student asks for events at their campus this week
    Given a traditional student is chatting with the Dallas College AI advisor
    When the student asks "What events are happening at Richland this week?"
    Then the bot returns a list of upcoming events at Richland Campus
    And each event entry includes: event name, date, time, building or room location, and a registration or details link where available

Scenario: Student asks without specifying a campus
    Given the student has not identified a home campus in the session
    When the student asks "What events are happening during this week?"
    Then the bot asks "Which campus are you at?"
    And once the student replies, the bot returns the correct event list without asking again

Scenario: Student asks about a specific day rather than the full week
    Given a student is in an active session
    When the student asks "Are there any events this Friday at El Centro?"
    Then the bot filters results to Friday only
    And returns only events occurring on that day at El Centro Campus

Student may also ask, "Can you list clubs and student organizations at Richland campus?"

**Edge Cases:**
- Scenario: Almost all of the events at Dallas College are advertise through social media/flyers around the campus/ bulletin board/ word of mouth 
    Given a student asks for events flyers she saw at "Mountain View" this week, and she ask bot that she wannted to know more information about that event
    When the bot cannot find that specific event information on the website or the data source
    Then the bot responds with a friendly message saying that no match events can be found
    Then the bot refers to contact student life to check what events are coming with the email address and phone number tag at the bottom

**QA Verification:**
- Bot does not initiate without verifying the campus location
- If found, bot return each result includes all required fields such as name, date, time, location
- If not, bot suggest to reach out student life 

###### End ######

# Story ID EF - 02
# Feature - Event Finder

**Persona:** John — P2 — Transfer Student
**Priority:** P0 | **Effort:** L / 5

**Persona Reference**
John is a transfer student from Collin College who is not familiar with Dallas College and its different campuses. He wants to explore and make more friends through events, and he starts asking the bot for information.

**User Story:**
As a transfer student new to Dallas College,
I want to search for events at my campus,
so that I can explore and make more connections


**Acceptance Criteria:**
## These Scenarios also apply to transfer student ##
Scenario: Student asks for events at their campus this week
    Given a transfer student is chatting with the Dallas College AI advisor
    When the student asks "What events are happening at Richland this week?"
    Then the bot returns a list of upcoming events at Richland Campus
    And each event entry includes: event name, date, time, building or room location, and a registration or details link where available

Scenario: Student asks without specifying a campus
    Given the student has not identified a home campus in the session
    When the student asks "What events are happening during this week?"
    Then the bot asks "Which campus are you at?"
    And once the student replies, the bot returns the correct event list without asking again

Scenario: Student asks about a specific day rather than the full week
    Given a student is in an active session
    When the student asks "Are there any events this Friday at El Centro?"
    Then the bot filters results to Friday only
    And returns only events occurring on that day at El Centro Campus

**Edge Cases:**
## The edge cases also apply to transfer student ##
Scenario: Almost all of the events at Dallas College are advertise through social media/flyers around the campus/ bulletin board/ word of mouth 
    Given a student asks for events flyers he saw at "Mountain View" this week, and she ask bot that she wannted to know more information about that event
    When the bot cannot find that specific event information on the website or from the data source
    Then the bot responds with a friendly message saying that no match events can be found
    Then the bot refers to contact student life to check what events are coming with the email address and phone number tag at the bottom

**QA Verification:**
- Bot does not initiate without verifying the campus location
- If found, bot return each result includes all required fields such as name, date, time, location
- If not, bot suggest to reach out to student life 

###### End ######

# Story ID EF - 03
# Feature - Event Finder

**Persona:** Hannah — P3 — Lifelong Learners (Continuing Ed / Certification)
**Priority:** P0 | **Effort:** L / 5

**Persona Reference**
Hannah is a 45-year-old student who is wondering if Dallas College has any online activities, events or any events during weekends as she will not be able to come to campus during weekdays.

**User Story:**
As a lifelong learner enrolled in continuing education or certification programs,
I want to ask the chatbot to show me events that happen in the evenings or on weekends,
so that I can participate in campus life and academic events without conflicting with my work schedule.


**Acceptance Criteria:**
Scenario: Lifelong learner asks for evening events
    Given a continuing education student is in an active chat session
    When the student asks "Are there any events happening in the evenings?"
    Then the bot returns events with a start time at or after 5:00 PM
    And each result includes: event name, date, day of week, start time, campus, and a details link
    And events starting before 5:00 PM are excluded from the results

Scenario: Lifelong learner asks for weekend events
    Given the student asks "What events are on this weekend?"
    When the bot processes the query
    Then the bot returns only events occurring on Saturday or Sunday within the next 7 days
    And the results are sorted by date ascending
    And weekday events are excluded entirely

Scenario: Lifelong learner asks for online events
    Given the student asks "Are there any online events available?"
    Then the bot returns list of online events 
    And each result includes: event name, date, start time, details link

Scenario: Lifelong learner combines time and day filters
    Given the student asks "Are there any Saturday evening events at Mountain View?"
    When the bot processes the query
    Then the bot filters results by campus ("Mountain View"), day of week (Saturday), and time (at or after 5:00 PM)
    And only events satisfying all three constraints are returned

 

**Edge Cases:**
Scenario: No evening or weekend events are scheduled during the week
    Given the student asks for weekend events
    When the data source returns no events on Saturday or Sunday 
    Then the bot clearly states no weekend events are currently scheduled

Scenario: Almost all of the events at Dallas College are advertise through social media/flyers around the campus/ bulletin board/ word of mouth 
    Given a student asks for events flyers she saw at "Mountain View" this week, and she ask bot that she wannted to know more information about that event
    When the bot cannot find that specific event information on the website or from the data source
    Then the bot responds with a friendly message saying that no match events can be found
    Then the bot refers to contact student life to check what events are coming with the email address and phone number tag at the bottom


**QA Verification:**
- Bot does not initiate without verifying the campus location
- Events with no match time, date and location are excluded 
- Bot only return the result when all the user constraints are all met
- If found, bot return each result includes all required fields such as name, date, time, location
- If not, bot suggest to reach out to student life 

###### End ######

# Story ID EF - 04
# Feature - Event Finder

**Persona:** Sean — P4 — International Students
**Priority:** P0 | **Effort:** L / 5

**Persona Reference**
Sean is a 22-year-old international student from South Korea who just got accepted
to Dallas College. He wanted to find events on his campus that are related to international student life and cultural communities

**User Story:**
As an international student at Dallas College,
I want to ask the chatbot to find events related to international student life, cultural communities, and ESL support,
so that I can find a sense of community, get the support I need, and feel connected to campus life in a new country.


**Acceptance Criteria:**
Scenario: International student searches for events from their home culture
    Given an international student is in an active chat session
    When the student asks "Are there any events for students from Korea?"
    Then the bot queries events tagged or associated with relevant cultural communities or student organizations
    And returns events matching that cultural focus if any exist in the system
    And each result includes: event name, date, time, campus, hosting organization

Scenario: International student searches for general international student events
    Given the student asks "What events are there for international students?"
    When the bot processes the query
    Then it returns events tagged under categories such as: international, cultural, ESL, language exchange, ISS (International Student Services), or global
    And results are not limited to a single cultural group


**Edge Cases:**
Scenario: No cultural or international events exist for the student's specific community
    Given a student asks about events for a specific cultural group not represented in the calendar
    When the data source returns no matching results
    Then the bot clearly states no events for that specific community are currently listed
    And suggests the student contact the International Student Services (ISS) office
    And provides the ISS office contact or link if available in the knowledge base


Scenario: Almost all of the events at Dallas College are advertise through social media/flyers around the campus/ bulletin board/ word of mouth 
    Given a student asks for events flyers she saw at "Mountain View" this week, and she ask bot that she wannted to know more information about that event
    When the bot cannot find that specific event information on the website or from the data source
    Then the bot responds with a friendly message saying that no match events can be found
    Then the bot refers to contact student life to check what events are coming with the email address and phone number tag at the bottom


**QA Verification:**
- Bot returns culturally relevant events when queried with a specific cultural group name
- Bot only return the result when all the user constraints are all met
- If found, bot return each result includes all required fields such as name, date, time, location
- If not bot returns the ISS office contact and a helpful message when no community-specific events are found.

###### End ######
