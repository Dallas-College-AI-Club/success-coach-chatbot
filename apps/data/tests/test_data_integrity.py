"""Failure cases that previously let bad or unverified deliveries pass."""

import hashlib
import importlib
import json
from collections import Counter
from pathlib import Path

import pytest
from dallasai import database
from dallasai import load_catalog_to_neon as loader
from dallasai.pipeline.audit_corpus import catalog_course, catalog_option, reconcile
from dallasai.pipeline.build_section_meetings import facts_from_csv, parse_meetings
from dallasai.pipeline.embed_rows import CONTRACT, DIMS, EMBED_MODEL, validate_embedding
from dallasai.pipeline.extract_batch import extraction_fingerprint
from dallasai.pipeline.golden_gate import main as golden_gate
from dallasai.pipeline.verify_catalog import check_course
from dallasai.pipeline.verify_catalog import main as verify_catalog


def valid_row():
    text = "ABDR 1307 - Collision Repair Welding (3 Credit Hours)"
    return {
        "source_url": "https://catalog.dallascollege.edu/preview_course_nopop.php?coid=15113",
        "chunk_index": 0,
        "chunk_text": text,
        "content_hash": "a" * 64,
        "scraped_at": "2026-07-12T00:00:00+00:00",
        "facts": {
            "course_code": "ABDR 1307",
            "title": "Collision Repair Welding",
            "credit_hours": 3,
            "prerequisites": [],
            "corequisites": [],
            "confidence": "high",
        },
        "metadata": {
            "doc_type": "course",
            "course_code": "ABDR 1307",
            "catalog_year": "2026-2027",
            "embedding_model": EMBED_MODEL,
            "embedding_dimensions": DIMS,
            "embedding_dtype": CONTRACT["dtype"],
            "embedding_text_sha256": hashlib.sha256(text.encode()).hexdigest(),
        },
        "embedding": [1.0] + [0.0] * (DIMS - 1),
    }


@pytest.mark.parametrize(
    "mutation",
    [
        lambda r: r.update(embedding=[0.0] * DIMS),
        lambda r: r["embedding"].__setitem__(0, float("nan")),
        lambda r: r["embedding"].__setitem__(0, float("inf")),
        lambda r: r["embedding"].__setitem__(1, True),
        lambda r: r.update(embedding=[1.0] * 768),
        lambda r: r["metadata"].update(embedding_model="openai/text-embedding-3-small"),
        lambda r: r.update(chunk_text="Changed text with an old vector"),
        lambda r: r.update(metadata=["invalid"]),
        lambda r: r.update(chunk_text=None),
    ],
)
def test_rejects_invalid_or_unproven_vectors(mutation):
    row = valid_row()
    mutation(row)
    with pytest.raises(ValueError):
        validate_embedding(row)


@pytest.mark.parametrize(
    "mutation",
    [
        lambda r: r.update(source_url="javascript:alert(1)"),
        lambda r: r.update(chunk_index=-1),
        lambda r: r.update(chunk_index=True),
        lambda r: r.update(content_hash="not-a-hash"),
        lambda r: r["facts"].update(credit_hours=-3),
    ],
)
def test_rejects_bad_identity_and_numbers(mutation):
    row = valid_row()
    mutation(row)
    with pytest.raises(ValueError):
        loader.validate_identity(row, 0)


def test_full_loader_checks_contract_and_expected_counts(tmp_path):
    path = tmp_path / "rows.json"
    row = valid_row()
    path.write_text(json.dumps([row]))
    assert len(loader.load_rows(path, expected_counts={"course": 1})) == 1
    row["facts"]["course_code"] = "MATH XXXX"
    path.write_text(json.dumps([row]))
    with pytest.raises(ValueError, match="placeholders"):
        loader.load_rows(path, expected_counts={"course": 1})
    with pytest.raises(ValueError):
        loader.validate_dataset_counts(0, Counter())
    with pytest.raises(ValueError, match="differ"):
        loader.validate_dataset_counts(
            2, Counter(course=2), expected_counts={"course": 3}
        )


def test_empty_verification_never_passes(tmp_path):
    with pytest.raises(SystemExit, match="No golden fixtures"):
        golden_gate(["--raw-root", str(tmp_path), "--gate-dir", str(tmp_path)])
    with pytest.raises(SystemExit) as result:
        verify_catalog(["--raw-root", str(tmp_path), "--facts", str(tmp_path)])
    assert result.value.code == 1


