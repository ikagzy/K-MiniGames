"""The app's own memory: a short summary of the chat, put at the very top of every request to the model.

Small local models forget the start of a long chat, so the app keeps the gist itself and shows it first each time."""

MAX_CHARS = 1500
TITLE = "HAFIZA (bunu unutma):"


def block(memory: str) -> str:
    """The text that goes at the very start of the first (system) message; empty when there is no memory."""
    memory = (memory or "").strip()
    return f"{TITLE}\n{memory}" if memory else ""
