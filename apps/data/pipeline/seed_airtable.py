"""One-time seeder: push verified Dallas College reference data INTO Airtable.

Airtable is the authoring surface (Issue #43/#44/#45); this script gives the
team a real starting point instead of an empty base. Idempotent: existing
records are matched by Name and never modified — staff edits in Airtable
always win; re-running only creates what's missing.

Every row below is PUBLIC information verified on dallascollege.edu on
2026-07-07 (locations page, schools navigation, paying-for-college pages,
emergency-aid page) or named-for-attribution in the Issue #47 discovery
interview. Emails are included only where published; blanks await #45
confirmation.

Needs AIRTABLE_TOKEN with data.records:read + data.records:write on the base.

CLI:
    python -m pipeline.seed_airtable            # dry run: report what would be created
    python -m pipeline.seed_airtable --apply    # create missing records
"""

from __future__ import annotations

import argparse
import os
from typing import Optional

from pipeline.load_directory import (
    API_BASE, F, T_ASSIGNMENTS, T_CATEGORIES, T_CONTACTS, T_GUIDANCE,
    T_TOPICS, T_UNITS, fetch_records,
)

T_CAMPUSES = "Campuses"

DC = "https://www.dallascollege.edu"

CAMPUSES = [  # the SEVEN campuses + Online (dallascollege.edu/locations)
    {"Code": "BHC", "Name": "Brookhaven", "City/Area": "Farmers Branch", "Campus Page URL": f"{DC}/locations/brookhaven/"},
    {"Code": "CVC", "Name": "Cedar Valley", "City/Area": "Lancaster", "Campus Page URL": f"{DC}/locations/cedar-valley/"},
    {"Code": "EFC", "Name": "Eastfield", "City/Area": "Mesquite", "Campus Page URL": f"{DC}/locations/eastfield/"},
    {"Code": "ECC", "Name": "El Centro", "City/Area": "Downtown Dallas", "Campus Page URL": f"{DC}/locations/el-centro/"},
    {"Code": "MVC", "Name": "Mountain View", "City/Area": "Oak Cliff, Dallas", "Campus Page URL": f"{DC}/locations/mountain-view/"},
    {"Code": "NLC", "Name": "North Lake", "City/Area": "Irving", "Campus Page URL": f"{DC}/locations/north-lake/"},
    {"Code": "RLC", "Name": "Richland", "City/Area": "North Dallas", "Campus Page URL": f"{DC}/locations/richland/"},
    {"Code": "Online", "Name": "Online", "City/Area": "", "Campus Page URL": DC},
]

# Exact seeded short names first (Postgres adopts by name), then the two
# schools our seeds lacked (official names), then the fallback.
UNITS = [
    "ETMS",
    "Business, Hospitality & Global Trade",
    "Creative Arts, Entertainment & Design",
    "Education",
    "Health Sciences",
    "School of Law and Public Service",
    "School of Manufacturing and Industrial Technology",
    "General / All",
]

CATEGORIES = [  # names must match db/seed_directory.sql exactly
    {"Name": "grants", "Routing Model": "per_school"},
    {"Name": "scholarships", "Routing Model": "centralized"},
    {"Name": "financial_aid", "Routing Model": "centralized"},
    {"Name": "emergency_funds", "Routing Model": "centralized"},
    {"Name": "student_care", "Routing Model": "centralized"},
    {"Name": "tech_support", "Routing Model": "centralized"},
]

TOPICS = ["rent", "utilities", "food", "mental health", "laptops",
          "transportation", "childcare", "books", "tuition_gap"]