def test_changed_title_fails_source_verification():
    facts = valid_row()["facts"]
    source = "ABDR 1307 - Completely Different Title (3 Credit Hours)"
    assert any("title" in message for message in check_course(facts, source, source))


def test_fingerprint_changes_with_source_and_identity(tmp_path):
    source = tmp_path / "source.html"
    source.write_text("course version one")
    original = extraction_fingerprint(source, "course", {"catalog_year": "2026-2027"})
    assert original != extraction_fingerprint(
        source, "course", {"catalog_year": "2025-2026"}
    )
    source.write_text("course version two")
    assert original != extraction_fingerprint(
        source, "course", {"catalog_year": "2026-2027"}
    )


def test_safe_schema_matches_committed_baseline():
    sql = database.schema_sql()
    assert "DROP" not in sql and "halfvec(384)" in sql.lower() and "pg_trgm" in sql
    assert "USING hnsw" not in sql
    assert sql == (Path(__file__).parents[1] / "reference/db/schema.sql").read_text(
        encoding="utf-8"
    )


def test_legacy_parser_import_has_no_machine_specific_writes():
    importlib.import_module("dallasai.pipeline.course_extractor")


def test_option_and_course_pages_stay_distinct():
    html = (
        '<td class="block_content"><h1 id="course_preview_title">'
        "MATH XXXX - Mathematics Options (3-4 Credit Hours)</h1>"
        "MATH 1314 or MATH 1342</td>"
    )
    assert catalog_option(html)["course_options"] == ["MATH 1314", "MATH 1342"]
    with pytest.raises(ValueError, match="Heading"):
        catalog_course(html)
    with pytest.raises(ValueError, match="login"):
        catalog_course("<html>Please log in</html>")


def test_course_extraction_preserves_conditional_requisites():
    html = (
        '<td class="block_content"><h1 id="course_preview_title">'
        "ITSE 2370 - Intermediate Python Programming (3 Credit Hours)</h1>"
        "<em>Campus Location:</em> BHC, RLC<br>Python techniques.<br>"
        "Prerequisites: Recommended: ITSE 1370.<br>"
        "Course Hour Configuration (3 Lec.)</td>"
    )
    facts, _ = catalog_course(html)
    assert facts["description"] == "Python techniques."
    assert facts["requisites_raw"] == "Prerequisites: Recommended: ITSE 1370."
    assert facts["prerequisites"][0]["one_of"] == []


def test_unparsed_schedule_is_retained_and_partial_or_invalid_times_fail():
    raw = "K103 In-Person Lecture M W 09:00 AM - 09:55 AM unexpected lab pattern"
    assert parse_meetings(raw)[1] is False
    facts, recognized = facts_from_csv({"meeting_info": raw}, {"section": "1"})
    assert (
        not recognized and facts["meetings"] == [] and facts["meeting_info_raw"] == raw
    )
    loader.validate_section(facts)
    assert parse_meetings("K103 In-Person Lecture M 99:00 AM - 10:55 AM")[1] is False
    assert parse_meetings("K103 In-Person Lecture M W 09:00 AM - 09:55 AM")[1] is True


@pytest.mark.parametrize("missing_last", [False, True])
def test_facts_only_delivery_commits_once_or_rolls_back_every_batch(
    monkeypatch, missing_last
):
    from unittest.mock import MagicMock

    session = MagicMock()
    session.__enter__.return_value = session
    session.execute.side_effect = [
        MagicMock(rowcount=1),
        MagicMock(rowcount=0 if missing_last else 1),
    ]
    monkeypatch.setattr(loader, "SessionLocal", lambda: session)
    monkeypatch.setattr(loader, "describe_target", lambda: "isolated test target")
    rows = [
        {**valid_row(), "expected_content_hash": "a" * 64},
        {**valid_row(), "chunk_index": 1, "expected_content_hash": "a" * 64},
    ]
    if missing_last:
        with pytest.raises(ValueError, match="entire delivery rolled back"):
            loader.update_facts_only(rows, 1)
        session.commit.assert_not_called()
        session.rollback.assert_called_once()
    else:
        loader.update_facts_only(rows, 1)
        session.commit.assert_called_once()
        session.rollback.assert_not_called()


