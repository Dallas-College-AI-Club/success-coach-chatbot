"""Loader — the only "T" code (SCHEMA_HANDOVER §5).

Projects validated extraction JSON (and structured schedule-CSV raw_payload)
into the thin relational core. Idempotent: natural-key upserts guarded with
IS DISTINCT FROM so a re-run changes nothing (including updated_at).

Rules enforced here (docs: SCHEMA_HANDOVER §5, GAP_ANALYSIS Q8, CLAUDE.md):
- Instructor identity comes from SCHEDULE rows only; syllabus-extracted
  instructor_name is never used to create or attach instructors.
- Schedule-CSV rows CREATE sections; syllabi ENRICH them (a syllabus creates a
  missing section skeleton but never overwrites schedule-owned fields and
  never sets instructor_id).
- Course-level fields (description/state_outcomes/requisites) are written only
  if currently empty or when the incoming syllabus modified_date is newer than
  every syllabus already loaded for that course.
- syllabi / grading_components / section_meetings are REPLACED per section.
- plan_requirements / requirement_courses are REPLACED per degree plan;
  course_requisites are REPLACED per course.
- Nothing here ever writes raw_documents.

CLI:
    python -m pipeline.load_extractions              # load everything current
    python -m pipeline.load_extractions --what schedule|syllabus|catalog
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, datetime
from typing import Any, Optional

SEASON_BY_CODE = {"SP": "spring", "SU": "summer", "FA": "fall", "WI": "winter"}
CODE_BY_SEASON = {v: k for k, v in SEASON_BY_CODE.items()}


# ---------------------------------------------------------------------------
# Small parsers
# ---------------------------------------------------------------------------

def term_from_code(term_code: str) -> dict:
    """'2026SU' -> {code, name, year, season}."""
    m = re.fullmatch(r"(\d{4})(SP|SU|FA|WI)", term_code.strip().upper())
    if not m:
        raise ValueError(f"unparseable term_code {term_code!r}")
    year, sc = int(m.group(1)), m.group(2)
    season = SEASON_BY_CODE[sc]
    return {"code": f"{year}{sc}", "name": f"{season.capitalize()} {year}",
            "year": year, "season": season}


def term_code_from_label(label: str) -> str:
    """'Summer 2022' -> '2022SU' (schedule-CSV term_year column)."""
    m = re.fullmatch(r"\s*(Spring|Summer|Fall|Winter)\s+(\d{4})\s*", label, re.I)
    if not m:
        raise ValueError(f"unparseable term label {label!r}")
    return f"{m.group(2)}{CODE_BY_SEASON[m.group(1).lower()]}"


def parse_date(value: Optional[str]) -> Optional[date]:
    """Accepts ISO 'YYYY-MM-DD', 'May 13, 2022', and Excel-resave '13-May-22'.

    A non-empty value matching NO format is loudly warned about instead of
    silently becoming NULL — silent date loss bit us once already (the schedule
    CSV was resaved in D-Mon-YY form and every section date loaded as NULL)."""
    if not value or not value.strip():
        return None
    for fmt in ("%Y-%m-%d", "%b %d, %Y", "%B %d, %Y",
                "%d-%b-%y", "%d-%B-%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    print(f"WARNING: unparseable date {value!r} -> NULL (add its format to parse_date)",
          file=sys.stderr)
    return None


def normalize_name(full_name: str) -> str:
    return " ".join(full_name.split()).lower()


_LINK_RE = re.compile(r"\(([^()]*?)\)")


def parse_materials_links(other_links: Optional[str]) -> list[str]:
    """CSV other_links: 'Textbook Info (url) | IncludEd Info (url)' -> [url, ...]."""
    if not other_links:
        return []
    return [u.strip() for u in _LINK_RE.findall(other_links) if u.strip().startswith("http")]


# ---------------------------------------------------------------------------
# Natural-key upserts (idempotent: no-op when nothing changed)
# ---------------------------------------------------------------------------

def upsert_term(cur, t: dict) -> int:
    cur.execute(
        """
        INSERT INTO terms (code, name, year, season, start_date, end_date)
        VALUES (%(code)s, %(name)s, %(year)s, %(season)s, %(start_date)s, %(end_date)s)
        ON CONFLICT (code) DO UPDATE SET
            start_date = COALESCE(terms.start_date, EXCLUDED.start_date),
            end_date   = COALESCE(terms.end_date,   EXCLUDED.end_date),
            updated_at = now()
        WHERE (terms.start_date IS NULL AND EXCLUDED.start_date IS NOT NULL)
           OR (terms.end_date   IS NULL AND EXCLUDED.end_date   IS NOT NULL)
        """,
        {**t, "start_date": t.get("start_date"), "end_date": t.get("end_date")},
    )
    cur.execute("SELECT id FROM terms WHERE code = %s", (t["code"],))
    return cur.fetchone()[0]


def upsert_course(cur, prefix: str, number: str, title: Optional[str] = None,
                  credit_hours: Optional[float] = None) -> int:
    """Create/find a course by natural key; fill title/credits only when empty."""
    cur.execute(
        """
        INSERT INTO courses (subject_prefix, course_number, title, credit_hours)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (subject_prefix, course_number) DO UPDATE SET
            title        = CASE WHEN courses.title = '' OR courses.title = courses.subject_prefix || '-' || courses.course_number
                                THEN COALESCE(EXCLUDED.title, courses.title) ELSE courses.title END,
            credit_hours = COALESCE(courses.credit_hours, EXCLUDED.credit_hours),
            updated_at   = now()
        WHERE (courses.credit_hours IS NULL AND EXCLUDED.credit_hours IS NOT NULL)
           OR ((courses.title = '' OR courses.title = courses.subject_prefix || '-' || courses.course_number)
               AND EXCLUDED.title IS DISTINCT FROM courses.title AND EXCLUDED.title IS NOT NULL)
        """,
        (prefix, number, title or f"{prefix}-{number}", credit_hours),
    )
    cur.execute(
        "SELECT id FROM courses WHERE subject_prefix = %s AND course_number = %s",
        (prefix, number),
    )
    return cur.fetchone()[0]


def update_course_baseline(cur, course_id: int, fields: dict,
                           modified_date: Optional[date]) -> None:
    """Write description/state_outcomes/requisites only if empty or newer
    (SCHEMA_HANDOVER §5). 'Newer' = this syllabus's modified_date beats the max
    modified_date already loaded for the course."""
    cur.execute(
        """
        SELECT MAX(sy.modified_date)
        FROM syllabi sy JOIN sections s ON s.id = sy.section_id
        WHERE s.course_id = %s
        """,
        (course_id,),
    )
    newest_loaded = cur.fetchone()[0]
    # strictly newer: an EQUAL modified_date must not overwrite another
    # syllabus's non-empty values (only-if-empty still applies below)
    newer = modified_date is not None and (newest_loaded is None or modified_date > newest_loaded)

    for col in ("description", "state_outcomes", "requisites"):
        val = fields.get(col)
        if val is None:
            continue
        if newer:
            cur.execute(
                f"""UPDATE courses SET {col} = %s, updated_at = now()
                    WHERE id = %s AND {col} IS DISTINCT FROM %s""",
                (val, course_id, val),
            )
        else:
            cur.execute(
                f"""UPDATE courses SET {col} = %s, updated_at = now()
                    WHERE id = %s AND ({col} IS NULL OR {col} = '')""",
                (val, course_id),
            )


def upsert_instructor(cur, full_name: str) -> int:
    """SCHEDULE-row names only (GAP_ANALYSIS Q8). Dedup on normalized_name."""
    norm = normalize_name(full_name)
    cur.execute(
        """
        INSERT INTO instructors (full_name, normalized_name)
        VALUES (%s, %s)
        ON CONFLICT (normalized_name) DO NOTHING
        """,
        (full_name, norm),
    )
    cur.execute("SELECT id FROM instructors WHERE normalized_name = %s", (norm,))
    return cur.fetchone()[0]


def upsert_section_from_schedule(cur, course_id: int, term_id: int, row: dict,
                                 instructor_id: Optional[int],
                                 raw_document_id: Optional[int]) -> int:
    """Schedule rows OWN the section: authoritative for instructor, modality,
    campus, dates, meeting_info_raw, syllabus_url, coreq ref."""
    cur.execute(
        """
        INSERT INTO sections (course_id, term_id, instructor_id, section_number,
                              modality, campus, meeting_info_raw, start_date,
                              end_date, syllabus_url, coreq_section_ref,
                              raw_document_id)
        VALUES (%(course_id)s, %(term_id)s, %(instructor_id)s, %(section_number)s,
                %(modality)s, %(campus)s, %(meeting_info_raw)s, %(start_date)s,
                %(end_date)s, %(syllabus_url)s, %(coreq_section_ref)s,
                %(raw_document_id)s)
        ON CONFLICT (course_id, term_id, section_number) DO UPDATE SET
            instructor_id     = EXCLUDED.instructor_id,
            modality          = EXCLUDED.modality,
            campus            = EXCLUDED.campus,
            meeting_info_raw  = EXCLUDED.meeting_info_raw,
            start_date        = EXCLUDED.start_date,
            end_date          = EXCLUDED.end_date,
            syllabus_url      = EXCLUDED.syllabus_url,
            coreq_section_ref = EXCLUDED.coreq_section_ref,
            raw_document_id   = EXCLUDED.raw_document_id,
            updated_at        = now()
        WHERE (sections.instructor_id, sections.modality, sections.campus,
               sections.meeting_info_raw, sections.start_date, sections.end_date,
               sections.syllabus_url, sections.coreq_section_ref,
               sections.raw_document_id)
              IS DISTINCT FROM
              (EXCLUDED.instructor_id, EXCLUDED.modality, EXCLUDED.campus,
               EXCLUDED.meeting_info_raw, EXCLUDED.start_date, EXCLUDED.end_date,
               EXCLUDED.syllabus_url, EXCLUDED.coreq_section_ref,
               EXCLUDED.raw_document_id)
        """,
        {"course_id": course_id, "term_id": term_id, "instructor_id": instructor_id,
         **row, "raw_document_id": raw_document_id},
    )
    cur.execute(
        """SELECT id FROM sections
           WHERE course_id = %s AND term_id = %s AND section_number = %s""",
        (course_id, term_id, row["section_number"]),
    )
    return cur.fetchone()[0]


def find_or_skeleton_section(cur, course_id: int, term_id: int,
                             section_number: str, sec: dict) -> int:
    """Syllabus path: find the schedule-created section; if the schedule wasn't
    loaded, create a minimal skeleton (fill only syllabus-known fields; NEVER
    instructor_id — schedule rows own identity). Existing sections are not
    modified here."""
    cur.execute(
        """SELECT id FROM sections
           WHERE course_id = %s AND term_id = %s AND section_number = %s""",
        (course_id, term_id, section_number),
    )
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        """
        INSERT INTO sections (course_id, term_id, section_number, modality,
                              campus, start_date, end_date)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (course_id, term_id, section_number, sec.get("modality"),
         sec.get("campus"), parse_date(sec.get("start_date")),
         parse_date(sec.get("end_date"))),
    )
    return cur.fetchone()[0]


