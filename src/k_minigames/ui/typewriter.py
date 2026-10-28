"""Shows a text letter by letter in the dialogue box while the character's mouth moves."""
from collections.abc import Callable

CHARS_PER_STEP = 3
FRAME_MS = 240   # the mouth changes about four times a second; one change per typing step looked like flicker


def type_text(stage, after: Callable, jobs: list, character: str, speaker: str, text: str, then_state: str,
              then: Callable[[], None], typing_ms: int = 30) -> None:
    """Type `text` as `speaker`; when it is all there show `then_state` and call `then`.
    `after` is Tk's `after`; the ids of the scheduled steps are added to `jobs` so a screen can cancel them."""
    stage.stop_asking()
    shown, steps, last_tick = 0, 0, -1

    def step() -> None:
        nonlocal shown, steps, last_tick
        shown += CHARS_PER_STEP
        steps += 1
        stage.say(speaker, text[:shown])
        if shown >= len(text):
            stage.set_character(character, then_state)
            then()
            return
        tick = (steps * typing_ms) // FRAME_MS
        if tick != last_tick:
            stage.set_character(character, "talking", tick)
            last_tick = tick
        jobs.append(after(typing_ms, step))

    step()
