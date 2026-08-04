<!-- facts-cv-v2 worked examples (team-ratified 2026-07). Five real CVs
     covering the corpus's shapes: dated-positions researcher, year-list
     practitioner, org-first hybrid, empty shell, thin course-list. One
     file on purpose (fewest-files rule); the EXAMPLES splice treats one
     file exactly like five. Full ratification records: SharePoint etl. -->


---

# Worked example — facts-cv-v2 exemplar: a dated-positions CV (industry researcher who now teaches)
### Context given to the extractor
```json
{"professor": "Bracewell, David", "scrape_year": 2026}
```

### Correct output
```json
{
  "name": "David Bracewell",
  "department": null,
  "email": null,
  "cv_url": null,
  "courses_taught": [],
  "education": [
    {
      "institution": "The University of Tokushima",
      "location": "Tokushima, Japan",
      "degree": "Doctor of Philosophy",
      "field": "Information Science and System Engineering",
      "year": null,
      "raw_text": "The University of Tokushima, Tokushima, Japan Doctor of Philosophy, Information Science and System Engineering"
    },
    {
      "institution": "The University of Central Florida",
      "location": "Orlando, FL",
      "degree": "Master of Science",
      "field": "Computer Science",
      "year": null,
      "raw_text": "The University of Central Florida, Orlando, FL Master of Science, Computer Science"
    },
    {
      "institution": "The University of Central Florida",
      "location": "Orlando, FL",
      "degree": "Bachelor of Science",
      "field": "Computer Science",
      "year": null,
      "raw_text": "The University of Central Florida, Orlando, FL Bachelor of Science, Computer Science"
    },
    {
      "institution": "Seminole State College",
      "location": "Sanford, FL",
      "degree": "Associate of Arts with Honors",
      "field": null,
      "year": null,
      "raw_text": "Seminole State College, Sanford, FL Associate of Arts with Honors"
    }
  ],
  "experience": [
    {
      "organization": "Dallas College",
      "location": null,
      "role": "Faculty",
      "category": "teaching",
      "start_year": 2024,
      "end_year": null,
      "is_current": true,
      "raw_text": "Dallas College Faculty, 2024 - Present"
    },
    {
      "organization": "Colorado Technical University",
      "location": null,
      "role": "Assistant Professor",
      "category": "teaching",
      "start_year": 2018,
      "end_year": 2022,
      "is_current": false,
      "raw_text": "Colorado Technical University Assistant Professor, 2018 - 2022"
    },
    {
      "organization": "Dallas College",
      "location": null,
      "role": "Adjunct Faculty",
      "category": "teaching",
      "start_year": 2013,
      "end_year": 2015,
      "is_current": false,
      "raw_text": "Dallas College Adjunct Faculty, 2013 – 2015"
    },
    {
      "organization": "Language Computer Corporation",
      "location": "Richardson, TX",
      "role": "Principal Scientist",
      "category": "industry",
      "start_year": 2018,
      "end_year": null,
      "is_current": true,
      "raw_text": "Language Computer Corporation, Richardson, TX Principal Scientist, 2018 - Present"
    },
    {
      "organization": "Grubhub",
      "location": "New York, NY (Remote)",
      "role": "Data Scientist Team Lead",
      "category": "industry",
      "start_year": 2017,
      "end_year": 2018,
      "is_current": false,
      "raw_text": "Grubhub, New York, NY (Remote) Data Scientist Team Lead, 2017 – 2018"
    },
    {
      "organization": "Oculus360",
      "location": "Addison, TX",
      "role": "Data Science Consultant",
      "category": "industry",
      "start_year": 2017,
      "end_year": 2022,
      "is_current": false,
      "raw_text": "Oculus360, Addison, TX Data Science Consultant, 2017 – 2022"
    },
    {
      "organization": "Oculus360",
      "location": "Addison, TX",
      "role": "Vice President of Technology",
      "category": "industry",
      "start_year": 2014,
      "end_year": 2017,
      "is_current": false,
      "raw_text": "Oculus360, Addison, TX Vice President of Technology, 2014 – 2017"
    },
    {
      "organization": "Language Computer Corporation",
      "location": "Richardson, TX",
      "role": "Senior Scientist",
      "category": "industry",
      "start_year": 2011,
      "end_year": 2014,
      "is_current": false,
      "raw_text": "Language Computer Corporation, Richardson, TX Senior Scientist, 2011 - 2014"
    },
    {
      "organization": "General Electric Global Research",
      "location": "Niskayuna, NY",
      "role": "Computer Scientist",
      "category": "industry",
      "start_year": 2008,
      "end_year": 2011,
      "is_current": false,
      "raw_text": "General Electric Global Research, Niskayuna, NY Computer Scientist, 2008 - 2011"
    }
  ],
  "certifications": [],
  "publications": {
    "count": 75,
    "year_min": 2001,
    "year_max": 2015,
    "venues_sample": [
      "Proceedings of the 28th International FLAIRS Conference",
      "the 25th International Conference on Computational Linguistics (COLING) 2014",
      "15th International Conference on Intelligent Text Processing and Computational Linguistics",
      "Proceedings of The 9th edition of the Language Resources and Evaluation Conference",
      "ICSC",
      "In the Proceedings of the First Workshop on Metaphor in NLP",
      "SocialNLP 2015",
      "In the Proceedings of the Seventh International AAAI Conference on Weblogs and Social Media"
    ]
  },
  "computed": null,
  "derived_profile": {
    "orientation": "hybrid",
    "orientation_evidence": "18 union-years of continuous industry roles (GE Research 2008 through Language Computer Corporation 'Principal Scientist, 2018 - Present') alongside a 75-item publication record (2001-2015) in computational-linguistics venues and 8 years of teaching — industry practitioner with a substantial research record, teaching concurrently.",
    "expertise_topics": [
      {
        "topic": "natural language processing / computational linguistics",
        "evidence": "Language Computer Corporation, Richardson, TX Principal Scientist, 2018 - Present",
        "currency": "current",
        "evidence_years": [
          2001,
          2026
        ]
      },
      {
        "topic": "metaphor and figurative-language analysis",
        "evidence": "A Tiered Approach to the Recognition of Metaphor",
        "currency": "historical",
        "evidence_years": [
          2012,
          2014
        ]
      },
      {
        "topic": "social and behavioral language analysis",
        "evidence": "Annotation of Adversarial and Collegial Social Actions in Discourse",
        "currency": "historical",
        "evidence_years": [
          2012,
          2014
        ]
      },
      {
        "topic": "consumer insights from social data",
        "evidence": "A Four-Factor Model for Mining Consumer Insights in Social Data",
        "currency": "historical",
        "evidence_years": [
          2014,
          2015
        ]
      },
      {
        "topic": "data science leadership",
        "evidence": "Grubhub, New York, NY (Remote) Data Scientist Team Lead, 2017 – 2018",
        "currency": "recent",
        "evidence_years": [
          2014,
          2018
        ]
      },
      {
        "topic": "semantic computing",
        "evidence": "in Proceedings of the 7th IEEE International Conference on Semantic Computing",
        "currency": "historical",
        "evidence_years": [
          2012,
          2013
        ]
      },
      {
        "topic": "emotion recognition / affective computing",
        "evidence": "Determining the Emotion of News Articles",
        "currency": "historical",
        "evidence_years": [
          2005,
          2010
        ]
      },
      {
        "topic": "information retrieval and keyword extraction",
        "evidence": "Multilingual Single Document Keyword Extraction for Information Retrieval",
        "currency": "historical",
        "evidence_years": [
          2005,
          2008
        ]
      }
    ],
    "summary": "David Bracewell works as Principal Scientist at Language Computer Corporation while teaching as Faculty at Dallas College - an industry research scientist who grew through data-science leadership at Oculus360 and Grubhub and now teaches alongside active practice. Bracewell brings {{years_industry}} years of industry experience overlapping {{years_teaching}} years of teaching, a PhD in Information Science and System Engineering from the University of Tokushima, Japan, and 75 publications (2001-2015) in natural language processing, including metaphor recognition, social and behavioral language analysis, and emotion recognition. Current work is in NLP and machine learning; the research-publication record is historical (through 2015).",
    "career_path": {
      "archetype": "industry research scientist who grew through data-science leadership and now teaches alongside active practice",
      "stages": [
        {
          "label": "corporate research",
          "years": "2008-2011",
          "evidence": "General Electric Global Research, Niskayuna, NY Computer Scientist, 2008 - 2011"
        },
        {
          "label": "industry NLP research",
          "years": "2011-2014",
          "evidence": "Language Computer Corporation, Richardson, TX Senior Scientist, 2011 - 2014"
        },
        {
          "label": "technology leadership",
          "years": "2014-2017",
          "evidence": "Oculus360, Addison, TX Vice President of Technology, 2014 – 2017"
        },
        {
          "label": "data science leadership",
          "years": "2017-2018",
          "evidence": "Grubhub, New York, NY (Remote) Data Scientist Team Lead, 2017 – 2018"
        },
        {
          "label": "principal scientist and faculty, concurrently",
          "years": "2018-present",
          "evidence": "Language Computer Corporation, Richardson, TX Principal Scientist, 2018 - Present"
        }
      ]
    }
  },
  "confidence": "high",
  "teaching_record": null
}
```

