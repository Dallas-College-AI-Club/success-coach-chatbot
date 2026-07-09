"""Pydantic mirrors of the canonical extraction JSON Schemas.

The published contract is schemas/*.schema.json (versioned; bump, never edit in
place). These models exist so the extract step can validate with Pydantic and
feed precise validator errors back to the model on retry (SCHEMA_HANDOVER §3).
tests/test_schemas_in_sync.py asserts the two stay aligned on versions/enums.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

SYLLABUS_SCHEMA_VERSION = "1.2"
DEGREE_PLAN_SCHEMA_VERSION = "1.0"

DATE_RE = r"^\d{4}-\d{2}-\d{2}$"
TIME_RE = r"^([01][0-9]|2[0-3]):[0-5][0-9]$"
DAYS_RE = r"^[MTWRFSU]*$"

CanonicalType = Literal[
    "exam", "quiz", "homework", "project", "lab", "participation",
    "paper", "presentation", "final_exam", "other",
]
Modality = Literal["online", "in_person", "hybrid"]
MeetingType = Literal["lecture", "lab", "other"]
Confidence = Literal["high", "medium", "low"]
RequisiteKind = Literal["prerequisite", "corequisite", "tsi", "other"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --------------------------------------------------------------------------
# Syllabus extraction (v1.2)
# --------------------------------------------------------------------------

class CourseFields(_Strict):
    subject_prefix: Optional[str] = None
    course_number: Optional[str] = None
    title: Optional[str] = None
    credit_hours: Optional[float] = None
    description: Optional[str] = None
    state_outcomes: Optional[str] = None
    requisites: Optional[str] = None


class SectionFields(_Strict):
    term_code: Optional[str] = None
    section_number: Optional[str] = None
    # Cross-check ONLY — identity comes from schedule rows (GAP_ANALYSIS Q8)
    instructor_name: Optional[str] = None
    modality: Optional[Modality] = None
    campus: Optional[str] = None
    start_date: Optional[str] = Field(default=None, pattern=DATE_RE)
    end_date: Optional[str] = Field(default=None, pattern=DATE_RE)
    modified_date: Optional[str] = Field(default=None, pattern=DATE_RE)
    withdraw_date: Optional[str] = Field(default=None, pattern=DATE_RE)
    certification_date: Optional[str] = Field(default=None, pattern=DATE_RE)


class GradingComponent(_Strict):
    raw_label: str
    canonical_type: CanonicalType
    weight_pct: Optional[float] = None
    points: Optional[float] = None
    notes: Optional[str] = None


class Meeting(_Strict):
    meeting_type: MeetingType
    days: Optional[str] = Field(default=None, pattern=DAYS_RE)
    start_time: Optional[str] = Field(default=None, pattern=TIME_RE)
    end_time: Optional[str] = Field(default=None, pattern=TIME_RE)
    campus: Optional[str] = None
    building: Optional[str] = None
    room: Optional[str] = None


class MaterialsLink(_Strict):
    component: Optional[Literal["lecture", "lab"]] = None
    url: str


class ScheduleItem(_Strict):
    when: Optional[str] = None
    topic: Optional[str] = None
    notes: Optional[str] = None


class Policies(_Strict):
    late_work: Optional[str] = None
    attendance: Optional[str] = None
    makeup: Optional[str] = None
    ai_plagiarism: Optional[str] = None
    extra_credit: Optional[str] = None


class SyllabusExtraction(_Strict):
    course: CourseFields
    section: SectionFields
    grading: list[GradingComponent]
    meetings: list[Meeting] = []          # online sections: empty, never invented
    materials_links: list[MaterialsLink] = []
    instructor_outcomes: list[str] = []
    course_schedule: list[ScheduleItem] = []
    policies: Optional[Policies] = None
    distinctive_features: list[str] = []
    full_summary: Optional[str] = None
    confidence: Confidence


# --------------------------------------------------------------------------
# Degree-plan extraction (v1.0)
# --------------------------------------------------------------------------

class Edition(_Strict):
    catoid: int
    year_label: str


class PlanCourse(_Strict):
    subject_prefix: str
    course_number: str
    title: Optional[str] = None


class PlanRequirement(_Strict):
    group_name: str
    component_area_code: Optional[str] = None
    credits_required: Optional[float] = None
    rule: Optional[str] = None
    courses: list[PlanCourse]


class CourseRef(_Strict):
    subject_prefix: str
    course_number: str


class PlanRequisite(_Strict):
    course: CourseRef
    kind: RequisiteKind
    requisite_course: Optional[CourseRef] = None  # null when non-course (TSI)
    raw_text: str                                 # verbatim — always kept


class DegreePlanExtraction(_Strict):
    edition: Edition
    poid: Optional[int] = None
    name: str
    award_type: Optional[str] = None
    requirements: list[PlanRequirement]
    requisites: list[PlanRequisite] = []
    confidence: Confidence


DOC_MODELS = {
    "syllabus": (SyllabusExtraction, SYLLABUS_SCHEMA_VERSION, "syllabus_extraction.schema.json"),
    "degree_plan": (DegreePlanExtraction, DEGREE_PLAN_SCHEMA_VERSION, "degree_plan_extraction.schema.json"),
}
