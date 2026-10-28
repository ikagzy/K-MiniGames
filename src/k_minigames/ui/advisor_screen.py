"""The conversation with the advisor, on the advisor's stage.

Only one side speaks at a time: the label above the message says DANIŞMAN while the advisor talks (its mouth moves
as the text appears) and SEN while the user's own message is shown. When the advisor proposes a model the screen
asks before it uses an installed one or downloads a new one (see AdvisorFlow)."""
from k_minigames import hardware, i18n
from k_minigames.advisor import Advisor
from k_minigames.ollama_client import OllamaError
from k_minigames.startup import advisor_id
from k_minigames.ui.advisor_flow import AdvisorFlow
from k_minigames.ui.services import Services
from k_minigames.ui.typewriter import type_text
from k_minigames.ui.worker import CancelToken

t = i18n.t

GREETING = "Merhaba! Nasıl bir oyun yapmak istiyorsun?"
UNREACHABLE = "Ollama'ya ulaşamadım. Çalışıp çalışmadığını kontrol edip tekrar yazar mısın?"
DOWNLOAD_FAILED = "Model indirilemedi. İstersen tekrar deneyelim."


class AdvisorScreen:
    def __init__(self, services: Services, flow: AdvisorFlow | None = None, typing_ms: int = 30,
                 finish_ms: int = 1800):
        self.s = services
        self._flow = flow
        self._typing_ms, self._finish_ms = typing_ms, finish_ms
        self._jobs: list[str] = []
        self._busy = False
        self._last_user = ""
        self._progress: tuple[int, int | None] = (0, None)

    # --- life cycle -----------------------------------------------------------------------------------

    def show(self) -> None:
        if self._flow is None:
            client = self.s.client
            self._flow = AdvisorFlow(Advisor(client, advisor_id()), client, hardware.ram_gb(), hardware.vram_gb(),
                                     installed=client.installed)
        self.s.stage.set_scene("danisman")
        self._say_then(t(GREETING), "greeting", self._ask)

    def hide(self) -> None:
        self._busy = False
        for job in self._jobs:
            self.s.root.after_cancel(job)
        self._jobs = []
        self.s.stage.stop_asking()

    def _later(self, ms: int, fn) -> None:
        self._jobs.append(self.s.root.after(ms, fn))

    # --- showing what is said ---------------------------------------------------------------------------

    def _say_then(self, text: str, then_state: str, then) -> None:
        """Type `text` as the advisor (mouth moving), then show `then_state` and call `then`."""
        type_text(self.s.stage, self.s.root.after, self._jobs, "advisor", "DANIŞMAN", text, then_state, then,
                  self._typing_ms)

    def _ask(self) -> None:
        self.s.stage.set_character("advisor", "listening")
        self.s.stage.ask(self._on_submit)

    def _on_submit(self, text: str) -> None:
        stage = self.s.stage
        stage.stop_asking()
        stage.say("SEN", text)
        stage.set_character("advisor", "thinking")
        self._last_user = text
        self.s.worker.run(lambda: self._flow.user_says(text), self._on_reply, self._on_error)

    def _on_reply(self, reply) -> None:
        user_text = self._last_user
        self.s.worker.run(lambda: self._flow.remember(user_text, reply.text), lambda _: None, lambda _error: None)
        self._say_then(reply.text, "idle", self._dispatch)

    def _on_error(self, error: Exception) -> None:
        if isinstance(error, OllamaError):
            self._say_then(t(UNREACHABLE), "unsure", self._ask)
        else:
            self._say_then(f"{error}", "unsure", self._ask)

    # --- after the advisor spoke ------------------------------------------------------------------------

    def _dispatch(self) -> None:
        flow = self._flow
        if flow.state == "chatting":
            self._ask()
        elif flow.state in ("awaiting_use_installed", "awaiting_install"):
            self._question()
        elif flow.state == "installing":
            self._install()
        elif flow.state == "done":
            self._finish()
        elif flow.state == "cancelled":
            self._say_then(t(flow.cancel_message), "unsure", self._ask)
        else:
            self._say_then(t(DOWNLOAD_FAILED), "unsure", self._ask)

    def _question(self) -> None:
        flow, offer = self._flow, self._flow.current_offer
        if offer.kind == "use_installed":
            title = t("Kurulu model bulundu")
            message = t(f"Bilgisayarında {offer.model} modeli zaten kurulu (yaklaşık {offer.size_gb:.1f} GB) ve bu iş "
                        "için yeterli.\n\nBunu oyunları yazmak için kullanayım mı?")
        else:
            title = t("Oyun modeli indirilsin mi?")
            note = ""
            if flow.recommendation is not None and flow.recommendation.substituted and flow.recommendation.reason:
                note = f"({t(flow.recommendation.reason)})\n\n"
            message = note + t(f"{offer.model} modeli Ollama üzerinden indirilecek (yaklaşık {offer.size_gb:.1f} GB)."
                               "\n\nİndirilsin mi?")
        flow.answer(self.s.confirm(title, message))
        self._dispatch()

    def _install(self) -> None:
        flow = self._flow
        self._busy, self._progress = True, (0, None)
        self.s.stage.set_character("advisor", "thinking")
        self._poll()
        token = CancelToken()

        def finished(_result) -> None:
            self._busy = False
            self._dispatch()

        def failed(_error: Exception) -> None:
            flow.fail()
            finished(False)

        self.s.worker.run(lambda: flow.install(lambda status, done, total: setattr(self, "_progress", (done, total)),
                                               token), finished, failed)

    def _poll(self) -> None:
        if not self._busy:
            return
        done, total = self._progress
        percent = f" %{done * 100 // total}" if total else ""
        self.s.stage.say("DANIŞMAN", t("İndiriliyor…") + percent)
        self._later(250, self._poll)

    def _finish(self) -> None:
        from k_minigames import settings
        model = settings.get("game_model") or ""
        self._say_then(t(f"Tamam! Oyunlarını {model} modeliyle yazacağız. Hadi başlayalım!"), "farewell",
                       lambda: self._later(self._finish_ms, lambda: self.s.navigate("library")))