### Why this is correct
- Every position and degree carries a verbatim `raw_text`; `category` comes from the
  CV's own section headings, never from the organization's name.
- `computed: null` and `teaching_record: null` ALWAYS — the pipeline does all
  arithmetic and all schedule joins. The summary writes durations as `{{years_*}}`
  tokens; only figures printed in the document (75 publications, 2001-2015) appear
  literally. The summary never lists which courses the professor teaches — that is
  joined from schedule data later, not extracted.
- `publications` is a census (count, year range, up to 8 venues), never a copied
  bibliography.
- Per-topic `currency` follows the mechanical rule: the NLP topic rides the
  is_current Principal Scientist role -> current; data-science leadership ended 2018
  (within 8y of scrape_year) -> recent; publication-backed topics ending 2010-2015
  -> historical. `evidence_years` for an open-ended supporting role uses
  scrape_year from the context as its max — never a guessed year.
- No pronouns anywhere: the CV prints none, so the summary repeats the surname.


---

# Worked example — facts-cv-v2 exemplar: year-lists, two institutions, an industry practitioner
### Context given to the extractor
```json
{"professor": "GEBHART, KELLY", "scrape_year": 2026}
```

### Correct output
```json
{
  "name": "Kelly Gebhart",
  "department": null,
  "email": null,
  "cv_url": null,
  "courses_taught": [
    "ACCT 2301",
    "ACCT 2302",
    "ACNT 1331",
    "ACNT 1311",
    "ACCT 3311",
    "ACCT 3315"
  ],
  "education": [
    {
      "institution": "University of Texas at Arlington",
      "location": null,
      "degree": "Master of Taxation",
      "field": null,
      "year": null,
      "raw_text": "Master of Taxation, University of Texas at Arlington"
    },
    {
      "institution": "Eastern Illinois University",
      "location": null,
      "degree": "Bachelor of Science in Business",
      "field": "Accountancy",
      "year": null,
      "raw_text": "Bachelor of Science in Business – Accountancy, Eastern Illinois University"
    }
  ],
  "experience": [
    {
      "organization": "Dallas College",
      "location": null,
      "role": "Faculty",
      "category": "teaching",
      "start_year": 2024,
      "end_year": 2025,
      "is_current": null,
      "raw_text": "Faculty, Dallas College, 2024, 2025"
    },
    {
      "organization": "University of Texas at Arlington",
      "location": null,
      "role": "Adjunct assistant professor",
      "category": "teaching",
      "start_year": 2024,
      "end_year": 2025,
      "is_current": null,
      "raw_text": "Adjunct assistant professor, University of Texas at Arlington 2024, 2025"
    },
    {
      "organization": "Grant Thornton",
      "location": null,
      "role": "Experienced tax manager",
      "category": "industry",
      "start_year": 2016,
      "end_year": 2020,
      "is_current": false,
      "raw_text": "Experienced tax manager, Grant Thornton, 2016-2020"
    },
    {
      "organization": "Heidelburg Materials North America (FKA Lehigh Hanson, Inc.)",
      "location": null,
      "role": "Senior tax accountant",
      "category": "industry",
      "start_year": 2012,
      "end_year": 2016,
      "is_current": false,
      "raw_text": "Senior tax accountant, Heidelburg Materials North America (FKA Lehigh Hanson, Inc.), 2012-2016"
    }
  ],
  "certifications": [
    {
      "name": "Certified Member of the Institute (CMI)",
      "issuer": "Institute of Professionals in Taxation",
      "raw_text": "Certified Member of the Institute (CMI), Institute of Professionals in Taxation"
    }
  ],
  "publications": {
    "count": 1,
    "year_min": 2022,
    "year_max": 2022,
    "venues_sample": [
      "CPA Journal"
    ]
  },
  "computed": null,
  "derived_profile": {
    "orientation": "industry_practitioner",
    "orientation_evidence": "Printed professional roles run 2012-2020 (Senior tax accountant, Heidelburg Materials North America, 2012-2016; Experienced tax manager, Grant Thornton, 2016-2020) plus undated 'Other industry and public accounting positions', while printed teaching covers 2024 and 2025 and the publication record is one 2022 CPA Journal article. The CV's own experience statement — 'I use my extensive work experience in industry and public accounting to introduce real life examples into my lectures' — frames practice as the source material for the teaching.",
    "expertise_topics": [
      {
        "topic": "sales and use tax compliance and audit defense",
        "evidence": "Served as the subject matter expert for cement business line for North American (U.S. and Canada) sales tax including researching taxability, advising plant managers, managing audits, and filing returns.",
        "currency": "recent",
        "evidence_years": [
          2012,
          2020
        ]
      },
      {
        "topic": "federal income taxation",
        "evidence": "ACNT 1331 Federal Income Tax, Individual",
        "currency": "current",
        "evidence_years": [
          2024,
          2025
        ]
      },
      {
        "topic": "financial and managerial accounting",
        "evidence": "ACCT 2301 Principles of Financial Accounting",
        "currency": "current",
        "evidence_years": [
          2024,
          2025
        ]
      },
      {
        "topic": "computerized accounting",
        "evidence": "ACNT 1311 Intro to Computerized Accounting",
        "currency": "current",
        "evidence_years": [
          2024,
          2025
        ]
      },
      {
        "topic": "Covid-19 pandemic impact on the auditing profession",
        "evidence": "The new working world of the Covid-19 pandemic: A tumultuous time for auditors, industries, and the PCAOB",
        "currency": "recent",
        "evidence_years": [
          2022,
          2022
        ]
      },
      {
        "topic": "tax staff training and mentoring",
        "evidence": "teaching, coaching, and mentoring seniors, associates, and interns",
        "currency": "recent",
        "evidence_years": [
          2016,
          2020
        ]
      }
    ],
    "summary": "Kelly Gebhart has taught accounting at Dallas College (ACCT 2301, ACCT 2302, ACNT 1331, ACNT 1311; 2024, 2025), served as adjunct assistant professor at the University of Texas at Arlington (2024, 2025), and brings {{years_industry}} years of industry and public accounting experience: senior tax accountant at Heidelburg Materials North America (2012-2016), tax manager at Grant Thornton (2016-2020), and additional undated industry and public accounting positions, centered on U.S. and Canadian sales and use tax compliance and audit defense. Gebhart holds a Master of Taxation from the University of Texas at Arlington and the Certified Member of the Institute (CMI) credential, and co-authored one 2022 CPA Journal article on auditing during the Covid-19 pandemic and the PCAOB.",
    "career_path": {
      "archetype": "tax practitioner who moved from industry and public accounting into college accounting teaching",
      "stages": [
        {
          "label": "corporate tax accounting",
          "years": "2012-2016",
          "evidence": "Senior tax accountant, Heidelburg Materials North America (FKA Lehigh Hanson, Inc.), 2012-2016"
        },
        {
          "label": "public accounting tax management",
          "years": "2016-2020",
          "evidence": "Experienced tax manager, Grant Thornton, 2016-2020"
        },
        {
          "label": "additional industry and public accounting positions",
          "years": "undated",
          "evidence": "Other industry and public accounting positions"
        },
        {
          "label": "college accounting teaching at two institutions",
          "years": "2024-2025",
          "evidence": "Faculty, Dallas College, 2024, 2025"
        }
      ]
    }
  },
  "confidence": "high",
  "teaching_record": null
}
```

