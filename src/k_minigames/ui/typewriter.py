"""Shows a text letter by letter in the dialogue box while the character's mouth moves."""
from collections.abc import Callable

CHARS_PER_STEP = 3


def type_text(stage, after: Callable, jobs: list, character: str, speaker: str, text: str, then_state: str,
              then: Callable[[], None], typing_ms: int = 30) -> None:
    """Type `text` as `speaker`; when it is all there show `then_state` and call `then`.
    `after` is Tk's `after`; the ids of the scheduled steps are added to `jobs` so a screen can cancel them."""
    stage.stop_asking()
    shown = 0

    def step() -> None:
        nonlocal shown
        shown += CHARS_PER_STEP
        stage.say(speaker, text[:shown])
        if shown >= len(text):
            stage.set_character(character, then_state)
            then()
            return
        stage.set_character(character, "talking", shown // CHARS_PER_STEP)
        jobs.append(after(typing_ms, step))

    step()