def test_status_is_read_only_and_fails_without_initializing_schema(monkeypatch):
    from unittest.mock import MagicMock

    engine = MagicMock()
    conn = engine.connect.return_value.__enter__.return_value
    conn.execute.side_effect = [None, RuntimeError("secret connection detail")]
    monkeypatch.setattr(database, "create_engine", lambda *a, **kw: engine)
    create = MagicMock()
    monkeypatch.setattr(database.Base.metadata, "create_all", create)
    with pytest.raises(RuntimeError, match="no database changes") as error:
        database.check_db_status("unused")
    assert "secret" not in str(error.value)
    assert str(conn.execute.call_args_list[0].args[0]) == "SET TRANSACTION READ ONLY"
    create.assert_not_called()
    engine.dispose.assert_called_once()


def test_snapshot_refuses_to_replace_existing_evidence_before_connecting(
    tmp_path, monkeypatch
):
    from unittest.mock import MagicMock

    connect = MagicMock()
    monkeypatch.setattr(database, "create_engine", connect)
    path = tmp_path / "snapshot.json"
    path.write_text("original", encoding="utf-8")
    with pytest.raises(ValueError, match="never overwritten"):
        database.export_snapshot(path, "unused")
    assert path.read_text(encoding="utf-8") == "original"
    connect.assert_not_called()


def test_manifest_refresh_uses_latest_identity_and_source_time(tmp_path):
    from dallasai.pipeline.extract_batch import iter_manifest

    folder = tmp_path / "manifests"
    folder.mkdir()
    old = {
        "kind": "course",
        "raw_path": "catalog/course.html",
        "fetched_at": "2026-01-01T00:00:00Z",
        "coid": "old",
    }
    new = {**old, "fetched_at": "2026-02-01T00:00:00Z", "coid": "new"}
    (folder / "archive_a.jsonl").write_text(json.dumps(new), encoding="utf-8")
    (folder / "archive_z.jsonl").write_text(json.dumps(old), encoding="utf-8")
    assert list(iter_manifest(tmp_path, "archive_*.jsonl")) == [new]


def test_unknown_schedule_modality_is_missing_information_not_an_enum_error():
    facts, _ = facts_from_csv(
        {"meeting_info": "Meeting Patterns will vary."},
        {"section": "1", "modality": "unknown"},
    )
    assert facts["modality"] is None
    assert facts["meeting_info_raw"] == "Meeting Patterns will vary."
    loader.validate_section(facts)


def test_schedule_assembly_keeps_term_identity_and_latest_receipts(tmp_path):
    import csv

    from dallasai.pipeline.assemble_delivery import sections_from_csvs

    schedule = tmp_path / "schedule"
    schedule.mkdir()
    base = {
        "class_prefix": "ITSE",
        "class_number": "1370",
        "section_number": "1",
        "class_name": "Intro Python",
        "professor": "Fall Teacher",
        "term_year": "Fall 2026",
        "date_accessed": "2026-08-12",
        "meeting_info": "INET Online Lecture Meeting Patterns will vary.",
        "syllabus_url": "https://dallascollege.campusconcourse.com/view_syllabus?course_id=1",
    }
    spring = {**base, "term_year": "Spring 2026", "professor": "Spring Teacher"}
    newer = {**base, "professor": "New Fall Teacher", "date_accessed": "2026-08-13"}
    for filename, rows in [
        ("dallas_classes_a.csv", [base, spring]),
        ("dallas_classes_z.csv", [newer]),
    ]:
        with (schedule / filename).open("w", newline="", encoding="utf-8") as output:
            writer = csv.DictWriter(output, fieldnames=list(base))
            writer.writeheader()
            writer.writerows(rows)
    rows = sections_from_csvs(tmp_path, ["2026FA", "2026SP"])
    assert len(rows) == 2
    assert {r["semester"]: r["professor"] for r in rows} == {
        "fall": "New Fall Teacher",
        "spring": "Spring Teacher",
    }
    assert (
        next(r for r in rows if r["semester"] == "fall")["facts"]["instructor"]
        == "New Fall Teacher"
    )


@pytest.mark.parametrize("value", [None, 123, {}, [], "not-a-date"])
def test_malformed_source_dates_fail_with_a_validation_error(tmp_path, value):
    row = valid_row()
    row["scraped_at"] = value
    path = tmp_path / "rows.json"
    path.write_text(json.dumps([row]), encoding="utf-8")
    with pytest.raises(ValueError, match="scraped_at"):
        loader.load_rows(path, expected_counts={"course": 1})


