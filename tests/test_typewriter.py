import pytest

from k_minigames.ui import typewriter
from k_minigames.ui.typewriter import FRAME_MS, type_text


class FakeStage:
    def __init__(self):
        self.shown, self.poses = "", []

    def stop_asking(self):
        pass

    def say(self, speaker, text, follow=False):
        self.shown = text

    def set_character(self, character, state, tick=0):
        self.poses.append((state, tick))


def run(text, typing_ms):
    stage, queue, done = FakeStage(), [], []
    type_text(stage, lambda ms, fn: queue.append(fn), [], "advisor", "DON", text, "idle", lambda: done.append(True), typing_ms)
    while queue:
        queue.pop(0)()
    return stage, done


def test_the_mouth_changes_every_couple_of_hundred_milliseconds_not_on_every_step():
    stage, done = run("a" * 300, typing_ms=30)          # about three seconds of speaking
    talking = [p for p in stage.poses if p[0] == "talking"]
    assert done == [True] and stage.shown == "a" * 300 and stage.poses[-1] == ("idle", 0)
    assert 8 <= len(talking) <= 16                       # was one change per 30 ms step (100 of them)
    ticks = [tick for _, tick in talking]
    assert ticks == sorted(ticks) and len(set(ticks)) == len(ticks)


def test_a_short_text_still_shows_one_talking_frame_and_then_the_resting_one():
    stage, done = run("Merhaba!", typing_ms=30)
    assert [p[0] for p in stage.poses].count("talking") >= 1 and stage.poses[-1][0] == "idle"


def test_the_frame_time_is_a_calm_one():
    assert 150 <= FRAME_MS <= 400