CONTACTS = [
    {
        "Name": "Financial Aid Office",
        "Role/Title": "Office (college-wide)",
        "Helps With": "FAFSA, federal/state aid, loans, work-study — the standard aid "
                      "channel. Phone 972-669-6400, text 214-978-6457. Note: this office "
                      "does NOT administer school grants (Issue #47 finding).",
        "Active": True,
        "Source": f"{DC}/paying-for-college/financial-aid/ (verified 2026-07-07)",
    },
    {
        "Name": "Scholarships & Aid Office",
        "Role/Title": "Office (college-wide)",
        "Helps With": "Dallas College scholarships — one application covers many awards; "
                      "Premier Scholarships and Dallas College Promise.",
        "Active": True,
        "Source": f"{DC}/paying-for-college/scholarships-aid/ (verified 2026-07-07)",
    },
    {
        "Name": "Student Care / Connections",
        "Role/Title": "Office (college-wide)",
        "Email": "Connections@DallasCollege.edu",
        "Helps With": "Emergency aid up to $500/semester for documented emergencies "
                      "(vehicle repair, replacing essentials or temporary housing after "
                      "fire/flood/theft/disaster, family death or illness hardship). Care "
                      "coordinators route rent/utility/food/technology needs to community "
                      "resources and offer financial-literacy and budgeting help. "
                      "Phone 972-669-6400, text 214-978-6457.",
        "Active": True,
        "Source": f"{DC}/resources/emergency-aid/ (verified 2026-07-07)",
    },
    {
        "Name": "Tammy Clark",
        "Role/Title": "Associate Dean, Strategic Initiatives and Grants (ETMS grants POC)",
        "Helps With": "School-managed grant funds for ETMS programs — grants are separate "
                      "from financial aid and do not affect aid eligibility.",
        "Active": True,
        "Source": "Discovery interview 2026-06-26 (Issue #47); email pending #45 confirmation",
    },
]

ASSIGNMENTS = [
    {"contact": "Tammy Clark", "unit": "ETMS", "category": "grants",
     "criteria": "FAFSA on file (only needs to be ON FILE, not processed — students "
                 "ineligible for traditional aid can still receive grants); declared "
                 "program of study; additional program-specific criteria may apply — "
                 "the school's grant contact determines eligibility.",
     "topics": ["tuition_gap"]},
    {"contact": "Financial Aid Office", "unit": "General / All", "category": "financial_aid",
     "criteria": "Complete the FAFSA; the office determines aid eligibility.",
     "topics": ["tuition_gap"]},
    {"contact": "Scholarships & Aid Office", "unit": "General / All", "category": "scholarships",
     "criteria": "One scholarship application covers many awards; FAFSA recommended.",
     "topics": ["tuition_gap", "books"]},
    {"contact": "Student Care / Connections", "unit": "General / All", "category": "emergency_funds",
     "criteria": "Up to $500/semester for documented emergencies; must be currently "
                 "enrolled, 18+, with documentation, having exhausted other aid and "
                 "community options. Rent/utilities/food/technology are routed to "
                 "community resources by care coordinators rather than paid directly.",
     "topics": ["rent", "utilities", "food", "transportation"]},
    {"contact": "Student Care / Connections", "unit": "General / All", "category": "student_care",
     "criteria": "Care coordinators provide ongoing support: community-resource routing, "
                 "financial literacy, budgeting education, scholarship opportunities.",
     "topics": ["mental health", "laptops", "childcare"]},
]

GUIDANCE = [
    {"category": "grants",
     "Prep Steps": "FAFSA on file + declared program of study",
     "Awareness Message": "Dallas College has scholarships and grant funds available. "
                          "When you register, put a FAFSA on file, declare a program of "
                          "study, and tell your financial success coach."},
    {"category": "scholarships",
     "Prep Steps": "FAFSA on file; one application covers many awards — check deadlines each semester",
     "Awareness Message": "One scholarship application covers many Dallas College awards at once."},
    {"category": "emergency_funds",
     "Prep Steps": "Currently enrolled; 18+; documentation of the emergency; other aid and community options exhausted",
     "Awareness Message": "Emergency aid (up to $500/semester) exists for documented "
                          "emergencies, and care coordinators can route rent, utility or "
                          "food needs to community resources — ask early."},
]


def create_records(table: str, records: list[dict], token: str, base_id: str) -> list[str]:
    """POST records in batches of 10 (typecast lets single-selects accept text)."""
    import requests  # lazy

    ids: list[str] = []
    url = f"{API_BASE}/{base_id}/{requests.utils.quote(table)}"
    for i in range(0, len(records), 10):
        batch = records[i:i + 10]
        resp = requests.post(
            url, json={"records": [{"fields": r} for r in batch], "typecast": True},
            headers={"Authorization": f"Bearer {token}"}, timeout=60)
        resp.raise_for_status()
        ids.extend(rec["id"] for rec in resp.json()["records"])
    return ids


