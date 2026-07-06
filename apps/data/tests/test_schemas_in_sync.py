"""Guard: the published JSON Schemas and the Pydantic mirrors stay aligned.

The .schema.json files are the versioned contract (ADR-002); pipeline/models.py
is the enforcement the retry loop uses. If either drifts, extraction quality
silently degrades — so CI pins them together.
"""

import json
from pathlib import Path

from jsonschema import Draft202012Validator

from pipeline.models import (
    DEGREE_PLAN_SCHEMA_VERSION,
    SYLLABUS_SCHEMA_VERSION,
    CanonicalType,
    RequisiteKind,
)
from typing import get_args

SCHEMAS = Path(__file__).resolve().parent.parent / "schemas"


def _load(name: str) -> dict:
    with open(SCHEMAS / name, encoding="utf-8") as fh:
        return json.load(fh)


def test_schemas_are_meta_valid():
    for name in ("syllabus_extraction.schema.json", "degree_plan_extraction.schema.json"):
        Draft202012Validator.check_schema(_load(name))


def test_versions_match_models():
    assert _load("syllabus_extraction.schema.json")["schema_version"] == SYLLABUS_SCHEMA_VERSION
    assert _load("degree_plan_extraction.schema.json")["schema_version"] == DEGREE_PLAN_SCHEMA_VERSION


def test_canonical_type_enum_matches():
    schema = _load("syllabus_extraction.schema.json")
    json_enum = schema["properties"]["grading"]["items"]["properties"]["canonical_type"]["enum"]
    assert set(json_enum) == set(get_args(CanonicalType))


def test_requisite_kind_enum_matches():
    schema = _load("degree_plan_extraction.schema.json")
    json_enum = schema["properties"]["requisites"]["items"]["properties"]["kind"]["enum"]
    assert set(json_enum) == set(get_args(RequisiteKind))


def test_db_check_constraints_match_enums(q=None):
    """The CHECK constraint lists in db/schema.sql must equal the JSON enums
    (the taxonomy is enforced twice — ADR-003). Parsed textually so this test
    needs no database."""
    ddl = (Path(__file__).resolve().parent.parent / "db" / "schema.sql").read_text(encoding="utf-8")
    for value in get_args(CanonicalType):
        assert f"'{value}'" in ddl, f"canonical_type {value!r} missing from schema.sql CHECK"
    for value in get_args(RequisiteKind):
        assert f"'{value}'" in ddl, f"kind {value!r} missing from schema.sql CHECK"
