from pathlib import Path

import pytest

from k_minigames import mascot

RUNTIME = Path(mascot.__file__).parent / "assets" / "runtime"
STATES = ("idle", "listening", "greeting", "farewell", "talking", "thinking", "testing", "fixed",
          "success", "error", "unsure", "proposal")


@pytest.mark.parametrize("character", ["advisor", "bear"])
@pytest.mark.parametrize("state", STATES)
def test_every_state_of_every_character_has_a_picture_on_disk(character, state):
    for tick in range(4):
        assert (RUNTIME / f"{mascot.frame(character, state, tick)}.png").is_file()


def test_talking_cycles_through_three_different_frames_for_each_character():
    for character in ("advisor", "bear"):
        frames = [mascot.frame(character, "talking", t) for t in range(8)]
        assert len(set(frames)) == 3
        assert frames[:4] == frames[4:]


def test_only_talking_changes_with_the_tick():
    assert mascot.frame("bear", "thinking", 0) == mascot.frame("bear", "thinking", 5)


def test_an_unknown_state_is_the_idle_frame():
    assert mascot.frame("bear", "uçuyor") == mascot.frame("bear", "idle")
    assert mascot.frame("advisor", "") == mascot.frame("advisor", "idle")


def test_the_two_characters_use_their_own_folders():
    assert mascot.frame("advisor", "idle").startswith("danisman/")
    assert mascot.frame("bear", "idle").startswith("maskot/")


def test_the_bear_has_its_own_picture_for_each_working_state():
    names = {s: mascot.frame("bear", s) for s in ("thinking", "testing", "fixed", "success", "error")}
    assert names == {"thinking": "maskot/dusunuyor", "testing": "maskot/test_ediyor", "fixed": "maskot/anladim",
                     "success": "maskot/basari", "error": "maskot/hata"}


def test_the_advisor_proposal_frame_is_the_idea_frame():
    assert mascot.frame("advisor", "proposal") == "danisman/oneri"