def seed(token: str, base_id: str, apply: bool) -> None:
    plan: list[str] = []

    def ensure(table: str, wanted: list[dict], key: str = "Name") -> dict[str, str]:
        """Return name -> record id for all wanted rows, creating the missing."""
        existing = {(r["fields"].get(key) or "").strip(): r["id"]
                    for r in fetch_records(table, token, base_id)}
        missing = [w for w in wanted if w[key].strip() not in existing]
        if missing:
            plan.append(f"{table}: create {len(missing)} "
                        f"({', '.join(m[key] for m in missing)})")
            if apply:
                new_ids = create_records(table, missing, token, base_id)
                existing.update({m[key].strip(): rid for m, rid in zip(missing, new_ids)})
        return existing

    campus_ids = ensure(T_CAMPUSES, CAMPUSES, key="Code") if _table_exists(
        T_CAMPUSES, token, base_id) else {}
    unit_ids = ensure(T_UNITS, [{"Name": u} for u in UNITS])
    category_ids = ensure(T_CATEGORIES, CATEGORIES)
    topic_ids = ensure(T_TOPICS, [{"Name": t} for t in TOPICS])
    contact_ids = ensure(T_CONTACTS, CONTACTS)

    # assignments: match by (contact, unit, category) against existing links
    existing_asg = set()
    for r in fetch_records(T_ASSIGNMENTS, token, base_id):
        f = r["fields"]
        existing_asg.add((tuple(f.get(F["asg_contact"]) or []),
                          tuple(f.get(F["asg_unit"]) or []),
                          tuple(f.get(F["asg_category"]) or [])))
    new_asg = []
    for a in ASSIGNMENTS:
        c, u, g = contact_ids.get(a["contact"]), unit_ids.get(a["unit"]), category_ids.get(a["category"])
        if not (c and u and g):
            plan.append(f"Assignments: SKIP {a['contact']} x {a['category']} (links unresolved in dry run)")
            continue
        if ((c,), (u,), (g,)) in existing_asg:
            continue
        new_asg.append({F["asg_contact"]: [c], F["asg_unit"]: [u], F["asg_category"]: [g],
                        F["asg_criteria"]: a["criteria"],
                        F["asg_topics"]: [topic_ids[t] for t in a["topics"] if t in topic_ids]})
    if new_asg:
        plan.append(f"Assignments: create {len(new_asg)}")
        if apply:
            create_records(T_ASSIGNMENTS, new_asg, token, base_id)

    existing_guid = {tuple(r["fields"].get(F["guid_category"]) or [])
                     for r in fetch_records(T_GUIDANCE, token, base_id)}
    new_guid = []
    for g in GUIDANCE:
        cat = category_ids.get(g["category"])
        if cat and (cat,) not in existing_guid:
            new_guid.append({F["guid_category"]: [cat],
                             F["guid_prep"]: g["Prep Steps"],
                             F["guid_awareness"]: g["Awareness Message"]})
    if new_guid:
        plan.append(f"Student Guidance: create {len(new_guid)}")
        if apply:
            create_records(T_GUIDANCE, new_guid, token, base_id)

    if not plan:
        print("Nothing to create — base already contains all reference rows.")
    else:
        header = "APPLIED:" if apply else "DRY RUN (re-run with --apply to create):"
        print(header)
        for line in plan:
            print(f"  - {line}")


def _table_exists(table: str, token: str, base_id: str) -> bool:
    try:
        fetch_records(table, token, base_id)
        return True
    except Exception:
        print(f"  note: table {table!r} not found in the base; skipping it")
        return False


def main(argv: Optional[list[str]] = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true",
                    help="create the missing records (default: dry run)")
    args = ap.parse_args(argv)

    from dotenv import load_dotenv
    load_dotenv()
    token = os.environ.get("AIRTABLE_TOKEN", "").strip()
    base_id = os.environ.get("AIRTABLE_BASE_ID", "").strip()
    if not token or not base_id:
        raise SystemExit("Set AIRTABLE_TOKEN and AIRTABLE_BASE_ID in .env "
                         "(token needs data.records:read + data.records:write).")
    seed(token, base_id, apply=args.apply)


if __name__ == "__main__":
    main()