def test_reference_database_rerun_updates_filters_source_dates_and_search(tmp_path):
    import sqlite3

    from dallasai.pipeline.build_knowledge import load_sqlite

    row = valid_row()
    path = tmp_path / "reference.db"
    load_sqlite([row], path)
    row["chunk_text"] = "New replacement terminology"
    row["metadata"]["doc_type"] = "catalog"
    row["content_hash"] = "b" * 64
    load_sqlite([row], path)
    with sqlite3.connect(path) as connection:
        assert connection.execute(
            "SELECT doc_type, content_hash, scraped_at FROM knowledge_entry"
        ).fetchall() == [("catalog", "b" * 64, row["scraped_at"])]
        assert (
            connection.execute(
                "SELECT count(*) FROM ke_fts WHERE ke_fts MATCH 'Collision'"
            ).fetchone()[0]
            == 0
        )
        assert (
            connection.execute(
                "SELECT count(*) FROM ke_fts WHERE ke_fts MATCH 'replacement'"
            ).fetchone()[0]
            == 1
        )


def test_reconciliation_does_not_repropose_imported_option_pages(tmp_path):
    folder = tmp_path / "catalog" / "2026-2027" / "courses"
    folder.mkdir(parents=True)
    # Already indexed pages need no extraction or new source receipt.
    for key in ("15113", "15114"):
        (folder / f"{key}.html").write_text("already indexed", encoding="utf-8")
    course = valid_row()
    course["doc_type"] = "course"
    course["course_code"] = course["facts"]["course_code"]
    option = {
        **course,
        "doc_type": "catalog",
        "source_url": course["source_url"].replace("15113", "15114"),
        "metadata": {**course["metadata"], "record_kind": "course_options"},
    }
    report, additions, options = reconcile(
        tmp_path, {"docs": [course, option]}, "2026-2027"
    )
    assert report["missing_count"] == 0
    assert additions == options == []


def test_noncredit_course_heading_is_verified_without_a_credit_suffix():
    from dallasai.pipeline.verify_catalog import fold

    facts = {"course_code": "POFI 2031", "title": "Desktop Publishing"}
    source = "POFI 2031 - Desktop Publishing This is a Non-Credit Course."
    assert check_course(facts, source, fold(source)) == []
    facts["title"] = "Unrelated title"
    assert check_course(facts, source, fold(source))


def extraction_fixture(tmp_path):
    raw = tmp_path / "raw"
    manifests = raw / "manifests"
    manifests.mkdir(parents=True)
    entry = {
        "kind": "course",
        "raw_path": "catalog/2026-2027/courses/15113.html",
        "source_url": valid_row()["source_url"],
        "catalog_year": "2026-2027",
    }
    (manifests / "archive_course.jsonl").write_text(json.dumps(entry), encoding="utf-8")
    return raw, entry, tmp_path / "facts"


def test_missing_source_retires_stale_active_facts(tmp_path):
    from dallasai.pipeline.extract_batch import _doc_id, main

    raw, entry, out = extraction_fixture(tmp_path)
    stale = out / "course" / f"{_doc_id(entry)}.json"
    stale.parent.mkdir(parents=True)
    stale.write_text(
        json.dumps({"raw_path": entry["raw_path"], "facts": {}}), encoding="utf-8"
    )
    with pytest.raises(SystemExit):
        main(["--raw-root", str(raw), "--out", str(out)])
    assert not stale.exists()
    assert (
        len(list((tmp_path / "quarantine" / "superseded" / "course").glob("*.json")))
        == 1
    )


def test_empty_replay_map_never_falls_through_to_paid_extraction(tmp_path, monkeypatch):
    from unittest.mock import MagicMock

    from dallasai.pipeline import extract_batch

    raw, entry, out = extraction_fixture(tmp_path)
    source = raw / entry["raw_path"]
    source.parent.mkdir(parents=True)
    source.write_text("Public course source", encoding="utf-8")
    replay = tmp_path / "empty.jsonl"
    replay.write_text("", encoding="utf-8")
    call = MagicMock(side_effect=AssertionError("Replay must not call a provider"))
    monkeypatch.setattr(extract_batch, "extract", call)
    with pytest.raises(SystemExit):
        extract_batch.main(
            ["--raw-root", str(raw), "--out", str(out), "--replay-map", str(replay)]
        )
    call.assert_not_called()


