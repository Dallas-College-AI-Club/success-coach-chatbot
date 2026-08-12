from collections import Counter

import pytest

from dallasai.load_catalog_to_neon import (
    validate_dataset_counts,
)


def test_rejects_program_only_delivery_by_default() -> None:
    with pytest.raises(
        ValueError,
        match="Unexpected dataset composition",
    ):
        validate_dataset_counts(
            total_rows=19,
            counts=Counter({"program_map": 19}),
        )


def test_accepts_exact_supplemental_program_delivery() -> None:
    validate_dataset_counts(
        total_rows=19,
        counts=Counter({"program_map": 19}),
        supplemental_doc_type="program_map",
        expected_supplemental_rows=19,
    )


def test_accepts_exact_supplemental_section_delivery() -> None:
    """A term delivery is the reason the mode is not program_map-only."""
    validate_dataset_counts(
        total_rows=12_872,
        counts=Counter({"section": 12_872}),
        supplemental_doc_type="section",
        expected_supplemental_rows=12_872,
    )


@pytest.mark.parametrize("total_rows", [18, 20])
def test_rejects_wrong_supplemental_program_count(
    total_rows: int,
) -> None:
    with pytest.raises(
        ValueError,
        match="supplemental program_map counts do not match",
    ):
        validate_dataset_counts(
            total_rows=total_rows,
            counts=Counter({"program_map": total_rows}),
            supplemental_doc_type="program_map",
            expected_supplemental_rows=19,
        )


def test_rejects_mixed_supplemental_delivery() -> None:
    with pytest.raises(
        ValueError,
        match="supplemental program_map counts do not match",
    ):
        validate_dataset_counts(
            total_rows=19,
            counts=Counter(
                {
                    "program_map": 18,
                    "course": 1,
                }
            ),
            supplemental_doc_type="program_map",
            expected_supplemental_rows=19,
        )


def test_rejects_delivery_of_a_different_doc_type() -> None:
    """The count can match while the doc_type does not."""
    with pytest.raises(
        ValueError,
        match="supplemental section counts do not match",
    ):
        validate_dataset_counts(
            total_rows=19,
            counts=Counter({"program_map": 19}),
            supplemental_doc_type="section",
            expected_supplemental_rows=19,
        )


def test_rejects_supplemental_without_expected_count() -> None:
    with pytest.raises(
        ValueError,
        match="needs an expected row count",
    ):
        validate_dataset_counts(
            total_rows=19,
            counts=Counter({"program_map": 19}),
            supplemental_doc_type="program_map",
        )
