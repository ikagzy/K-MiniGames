import re

import pytest

from k_minigames import kgamelib

BUDGET_TOKENS = {"core": 2000, "ai": 1500, "sports": 1500}   # spec: what the model may be shown per module
CHARS_PER_TOKEN = 3.5


def _read(name):
    return (kgamelib.LIB_DIR / name).read_text(encoding="utf-8")


def _library_source():
    return "\n".join(_read(name) for name in sorted(kgamelib.all_files()))


@pytest.mark.parametrize("module", sorted(kgamelib.MODULES))
def test_a_guide_stays_within_its_token_budget(module):
    text = _read(kgamelib.MODULES[module].guide)
    assert len(text) / CHARS_PER_TOKEN <= BUDGET_TOKENS.get(module, 1500), f"{module} guide is too long"


def test_everything_the_guides_ship_fits_the_context_with_room_for_the_game():
    everything = kgamelib.guides(["core", "ai", "sports"])
    assert len(everything) / CHARS_PER_TOKEN <= 4000   # of 8192: the description, the game and the answer need the rest


def test_every_function_a_guide_names_exists_in_the_library():
    source = _library_source()
    missing = []
    for name in sorted(kgamelib.MODULES):
        for ref in re.findall(r"\b(?:K\.(?:\w+\.)?\w+|g\.(?:ui\.)?\w+|map\.\w+|court\.\w+)", _read(kgamelib.MODULES[name].guide)):
            last = ref.split(".")[-1]
            if not re.search(rf"\b{re.escape(last)}\b", source):
                missing.append(ref)
    assert not missing, f"named in a guide but not in the library: {missing}"


def test_the_sports_guide_carries_the_volleyball_example_word_for_word():
    html = (kgamelib.LIB_DIR / "examples" / "volleyball.html").read_text(encoding="utf-8")
    script = re.search(r"<script>\n(.*?)</script>", html, re.S).group(1).strip()
    assert script in _read("sports.guide.md").replace("\r\n", "\n")


def test_the_core_guide_tells_the_rules_that_keep_a_small_model_out_of_trouble():
    text = _read("core.guide.md")
    for rule in ("CONFIG", "K.expose", "script src", "SOL-ÜST", "MERKEZİ", "en üstte"):
        assert rule in text, rule


def test_the_examples_use_only_what_the_library_has():
    source = _library_source()
    for example in (kgamelib.LIB_DIR / "examples").glob("*.html"):
        for ref in re.findall(r"\bK\.(?:\w+\.)?\w+", example.read_text(encoding="utf-8")):
            assert re.search(rf"\b{re.escape(ref.split('.')[-1])}\b", source), (example.name, ref)