### Why this is correct
- "Faculty, Dallas College, 2024, 2025" is a YEAR-LIST, not a range and not
  "Present": start/end = min/max and `is_current: null` — the CV asserts neither
  ongoing nor ended, and the summary therefore says "has taught", never "teaches".
  Whether the professor teaches NOW is the schedule join's job, not a guess.
- Codes from both institutions go to `courses_taught` exactly as printed, deduped
  (ACCT 2302 prints twice), in document order.
- "Experienced tax manager" stays verbatim in the extractive tier — it is the
  printed job title; the derived tier never adds such adjectives itself.
- The undated "Other industry and public accounting positions" line cannot be an
  `experience` entry (no organization/role); it surfaces only as a career_path
  stage with years "undated", quoting the printed line.
- The single 2022 article yields a topic named for what the article is about
  ("Covid-19 pandemic impact on the auditing profession"), NOT a practice-area
  claim like "audit practice" — one article never establishes a practice domain.


---

# Worked example — facts-cv-v2 exemplar: org-first entries, registrations, an industry+teaching hybrid
### Context given to the extractor
```json
{"professor": "Vail, Douglas", "scrape_year": 2026}
```

### Correct output
```json
{
  "name": "Douglas Richard Vail",
  "department": null,
  "email": null,
  "cv_url": null,
  "courses_taught": [
    "ARCH-1311",
    "ARCH-1301",
    "ARCH-1302",
    "ARCH-1303",
    "ARCH-1304",
    "ARCH-1307",
    "ARCH-1308",
    "ARCH-2312",
    "IDME-40464",
    "IDME-30413",
    "IDME-30493",
    "IDME-30423",
    "IDME-20453",
    "IDME-30473",
    "IDME-30483"
  ],
  "education": [
    {
      "institution": "University of Texas at Arlington",
      "location": "Arlington, Texas",
      "degree": "Master of Architecture (M. ARCH)",
      "field": null,
      "year": 2001,
      "raw_text": "University of Texas at Arlington, Arlington, Texas, Master of Architecture (M. ARCH), 2001"
    },
    {
      "institution": "Bethany College",
      "location": "Bethany, West Virginia",
      "degree": "Bachelor of Arts (Magna cum Laude)",
      "field": "English",
      "year": 1991,
      "raw_text": "Bethany College, Bethany, West Virginia, Bachelor of Arts (Magna cum Laude), English , 1991"
    }
  ],
  "experience": [
    {
      "organization": "Dallas College (Dallas County Community College District)",
      "location": "Dallas, Texas",
      "role": "Program Coordinator/Faculty, Architecture Program",
      "category": "teaching",
      "start_year": 2015,
      "end_year": null,
      "is_current": true,
      "raw_text": "Program Coordinator/Faculty, Architecture Program Dallas College (Dallas County Community College District) Dallas, Texas, August 2015 – present"
    },
    {
      "organization": "Texas Christian University",
      "location": "Fort Worth, Texas",
      "role": "Lecturer, Interior Design, College of Fine Arts",
      "category": "teaching",
      "start_year": 2013,
      "end_year": 2015,
      "is_current": false,
      "raw_text": "Lecturer, Interior Design, College of Fine Arts Texas Christian University, Fort Worth, Texas, August 2013 – August 2015"
    },
    {
      "organization": "Tarrant County College",
      "location": "Fort Worth, Texas",
      "role": "Adjunct Professor – Interior Design I",
      "category": "teaching",
      "start_year": 2013,
      "end_year": 2013,
      "is_current": false,
      "raw_text": "Adjunct Professor – Interior Design I Northwest Campus, Tarrant County College, Fort Worth, Texas, January – December 2013"
    },
    {
      "organization": "American Institute of Architects (AIA), Dallas Chapter",
      "location": null,
      "role": "Continuing Education Instructor – AIA Revit Workshop",
      "category": "teaching",
      "start_year": 2012,
      "end_year": 2013,
      "is_current": false,
      "raw_text": "Continuing Education Instructor – AIA Revit Workshop American Institute of Architects (AIA), Dallas Chapter, 2012 – 2013"
    },
    {
      "organization": "Studio Vail LLC",
      "location": "Argyle, Texas",
      "role": "Owner/Registered Architect/Registered Accessibility Specialist/Urban Planning Specialist",
      "category": "industry",
      "start_year": 2009,
      "end_year": 2020,
      "is_current": false,
      "raw_text": "Studio Vail LLC Argyle, Texas, February 2009 – June 2020 Owner/Registered Architect/Registered Accessibility Specialist/Urban Planning Specialist"
    },
    {
      "organization": "CSD",
      "location": "Dallas, Texas",
      "role": "Architect",
      "category": "industry",
      "start_year": 2006,
      "end_year": 2009,
      "is_current": false,
      "raw_text": "CSD Dallas, Texas, May 2006 - January 2009 Architect"
    },
    {
      "organization": "Three Architecture",
      "location": "Dallas, Texas",
      "role": "Architectural Intern/Designer",
      "category": "industry",
      "start_year": 2003,
      "end_year": 2006,
      "is_current": false,
      "raw_text": "Three Architecture Dallas, Texas, July 2003 - May 2006 Architectural Intern/Designer"
    },
    {
      "organization": "JH+P",
      "location": "Dallas, Texas",
      "role": "Architectural Intern/Designer",
      "category": "industry",
      "start_year": 2001,
      "end_year": 2003,
      "is_current": false,
      "raw_text": "JH+P Dallas, Texas, August 2001 – June 2003 Architectural Intern/Designer"
    }
  ],
  "certifications": [
    {
      "name": "Texas Board of Architectural Examiners (TBAE) Registration No. 20674",
      "issuer": "Texas Board of Architectural Examiners (TBAE)",
      "raw_text": "Texas Board of Architectural Examiners (TBAE) Registration No. 20674"
    },
    {
      "name": "National Council of Architectural Registration Boards (NCARB) No. 65632",
      "issuer": "National Council of Architectural Registration Boards (NCARB)",
      "raw_text": "National Council of Architectural Registration Boards (NCARB) No. 65632"
    },
    {
      "name": "Texas Department of Licensing & Registration (TDLR) Registered Accessibility Specialist No. 1289",
      "issuer": "Texas Department of Licensing & Registration (TDLR)",
      "raw_text": "Texas Department of Licensing & Registration (TDLR) Registered Accessibility Specialist No. 1289"
    },
    {
      "name": "American Institute of Architects (AIA), No. 30209664",
      "issuer": "American Institute of Architects (AIA)",
      "raw_text": "American Institute of Architects (AIA), No. 30209664"
    }
  ],
  "publications": {
    "count": 1,
    "year_min": null,
    "year_max": null,
    "venues_sample": []
  },
  "computed": null,
  "derived_profile": {
    "orientation": "hybrid",
    "orientation_evidence": "Industry practice runs continuously from \"JH+P Dallas, Texas, August 2001 – June 2003\" through \"Studio Vail LLC Argyle, Texas, February 2009 – June 2020\", while teaching runs from the 2012 – 2013 AIA workshops to the current \"Program Coordinator/Faculty, Architecture Program\" role held since August 2015. Substantial, overlapping evidence on both the industry and teaching axes; the single co-authored white paper does not add a research axis.",
    "expertise_topics": [
      {
        "topic": "architectural design practice",
        "evidence": "Creation of architectural design work, renderings, graphics, 3D visualization and architectural animation for upscale residential, retail, civic, corporate, and educational projects",
        "currency": "recent",
        "evidence_years": [
          2009,
          2020
        ]
      },
      {
        "topic": "architecture curriculum development",
        "evidence": "Created the School’s Associate of Science Degree program in Architecture (and associated degree plan), by developing the curriculum, creating and teaching the component courses",
        "currency": "current",
        "evidence_years": [
          2015,
          2026
        ]
      },
      {
        "topic": "community college-to-university transfer pathways",
        "evidence": "assisting in the creation of a curriculum for a State-wide undergraduate Architecture articulation program between community colleges and member universities of the University of Texas System",
        "currency": "current",
        "evidence_years": [
          2015,
          2026
        ]
      },
      {
        "topic": "accessibility compliance (Texas Accessibility Standards)",
        "evidence": "the conducting of plan reviews and building inspections on behalf of the TDLR in compliance with the State's Elimination of Architectural Barriers Act (Texas Accessibility Standards 2012)",
        "currency": "recent",
        "evidence_years": [
          2009,
          2020
        ]
      },
      {
        "topic": "building information modeling (Revit)",
        "evidence": "Twice-yearly Continuing Education workshop for members of the AIA, focusing on the fundamentals of Revit Building Information Modeling",
        "currency": "historical",
        "evidence_years": [
          2012,
          2013
        ]
      },
      {
        "topic": "interior design education",
        "evidence": "Taught a variety of undergraduate Interior Design studios and courses",
        "currency": "historical",
        "evidence_years": [
          2013,
          2015
        ]
      },
      {
        "topic": "senior living facility design",
        "evidence": "All phases of architectural design work for the development of high-end senior living projects, including Independent- and Assisted-Living, Skilled Nursing, and Memory Support facilities",
        "currency": "historical",
        "evidence_years": [
          2006,
          2009
        ]
      },
      {
        "topic": "dual-credit architecture programs with high schools",
        "evidence": "Initiated and oversaw Dual-Credit Architecture programs with both the Garland Independent School District and the Richardson Independent School District",
        "currency": "current",
        "evidence_years": [
          2015,
          2026
        ]
      }
    ],
    "summary": "Douglas Richard Vail coordinates the Architecture Program at Dallas College, teaching there since 2015 and creator of the Associate of Science degree program in Architecture. Vail brings {{years_industry}} years of industry experience as an architectural intern/designer and later architect at Dallas firms (JH+P, Three Architecture, CSD) and as owner of Studio Vail LLC, overlapping {{years_teaching}} years of teaching for {{years_teaching_industry_overlap}} years, and holds a Master of Architecture from the University of Texas at Arlington (2001), Texas architectural registration, and TDLR Registered Accessibility Specialist status. Earlier teaching includes interior design at Texas Christian University and Tarrant County College. Current work centers on architecture curriculum development and community college-to-university transfer pathways, including THECB advisory committee and NAAB task force service.",
    "career_path": {
      "archetype": "architect who practiced at Dallas design firms, ran an independent practice, and moved into community college teaching to build an architecture program",
      "stages": [
        {
          "label": "architectural intern/designer at Dallas firms",
          "years": "2001-2006",
          "evidence": "JH+P Dallas, Texas, August 2001 – June 2003 Architectural Intern/Designer"
        },
        {
          "label": "architect, senior living projects",
          "years": "2006-2009",
          "evidence": "CSD Dallas, Texas, May 2006 - January 2009 Architect"
        },
        {
          "label": "firm owner, registered architect and accessibility specialist",
          "years": "2009-2020",
          "evidence": "Studio Vail LLC Argyle, Texas, February 2009 – June 2020 Owner/Registered Architect/Registered Accessibility Specialist/Urban Planning Specialist"
        },
        {
          "label": "adjunct and continuing-education teaching alongside practice",
          "years": "2012-2015",
          "evidence": "Lecturer, Interior Design, College of Fine Arts Texas Christian University, Fort Worth, Texas, August 2013 – August 2015"
        },
        {
          "label": "architecture program coordinator and faculty",
          "years": "2015-present",
          "evidence": "Program Coordinator/Faculty, Architecture Program Dallas College (Dallas County Community College District) Dallas, Texas, August 2015 – present"
        }
      ]
    }
  },
  "confidence": "high",
  "teaching_record": null
}
```

