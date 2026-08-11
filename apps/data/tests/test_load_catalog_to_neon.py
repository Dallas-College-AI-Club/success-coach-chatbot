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
        allow_supplemental_programs=True,
    )


@pytest.mark.parametrize("total_rows", [18, 20])
def test_rejects_wrong_supplemental_program_count(
    total_rows: int,
) -> None:
    with pytest.raises(
        ValueError,
        match="supplemental program counts do not match",
    ):
        validate_dataset_counts(
            total_rows=total_rows,
            counts=Counter({"program_map": total_rows}),
            allow_supplemental_programs=True,
        )


def test_rejects_mixed_supplemental_delivery() -> None:
    with pytest.raises(
        ValueError,
        match="supplemental program counts do not match",
    ):
        validate_dataset_counts(
            total_rows=19,
            counts=Counter(
                {
                    "program_map": 18,
                    "course": 1,
                }
            ),
            allow_supplemental_programs=True,
        )