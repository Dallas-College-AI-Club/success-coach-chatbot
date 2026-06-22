# Dallas College Current Events Data Source Research

## What I Worked On

For this task, I researched the different Dallas College event sources that are publicly available and documented the information that could potentially be used by the Success Coach Chatbot.

I reviewed several areas of the Dallas College website, including:

- Academic Calendar
- Student Life Events
- Campus News and Closures
- Counseling Workshops and Events

While reviewing these sources, I identified the types of information available, the common data fields included on event pages, possible ways to access the data, and examples of how the data could be structured for use within the application.

I also created sample JSON and XML payloads, documented a data dictionary, and provided recommendations for data updates and synchronization.


## Academic Calendar

The first source I looked at was the Academic Calendar.

I found that it contains important information students frequently need, such as:

- Enrollment dates
- Registration deadlines
- Semester start and end dates
- Final exam dates
- Withdrawal deadlines
- Grade submission deadlines
- Holidays and campus closures

After reviewing several semesters, I noticed the information is organized consistently and is easy to follow. I think this would be a useful source for helping students keep track of important academic deadlines.

---

## Student Life Events

I also reviewed several Student Life event pages.

Some examples I found were:

- Summer of Soccer Watch Party
- Student Parents Thrive
- WOW (Week of Welcome)
- Magic at Mountain View

Most of these pages followed a similar format and included:

- Event title
- Date
- Time
- Location
- Description
- Contact information
- Event categories

One thing I noticed is that many event pages also provide Google Calendar and Outlook Calendar links, which could be useful if the team decides to automate event collection in the future.

---

## Campus News and Closures

Another source I reviewed was Dallas College news and announcements.

I found posts related to:

- Campus closures
- Winter break schedules
- Food pantry resources
- Student support services
- Mental health resources

Although these are not traditional events, I think they are still important because students may ask questions about campus availability or support resources.

---

## Counseling Workshops

I also looked at Counseling and Psychological Services workshops.

These workshops focus on:

- Mental health
- Student wellness
- Career development
- Academic success

While there were not many upcoming events listed when I did my research, the page shows that Dallas College regularly offers programs and workshops that could be useful to students.

---

## Data Fields I Found

After comparing several event pages, I found that most of them include the following information:

- Event Name
- Event Date
- Start Time
- End Time
- Description
- Campus
- Building
- Room
- Contact Email
- Event Categories

Some events also include:

- Multiple locations
- Multiple campuses
- Special instructions
- Calendar export links

Because many pages follow a similar format, I think the data could be organized into a consistent structure.

---

## Access Method

Based on my research, most of the information is publicly accessible.

I confirmed that event pages can be viewed without logging in and that many events provide:

- Google Calendar links
- Outlook/iCal (.ics) downloads

I was not able to find a public REST API during my research.

Because of that, my recommendation would be:

1. Use calendar feeds if available.
2. Use ICS files when available.
3. Use web scraping as a backup option.

---

## Authentication

I did not encounter any authentication requirements while researching.

I was able to access all pages without:

- Logging in
- Creating an account
- Using an API key

---

## Update Frequency Recommendation

Based on the type of information I found, I would recommend:

- Academic Calendar: once per day
- Student Life Events: every 6 hours
- Campus News: every 3-6 hours
- Counseling Workshops: once per day

Overall, I think syncing every 6 hours would be a reasonable balance between keeping information updated and avoiding unnecessary requests.

---
## Sample JSON - Student Life Event

{
  "eventId": "summer-soccer-watch-party-mv-2026-06-22",
  "eventName": "Summer of Soccer Watch Party",
  "eventDate": "2026-06-22",
  "startTime": "12:00 PM",
  "endTime": "2:30 PM",
  "category": [
    "Student Life",
    "Special Events" ],
  "description": "Join Intercultural and Global Student Engagement (IGSE) for a World Cup soccer watch party.",
  "campus": "Mountain View",
  "building": "IGSE Suite",
  "room": "W124",
  "city": "Dallas",
  "state": "TX",
  "contactEmail": "IGSE@DallasCollege.edu",
  "icsAvailable": true,
  "googleCalendarAvailable": true
}

---

## Sample JSON - Academic Calendar

{
  "title": "Final Exams",
  "term": "Fall 2026 Semester",
  "startDate": "2026-12-07",
  "endDate": "2026-12-10",
  "location": "All Locations",
  "allDay": true,
  "category": "Academic Calendar"
}
---

## Sample JSON - Campus Closure

{
  "title": "Campus Closures and Support During the Winter Break",
  "announcementType": "Campus Closure",
  "startDate": "2025-12-24",
  "endDate": "2026-01-01",
  "affectedLocations": "All Dallas College Locations",
  "category": "Campus News"
}

---

## Sample JSON - Counseling Workshop

{
  "department": "Counseling and Psychological Services",
  "title": "Food for Thought",
  "category": [
    "Mental Health",
    "Wellness",
    "Academic Success"
  ],
  "targetAudience": [
    "Students",
    "Employees",
    "General Public"
  ]
}

---

## Sample XML

<event>
  <eventName>Summer of Soccer Watch Party</eventName>
  <eventDate>2026-06-22</eventDate>
  <startTime>12:00 PM</startTime>
  <endTime>2:30 PM</endTime>
  <campus>Mountain View</campus>
  <room>W124</room>
</event>

---

## Data Dictionary

{
  "eventName": "Name of the event",
  "eventDate": "Date of the event",
  "startTime": "When the event starts",
  "endTime": "When the event ends",
  "description": "Details about the event",
  "campus": "Campus hosting the event",
  "building": "Building where the event takes place",
  "room": "Room number if available",
  "category": "Event category",
  "contactEmail": "Email for questions about the event",
  "icsAvailable": "Whether Outlook/iCal export exists",
  "googleCalendarAvailable": "Whether Google Calendar export exists"
}
---