### Why this is correct
- Several entries print organization first, then location+dates, then role — the
  fields still land correctly; `raw_text` preserves the printed order.
- The four numbered registrations print under the "Education" heading but are
  certifications, not degrees — routed to `certifications` with the full printed
  line as `name`.
- The duplicate printed course code (IDME-40464 appears against two courses) is
  listed once — deduped, never "corrected".
- Summary title precision: JH+P and Three Architecture print "Architectural
  Intern/Designer", only CSD prints "Architect" — so the summary says
  "architectural intern/designer and later architect", never flattening early
  titles into the licensed one.
- `orientation: hybrid` on the industry + teaching axes: 2001-2020 practice and
  2012-present teaching overlap for years. One co-authored white paper does not
  add a research axis.
- At the 8-topic cap, prefer current student-relevant topics (dual-credit
  programs, transfer pathways) over older niche practice areas.


---

# Worked example — facts-cv-v2 exemplar: the empty-shell CV — honest nulls, no mined boilerplate
### Context given to the extractor
```json
{"professor": "Totan, Dan", "scrape_year": 2026}
```

### Correct output
```json
{
  "name": "Dan Totan",
  "department": null,
  "email": null,
  "cv_url": null,
  "courses_taught": [],
  "education": [],
  "experience": [],
  "certifications": [],
  "publications": null,
  "computed": null,
  "derived_profile": null,
  "confidence": "high",
  "teaching_record": null
}
```