def test_colliding_manifest_outputs_fail_before_any_extraction(tmp_path, monkeypatch):
    from unittest.mock import MagicMock

    from dallasai.pipeline import extract_batch

    raw, entry, out = extraction_fixture(tmp_path)
    other = {**entry, "raw_path": entry["raw_path"].replace("2026-2027", "2025-2026")}
    (raw / "manifests" / "archive_other.jsonl").write_text(
        json.dumps(other), encoding="utf-8"
    )
    for item in (entry, other):
        path = raw / item["raw_path"]
        path.parent.mkdir(parents=True)
        path.write_text("Public course source", encoding="utf-8")
    call = MagicMock(
        side_effect=AssertionError("Identity collision must fail before extraction")
    )
    monkeypatch.setattr(extract_batch, "extract", call)
    with pytest.raises(ValueError, match="collid"):
        extract_batch.main(["--raw-root", str(raw), "--out", str(out)])
    call.assert_not_called()


@pytest.mark.parametrize("stale", [False, True])
def test_facts_only_updates_check_reviewed_hash_and_rollback_atomically(
    monkeypatch, stale
):
    from types import SimpleNamespace

    from sqlalchemy import (
        JSON,
        Column,
        DateTime,
        Integer,
        MetaData,
        String,
        Table,
        create_engine,
        select,
    )
    from sqlalchemy.orm import Session

    engine = create_engine("sqlite://")
    table = Table(
        "knowledge_entry",
        MetaData(),
        Column("source_url", String, primary_key=True),
        Column("chunk_index", Integer, primary_key=True),
        Column("content_hash", String),
        Column("facts", JSON),
        Column("updated_at", DateTime),
    )
    table.metadata.create_all(engine)
    rows = [
        {
            **valid_row(),
            "chunk_index": i,
            "expected_content_hash": "a" * 64,
            "content_hash": "b" * 64,
        }
        for i in range(2)
    ]
    with engine.begin() as connection:
        connection.execute(
            table.insert(),
            [
                {
                    "source_url": row["source_url"],
                    "chunk_index": row["chunk_index"],
                    "content_hash": "c" * 64
                    if stale and row["chunk_index"] == 1
                    else "a" * 64,
                    "facts": {"original": True},
                }
                for row in rows
            ],
        )
    monkeypatch.setattr(loader, "KnowledgeEntry", SimpleNamespace(__table__=table))
    monkeypatch.setattr(loader, "SessionLocal", lambda: Session(engine))
    monkeypatch.setattr(
        loader, "describe_target", lambda: "isolated SQLite transaction test"
    )
    if stale:
        with pytest.raises(ValueError, match="changed targets"):
            loader.update_facts_only(rows, 1)
    else:
        loader.update_facts_only(rows, 1)
    with engine.connect() as connection:
        facts = (
            connection.execute(select(table.c.facts).order_by(table.c.chunk_index))
            .scalars()
            .all()
        )
        assert facts == (
            [{"original": True}] * 2 if stale else [r["facts"] for r in rows]
        )
    engine.dispose()


def test_facts_only_file_requires_a_valid_reviewed_hash(tmp_path):
    path = tmp_path / "repair.json"
    row = valid_row()
    path.write_text(json.dumps([row]), encoding="utf-8")
    with pytest.raises(ValueError, match="expected_content_hash"):
        loader.load_facts_only_rows(path)
    row["expected_content_hash"] = "unreviewed"
    path.write_text(json.dumps([row]), encoding="utf-8")
    with pytest.raises(ValueError, match="expected_content_hash"):
        loader.load_facts_only_rows(path)


