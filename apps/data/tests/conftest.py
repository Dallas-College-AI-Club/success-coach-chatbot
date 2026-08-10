import pytest


@pytest.fixture(autouse=True)
def _no_live_extractor(monkeypatch):
    """Keep the suite hermetic: never fire live extraction API calls.

    "" reads as unset in extract.parse_extractor_setting, and an existing
    (even empty) key survives dotenv's override=False re-loads. Tests that
    want live extraction opt back in with their own monkeypatch.setenv.
    """
    monkeypatch.setenv("EXTRACTOR", "")
