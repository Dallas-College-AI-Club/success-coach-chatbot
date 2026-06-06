from dallasai.main import greeting


def test_greeting():
    assert greeting() == "Hello from data!"