def test_section_repair_reads_review_hash_before_session_closes(tmp_path, monkeypatch):
    """Exercise real ORM deferred columns, not a mock with every field populated."""
    from dallasai.pipeline import build_section_meetings as repair
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session

    engine = create_engine("sqlite://")
    source = "https://dallascollege.campusconcourse.com/view_syllabus?course_id=1"
    metadata = {
        "course_code": "ITSE 1370",
        "section": "1",
        "year": 2026,
        "semester": "fall",
        "professor": "Example Professor",
        "modality": "online",
    }
    with engine.begin() as connection:
        connection.execute(
            text("""CREATE TABLE knowledge_entry (
            id INTEGER PRIMARY KEY, source_url TEXT, chunk_index INTEGER,
            content_hash TEXT, chunk_text TEXT, facts JSON, metadata JSON,
            doc_type TEXT, year INTEGER, semester TEXT)""")
        )
        connection.execute(
            text("""INSERT INTO knowledge_entry VALUES
            (1, :url, 0, :hash, 'ITSE 1370', '{}', :metadata, 'section', 2026, 'fall')
            """),
            {"url": source, "hash": "a" * 64, "metadata": json.dumps(metadata)},
        )

    class ReadOnlySession(Session):
        def execute(self, statement, *args, **kwargs):
            if str(statement) == "SET TRANSACTION READ ONLY":
                return None  # SQLite has no PostgreSQL transaction command.
            return super().execute(statement, *args, **kwargs)

    monkeypatch.setattr(repair, "SessionLocal", lambda: ReadOnlySession(engine))
    monkeypatch.setattr(
        repair,
        "read_schedule",
        lambda _: {
            ("ITSE 1370", "1", "2026FA"): {
                "syllabus_url": source,
                "meeting_info": "INET Online Lecture Meeting Patterns will vary.",
            }
        },
    )
    output = tmp_path / "repair.json"
    monkeypatch.setattr(
        "sys.argv",
        [
            "repair",
            "--schedule",
            str(tmp_path),
            "--terms",
            "2026FA",
            "--out",
            str(output),
        ],
    )
    try:
        repair.main()
        assert (
            json.loads(output.read_text(encoding="utf-8"))[0]["expected_content_hash"]
            == "a" * 64
        )
    finally:
        engine.dispose()


def test_delivery_catalog_identity_comes_from_the_source_url():
    from dallasai.pipeline.assemble_delivery import enrich

    for url, expected in [
        (
            "https://catalog.dallascollege.edu/preview_course_nopop.php?catoid=9&coid=123",
            "9",
        ),
        ("https://catalog.dallascollege.edu/preview_course_nopop.php?coid=123", None),
    ]:
        result = enrich({"metadata": {}}, {"source_url": url}, "facts-course-v1")
        assert result["metadata"].get("acalog_catoid") == expected


def test_schedule_latest_receipt_uses_the_instant_not_lexical_date_order(tmp_path):
    import csv

    from dallasai.pipeline.build_section_meetings import read_schedule

    base = {
        "class_prefix": "ITSE",
        "class_number": "1370",
        "section_number": "1",
        "term_year": "Fall 2026",
    }
    newer = {
        **base,
        "date_accessed": "2026-08-12T23:30:00-05:00",
        "professor": "New Teacher",
    }
    older = {
        **base,
        "date_accessed": "2026-08-13T01:00:00Z",
        "professor": "Old Teacher",
    }
    path = tmp_path / "dallas_classes_test.csv"
    with path.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=list(newer))
        writer.writeheader()
        writer.writerows([newer, older])
    assert (
        read_schedule(tmp_path)[("ITSE 1370", "1", "2026FA")]["professor"]
        == "New Teacher"
    )


def test_delivery_rejects_unidentified_catalog_edition_before_composing(tmp_path):
    from dallasai.pipeline.assemble_delivery import catalog_rows

    folder = tmp_path / "course"
    folder.mkdir()
    (folder / "1.json").write_text(json.dumps({"context": {}}), encoding="utf-8")
    with pytest.raises(ValueError, match="catalog edition"):
        list(catalog_rows(tmp_path))


@pytest.mark.parametrize("changed_text", [False, True])
def test_vector_reuse_depends_on_actual_text_not_other_delivery_facts(
    tmp_path, changed_text
):
    from copy import deepcopy

    from dallasai.pipeline.carry_embeddings import main as carry

    old = valid_row()
    new = deepcopy(old)
    new.pop("embedding")
    new["content_hash"] = "b" * 64
    new["metadata"]["source_review"] = "new receipt"
    if changed_text:
        new["chunk_text"] += " A changed course description."
    previous, current, output = (
        tmp_path / name for name in ("old.json", "new.json", "out.json")
    )
    previous.write_text(json.dumps([old]), encoding="utf-8")
    current.write_text(json.dumps([new]), encoding="utf-8")
    carry([str(current), str(previous), str(output)])
    result = json.loads(output.read_text(encoding="utf-8"))[0]
    assert result["metadata"]["source_review"] == "new receipt"
    assert result["content_hash"] == "b" * 64
    assert ("embedding" in result) is not changed_text
    if not changed_text:
        validate_embedding(result)