def replace_syllabus(cur, section_id: int, extraction_id: int, data: dict) -> int:
    """REPLACE syllabi + grading_components + section_meetings for a section."""
    sec = data.get("section") or {}
    cur.execute(
        """
        INSERT INTO syllabi (section_id, extraction_id, modified_date,
                             withdraw_date, certification_date,
                             instructor_outcomes, course_schedule, policies,
                             distinctive_features, full_summary)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (section_id) DO UPDATE SET
            extraction_id        = EXCLUDED.extraction_id,
            modified_date        = EXCLUDED.modified_date,
            withdraw_date        = EXCLUDED.withdraw_date,
            certification_date   = EXCLUDED.certification_date,
            instructor_outcomes  = EXCLUDED.instructor_outcomes,
            course_schedule      = EXCLUDED.course_schedule,
            policies             = EXCLUDED.policies,
            distinctive_features = EXCLUDED.distinctive_features,
            full_summary         = EXCLUDED.full_summary,
            updated_at           = now()
        WHERE (syllabi.extraction_id, syllabi.modified_date, syllabi.full_summary)
              IS DISTINCT FROM
              (EXCLUDED.extraction_id, EXCLUDED.modified_date, EXCLUDED.full_summary)
        """,
        (section_id, extraction_id, parse_date(sec.get("modified_date")),
         parse_date(sec.get("withdraw_date")), parse_date(sec.get("certification_date")),
         json.dumps(data.get("instructor_outcomes") or []),
         json.dumps(data.get("course_schedule") or []),
         json.dumps(data.get("policies") or {}),
         json.dumps(data.get("distinctive_features") or []),
         data.get("full_summary")),
    )
    cur.execute("SELECT id FROM syllabi WHERE section_id = %s", (section_id,))
    syllabus_id = cur.fetchone()[0]

    cur.execute("DELETE FROM grading_components WHERE syllabus_id = %s", (syllabus_id,))
    for g in data.get("grading") or []:
        cur.execute(
            """INSERT INTO grading_components
                   (syllabus_id, raw_label, canonical_type, weight_pct, points, notes)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (syllabus_id, g["raw_label"], g["canonical_type"],
             g.get("weight_pct"), g.get("points"), g.get("notes")),
        )

    cur.execute("DELETE FROM section_meetings WHERE section_id = %s", (section_id,))
    for m in data.get("meetings") or []:
        cur.execute(
            """INSERT INTO section_meetings
                   (section_id, meeting_type, days, start_time, end_time,
                    campus, building, room)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (section_id, m["meeting_type"], m.get("days"), m.get("start_time"),
             m.get("end_time"), m.get("campus"), m.get("building"), m.get("room")),
        )

    # materials links from the syllabus (v1.1); replaced per section
    links = data.get("materials_links") or []
    if links:
        cur.execute("DELETE FROM section_materials WHERE section_id = %s", (section_id,))
        for link in links:
            cur.execute(
                """INSERT INTO section_materials (section_id, component, bookstore_url)
                   VALUES (%s, %s, %s)""",
                (section_id, link.get("component"), link["url"]),
            )
    return syllabus_id


