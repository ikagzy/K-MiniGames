"""The advisor conversation without any window: what has been said, and which model is being chosen.

States: chatting -> (proposal) -> awaiting_use_installed -> awaiting_install -> installing -> done,
with `cancelled` after two noes and `error` after a failed download. Talking again starts a new round."""
from collections.abc import Callable

from k_minigames import memory as memory_notes
from k_minigames import model_check, settings
from k_minigames.advisor import Advisor, AdvisorReply
from k_minigames.model_check import Recommendation
from k_minigames.ollama_client import InstalledModel, OllamaError, is_installed
from k_minigames.startup import CANCEL_MESSAGE, Offer, build_offers


class AdvisorFlow:
    def __init__(self, advisor: Advisor, client, ram_gb: float, vram_gb: float | None,
                 installed: Callable[[], list[InstalledModel]]):
        self._advisor, self._client = advisor, client
        self._ram, self._vram, self._installed = ram_gb, vram_gb, installed
        self.state = "chatting"
        self.history: list[dict] = []
        self.recommendation: Recommendation | None = None
        self.current_offer: Offer | None = None
        self.cancel_message = ""
        self.modules: list[str] = []   # the game library modules the game needs, chosen when a model is proposed
        self._offers: list[Offer] = []

    @property
    def vram_gb(self) -> float | None:
        return self._vram

    def set_vram(self, value: float | None) -> None:
        """The graphics card memory, measured in the background after the screen opened."""
        self._vram = value

    # --- talking ------------------------------------------------------------------------------------

    def user_says(self, text: str, memory: str | None = None, on_token=None, cancel=None) -> AdvisorReply:
        """`memory=None` reads the advisor's memory file; a given text (even an empty one) is used as it is."""
        self._reset_choice()
        if memory is None:
            memory = memory_notes.load(memory_notes.advisor_path())
        reply = self._advisor.ask(self.history, text, memory=memory, on_token=on_token, cancel=cancel)
        self.history += [{"role": "user", "content": text}, {"role": "assistant", "content": reply.text}]
        if reply.proposal:
            self._propose(reply.proposal)
            chooser = getattr(self._advisor, "choose_modules", None)
            try:
                self.modules = chooser(self.history) if chooser else []
            except Exception:
                self.modules = []
        return reply

    def remember(self, user_text: str, reply_text: str, cancel=None) -> None:
        """Rewrite the advisor's memory after one exchange (the screen calls this in the background)."""
        memory_notes.remember(memory_notes.advisor_path(), getattr(self._advisor, "client", None),
                              getattr(self._advisor, "model", ""), user_text, reply_text, cancel)

    def _reset_choice(self) -> None:
        self.state, self.recommendation, self.current_offer, self._offers = "chatting", None, None, []

    def _installed_models(self) -> list[InstalledModel]:
        try:
            return self._installed()
        except OllamaError:
            return []

    def _propose(self, proposal: str) -> None:
        chosen = settings.get("game_model")
        if chosen and is_installed(chosen, [m.name for m in self._installed_models()]):
            self.state = "done"   # the user already agreed to this model: a new game does not ask again
            return
        self.recommendation = model_check.recommend(proposal, self._ram, self._vram)
        needed = self.recommendation.model
        match = model_check.installed_alternative(needed, self._installed_models(), self._ram, self._vram,
                                                  prefer="best")
        self._offers = build_offers(match, needed)
        self._ask_next()

    # --- the questions -------------------------------------------------------------------------------

    def _ask_next(self) -> None:
        if not self._offers:
            self.state, self.current_offer, self.cancel_message = "cancelled", None, CANCEL_MESSAGE
            return
        offer = self._offers.pop(0)
        self.current_offer = offer
        if offer.kind == "already_installed":
            self._use(offer)
        else:
            self.state = "awaiting_use_installed" if offer.kind == "use_installed" else "awaiting_install"

    def _use(self, offer: Offer) -> None:
        settings.put("game_model", offer.model)
        self.state = "done"

    def answer(self, yes: bool) -> None:
        """The user's answer to the question in `current_offer`."""
        if self.state not in ("awaiting_use_installed", "awaiting_install"):
            return
        offer = self.current_offer
        if yes and offer.kind == "use_installed":
            self._use(offer)
        elif yes:
            self.state = "installing"
        else:
            self._ask_next()

    def install(self, on_progress: Callable[[str, int, int], None], cancel: Callable[[], bool] | None = None) -> bool:
        """Download the recommended model (after a yes). The model is remembered only when the download worked."""
        offer = self.current_offer
        if self.state != "installing" or offer is None:
            return False
        if self._client.pull(offer.model, on_progress, cancel):
            self._use(offer)
            return True
        self.state = "error"
        return False

    def fail(self) -> None:
        """The download stopped with an unexpected error."""
        self.state = "error"