### Why this is correct
- The page prints nothing about the person beyond the name: every extractive
  array is `[]`, `publications: null`, and `derived_profile: null` (the schema
  allows null ONLY when education, experience, publications, and certifications
  are all empty). Roughly 157 of the 2,415 CVs referenced by 2026SP look like this.
- "Cello" in the breadcrumb is a course TITLE in page chrome — never converted to
  a course code, never mined into a topic. "DUMMY" is an invisible template card.
- `confidence: "high"`, not low: emptiness is not uncertainty — identity matches
  the context and every null is certain. `low` is reserved for unparseable or
  contradictory documents.
- `computed: null` and `teaching_record: null` as always — the pipeline will still
  join this professor's real teaching history from schedule data at load time.


---

# Worked example — facts-cv-v2 exemplar: a thin CV whose Experience section is a course list
### Context given to the extractor
```json
{"professor": "Hurse, Laportia", "scrape_year": 2026}
```

### Correct output
```json
{
  "name": "Laportia Hurse",
  "department": null,
  "email": null,
  "cv_url": null,
  "courses_taught": [
    "ACCT 2301",
    "ACCT 2302",
    "ACNT 1311",
    "ACNT 1313",
    "ACNT 2309",
    "ACNT 1329",
    "ACNT 1303",
    "ACNT 1304",
    "ACNT 1380"
  ],
  "education": [
    {
      "institution": "University of North Texas",
      "location": "Denton, TX",
      "degree": "M.S.",
      "field": "Taxation",
      "year": null,
      "raw_text": "University of North Texas, Denton, TX M.S. Taxation"
    },
    {
      "institution": "University of North Texas",
      "location": "Denton, TX",
      "degree": "M.S.",
      "field": "Finance",
      "year": null,
      "raw_text": "University of North Texas, Denton, TX M.S. Finance"
    },
    {
      "institution": "Texas A&M University",
      "location": "College Station, TX",
      "degree": "B.B.A.",
      "field": "Accounting",
      "year": null,
      "raw_text": "Texas A&M University, College Station, TX B.B.A. Accounting"
    }
  ],
  "experience": [],
  "certifications": [],
  "publications": null,
  "computed": null,
  "derived_profile": {
    "orientation": "teaching_focused",
    "orientation_evidence": "The CV's experience section consists entirely of accounting course titles with printed course codes ('Financial Accounting - ACCT 2301' through 'Cooperative Education-Accounting - ACNT 1380'), and the page lists 'Laportia Hurse' under 'Instructors'. No employers, dated positions, research roles, or publications are printed.",
    "expertise_topics": [
      {
        "topic": "financial accounting",
        "evidence": "Financial Accounting - ACCT 2301",
        "currency": "historical",
        "evidence_years": [
          null,
          null
        ]
      },
      {
        "topic": "managerial accounting",
        "evidence": "Managerial Accounting - ACCT 2302",
        "currency": "historical",
        "evidence_years": [
          null,
          null
        ]
      },
      {
        "topic": "cost accounting",
        "evidence": "Cost Accounting – ACNT 2309",
        "currency": "historical",
        "evidence_years": [
          null,
          null
        ]
      },
      {
        "topic": "computerized accounting",
        "evidence": "Introduction to Computerized Accounting (QuickBooks Desktop & Online)- ACNT 1311",
        "currency": "historical",
        "evidence_years": [
          null,
          null
        ]
      },
      {
        "topic": "payroll and business tax accounting",
        "evidence": "Payroll and Business Tax Accounting- ACNT 1329",
        "currency": "historical",
        "evidence_years": [
          null,
          null
        ]
      },
      {
        "topic": "taxation",
        "evidence": "M.S. Taxation",
        "currency": "historical",
        "evidence_years": [
          null,
          null
        ]
      },
      {
        "topic": "finance",
        "evidence": "M.S. Finance",
        "currency": "historical",
        "evidence_years": [
          null,
          null
        ]
      }
    ],
    "summary": "Laportia Hurse holds an M.S. Taxation and an M.S. Finance from the University of North Texas and a B.B.A. Accounting from Texas A&M University. The CV's printed record is teaching-focused; the experience section lists nine accounting courses: Financial Accounting (ACCT 2301), Managerial Accounting (ACCT 2302), Introduction to Computerized Accounting with QuickBooks Desktop and Online (ACNT 1311), Computerized Accounting Applications (ACNT 1313), Cost Accounting (ACNT 2309), Payroll and Business Tax Accounting (ACNT 1329), Introduction to Accounting I and II (ACNT 1303, ACNT 1304), and Cooperative Education-Accounting (ACNT 1380).",
    "career_path": {
      "archetype": "accounting instructor with master's-level training in taxation and finance",
      "stages": [
        {
          "label": "degree study in accounting, taxation, and finance",
          "years": "not printed",
          "evidence": "Texas A&M University, College Station, TX B.B.A. Accounting"
        },
        {
          "label": "accounting course instruction",
          "years": "not printed",
          "evidence": "Financial Accounting - ACCT 2301"
        }
      ]
    }
  },
  "confidence": "high",
  "teaching_record": null
}
```

### Why this is correct
- The "Experience" heading holds course titles with codes, not positions: nothing
  prints an organization, role, or date, so `experience: []` and the nine codes go
  to `courses_taught` exactly as printed, in page order. Fabricating an entry like
  "Dallas College, Instructor" would invent an employer the CV never names.
- NO duration tokens in this summary: `{{years_*}}` tokens are legal only when
  dated experience entries exist for the pipeline to resolve — here none do. The
  "nine accounting courses" figure is a census of printed items, not a duration.
- `evidence_years: [null, null]` everywhere — the CV prints no years; nulls are
  the honest bounds. `currency` proposals fall to the rule's else-branch
  ("historical"); the pipeline may upgrade topics the professor actively teaches
  via the schedule join — the extractor never anticipates that.
- Degrees printed as "M.S." + field stay as printed — no abbreviation expansion.
- A short summary is correct for a thin CV; padding is a defect.