# ---------------------------------------------------------------------------
# Three load paths: schedule CSV rows, syllabus extractions, catalog extractions
# ---------------------------------------------------------------------------

def load_schedule_rows(conn) -> int:
    """raw_documents(source_type='schedule_csv', is_latest) -> terms/courses/
    instructors/sections/section_materials. raw_payload = one CSV row."""
    n = 0
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, raw_payload FROM raw_documents
               WHERE source_type = 'schedule_csv' AND is_latest
               ORDER BY id"""
        )
        rows = cur.fetchall()
    for raw_id, payload in rows:
        row = payload if isinstance(payload, dict) else json.loads(payload)
        with conn.cursor() as cur:
            term_id = upsert_term(cur, {
                **term_from_code(term_code_from_label(row["term_year"])),
                "start_date": None, "end_date": None,   # term window ≠ section window (flex terms)
            })
            course_id = upsert_course(
                cur, row["class_prefix"].strip(), row["class_number"].strip(),
                title=(row.get("class_name") or "").strip() or None,
                credit_hours=float(row["credit_hours"]) if row.get("credit_hours") else None,
            )
            instructor_id = None
            if (row.get("professor") or "").strip():
                instructor_id = upsert_instructor(cur, row["professor"].strip())

            location = (row.get("location") or "").strip()
            features = row.get("class_features") or ""
            modality = "online" if (location.lower() == "online"
                                    or "internet based" in features.lower()) else "in_person"
            coreq = (row.get("corequisites") or "").strip()
            section_id = upsert_section_from_schedule(
                cur, course_id, term_id,
                {
                    "section_number": row["section_number"].strip(),
                    "modality": modality,
                    "campus": location or None,
                    "meeting_info_raw": (row.get("meeting_info") or "").strip() or None,
                    "start_date": parse_date(row.get("start_date")),
                    "end_date": parse_date(row.get("end_date")),
                    "syllabus_url": (row.get("syllabus_url") or "").strip() or None,
                    "coreq_section_ref": coreq if coreq and coreq.lower() != "none" else None,
                },
                instructor_id, raw_id,
            )
            # bookstore/IncludEd links (component unknown from CSV -> NULL)
            urls = parse_materials_links(row.get("other_links"))
            if urls:
                cur.execute("DELETE FROM section_materials WHERE section_id = %s",
                            (section_id,))
                for url in urls:
                    cur.execute(
                        """INSERT INTO section_materials (section_id, bookstore_url)
                           VALUES (%s, %s)""",
                        (section_id, url),
                    )
        n += 1
    conn.commit()
    return n


def load_syllabus_extractions(conn) -> int:
    """extractions(is_current, status='ok') over syllabus raw docs -> core."""
    n = 0
    with conn.cursor() as cur:
        cur.execute(
            """SELECT e.id, e.data
               FROM extractions e
               JOIN raw_documents rd ON rd.id = e.raw_document_id
               WHERE e.is_current AND e.status = 'ok'
                 AND rd.is_latest
                 AND rd.source_type IN ('syllabus_html', 'syllabus_pdf')
               ORDER BY e.id"""
        )
        rows = cur.fetchall()
    for extraction_id, data in rows:
        data = data if isinstance(data, dict) else json.loads(data)
        course = data.get("course") or {}
        sec = data.get("section") or {}
        if not (course.get("subject_prefix") and course.get("course_number")
                and sec.get("term_code") and sec.get("section_number")):
            continue  # not enough identity to place it; stays available in extractions
        with conn.cursor() as cur:
            term_id = upsert_term(cur, {
                **term_from_code(sec["term_code"]),
                "start_date": None, "end_date": None,
            })
            course_id = upsert_course(
                cur, course["subject_prefix"].strip(), course["course_number"].strip(),
                title=course.get("title"), credit_hours=course.get("credit_hours"),
            )
            update_course_baseline(
                cur, course_id,
                {"description": course.get("description"),
                 "state_outcomes": course.get("state_outcomes"),
                 "requisites": course.get("requisites")},
                parse_date(sec.get("modified_date")),
            )
            # NOTE: sec['instructor_name'] is deliberately unused (cross-check only)
            section_id = find_or_skeleton_section(
                cur, course_id, term_id, sec["section_number"].strip(), sec)
            replace_syllabus(cur, section_id, extraction_id, data)
        n += 1
    conn.commit()
    return n


def load_degree_plan_extractions(conn) -> int:
    """extractions(is_current, status='ok') over catalog pages -> Module 6."""
    n = 0
    with conn.cursor() as cur:
        cur.execute(
            """SELECT e.id, e.data, e.raw_document_id
               FROM extractions e
               JOIN raw_documents rd ON rd.id = e.raw_document_id
               WHERE e.is_current AND e.status = 'ok'
                 AND rd.is_latest
                 AND rd.source_type = 'catalog_page'
               ORDER BY e.id"""
        )
        rows = cur.fetchall()
    for extraction_id, data, raw_document_id in rows:
        data = data if isinstance(data, dict) else json.loads(data)
        edition = data["edition"]
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO catalog_editions (catoid, year_label, raw_document_id)
                VALUES (%s, %s, %s)
                ON CONFLICT (catoid) DO UPDATE SET
                    year_label = EXCLUDED.year_label,
                    updated_at = now()
                WHERE catalog_editions.year_label IS DISTINCT FROM EXCLUDED.year_label
                """,
                (edition["catoid"], edition["year_label"], raw_document_id),
            )
            cur.execute("SELECT id FROM catalog_editions WHERE catoid = %s",
                        (edition["catoid"],))
            edition_id = cur.fetchone()[0]

            # NULL-poid-safe upsert: ON CONFLICT (edition, poid) never fires
            # for NULL poid (unique indexes treat NULLs as distinct), which
            # would duplicate the plan on every load — so SELECT-then-write
            # keyed with IS NOT DISTINCT FROM. Extraction confidence rules
            # allow poid to be null when the page URL wasn't captured.
            cur.execute(
                """SELECT id, name, award_type FROM degree_plans
                   WHERE catalog_edition_id = %s AND poid IS NOT DISTINCT FROM %s""",
                (edition_id, data.get("poid")),
            )
            row = cur.fetchone()
            if row:
                plan_id = row[0]
                if (row[1], row[2]) != (data["name"], data.get("award_type")):
                    cur.execute(
                        """UPDATE degree_plans
                           SET name = %s, award_type = %s, updated_at = now()
                           WHERE id = %s""",
                        (data["name"], data.get("award_type"), plan_id),
                    )
            else:
                cur.execute(
                    """INSERT INTO degree_plans (catalog_edition_id, poid, name,
                                                 award_type, raw_document_id)
                       VALUES (%s, %s, %s, %s, %s) RETURNING id""",
                    (edition_id, data.get("poid"), data["name"],
                     data.get("award_type"), raw_document_id),
                )
                plan_id = cur.fetchone()[0]

            # REPLACE requirements (+ their course links) for this plan
            cur.execute(
                """DELETE FROM requirement_courses
                   WHERE requirement_id IN
                         (SELECT id FROM plan_requirements WHERE degree_plan_id = %s)""",
                (plan_id,),
            )
            cur.execute("DELETE FROM plan_requirements WHERE degree_plan_id = %s",
                        (plan_id,))
            for req in data.get("requirements") or []:
                cur.execute(
                    """INSERT INTO plan_requirements
                           (degree_plan_id, group_name, component_area_code,
                            credits_required, rule)
                       VALUES (%s, %s, %s, %s, %s) RETURNING id""",
                    (plan_id, req["group_name"], req.get("component_area_code"),
                     req.get("credits_required"), req.get("rule")),
                )
                req_id = cur.fetchone()[0]
                for c in req.get("courses") or []:
                    course_id = upsert_course(
                        cur, c["subject_prefix"].strip(), c["course_number"].strip(),
                        title=c.get("title"))
                    cur.execute(
                        """INSERT INTO requirement_courses (requirement_id, course_id)
                           VALUES (%s, %s) ON CONFLICT DO NOTHING""",
                        (req_id, course_id),
                    )

            # REPLACE typed requisite edges per course mentioned
            by_course: dict[tuple[str, str], list] = {}
            for r in data.get("requisites") or []:
                key = (r["course"]["subject_prefix"].strip(),
                       r["course"]["course_number"].strip())
                by_course.setdefault(key, []).append(r)
            for (prefix, number), reqs in by_course.items():
                course_id = upsert_course(cur, prefix, number)
                cur.execute("DELETE FROM course_requisites WHERE course_id = %s",
                            (course_id,))
                for r in reqs:
                    requisite_course_id = None
                    if r.get("requisite_course"):
                        rc = r["requisite_course"]
                        requisite_course_id = upsert_course(
                            cur, rc["subject_prefix"].strip(),
                            rc["course_number"].strip())
                    cur.execute(
                        """INSERT INTO course_requisites
                               (course_id, kind, requisite_course_id, raw_text)
                           VALUES (%s, %s, %s, %s)""",
                        (course_id, r["kind"], requisite_course_id, r["raw_text"]),
                    )
        n += 1
    conn.commit()
    return n


def main(argv: Optional[list[str]] = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--what", choices=["all", "schedule", "syllabus", "catalog"],
                    default="all")
    args = ap.parse_args(argv)

    from db.client import get_connection  # the one-file adapter (ADR-008)

    with get_connection() as conn:
        if args.what in ("all", "schedule"):
            print(f"schedule rows loaded: {load_schedule_rows(conn)}")
        if args.what in ("all", "syllabus"):
            print(f"syllabus extractions loaded: {load_syllabus_extractions(conn)}")
        if args.what in ("all", "catalog"):
            print(f"degree-plan extractions loaded: {load_degree_plan_extractions(conn)}")


if __name__ == "__main__":
    main()
