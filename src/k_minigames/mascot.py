"""Which picture a character shows in which situation (the tables are in docs/ui-varliklari.md).

Characters: "advisor" (the purple creature, before a model is installed) and "bear" (the bellhop, while games are made).
`talking` alternates between three frames so the mouth seems to move; every other state is one fixed frame."""

_TALKING = ("bosta", "konusuyor_a", "konusuyor_b", "konusuyor_a")

_ADVISOR = {
    "idle": "bosta", "listening": "dinliyor", "greeting": "karsilama", "farewell": "veda",
    "thinking": "yaziyor", "testing": "yaziyor", "proposal": "oneri", "fixed": "oneri", "success": "oneri",
    "unsure": "emin_degil", "error": "emin_degil",
}
_BEAR = {
    "idle": "bosta", "listening": "dinliyor", "greeting": "selamlama", "farewell": "veda",
    "thinking": "dusunuyor", "testing": "test_ediyor", "fixed": "anladim", "proposal": "anladim",
    "success": "basari", "error": "hata", "unsure": "emin_degil",
}
_CHARACTERS = {"advisor": ("danisman", _ADVISOR), "bear": ("maskot", _BEAR)}


def frame(character: str, state: str, tick: int = 0) -> str:
    """The picture to show, as a path under assets/runtime without the extension, e.g. "maskot/basari"."""
    folder, table = _CHARACTERS[character]
    name = _TALKING[tick % len(_TALKING)] if state == "talking" else table.get(state, table["idle"])
    return f"{folder}/{name}"
