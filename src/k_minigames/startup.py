"""What the app does at start, and how it asks before it uses or installs a model.

Nothing is downloaded or chosen without a yes: an installed model that is enough is offered first, then the
recommended model, and two noes mean cancel."""
from dataclasses import dataclass

from k_minigames.catalog import ModelInfo
from k_minigames.ollama_client import InstalledModel, OllamaError

CANCEL_MESSAGE = "Model kurulmadığı için devam edemiyorum. İstediğin zaman yeniden deneyebilirsin."


def startup_state(client, advisor_id: str, game_model: str | None) -> str:
    """Which screen to open: "setup", "advisor" or "library"."""
    if not client.is_running():
        return "setup"
    try:
        models = client.models()
    except OllamaError:
        return "setup"
    if advisor_id not in models:
        return "setup"
    if not game_model or game_model not in models:
        return "advisor"
    return "library"


@dataclass(frozen=True)
class SetupButtons:
    ollama: str    # "download" | "start" | "done"
    advisor: str   # "disabled" | "download" | "done"


def setup_buttons(ollama_installed: bool, ollama_running: bool, advisor_installed: bool) -> SetupButtons:
    if ollama_running:
        return SetupButtons("done", "done" if advisor_installed else "download")
    if ollama_installed:
        return SetupButtons("start", "disabled")
    return SetupButtons("download", "disabled")


@dataclass(frozen=True)
class Offer:
    kind: str       # "already_installed" | "use_installed" | "install_new"
    model: str
    size_gb: float


def build_offers(match: InstalledModel | None, to_install: ModelInfo) -> list[Offer]:
    """The questions to ask, in order. `match` is an installed model that is enough for the job (or None)."""
    if match is not None and match.name == to_install.id:
        return [Offer("already_installed", match.name, match.size_gb)]
    offers = []
    if match is not None:
        offers.append(Offer("use_installed", match.name, match.size_gb))
    offers.append(Offer("install_new", to_install.id, to_install.size_gb))
    return offers


def first_accepted(offers: list[Offer], confirm) -> Offer | None:
    """Ask in order; the first yes wins. None means the user said no to everything (show CANCEL_MESSAGE)."""
    for offer in offers:
        if offer.kind == "already_installed" or confirm(offer):
            return offer
    return None
