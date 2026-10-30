"""Where games are made: the bellhop bear asks what you want, builds it, tries it, fixes it and tells how it went.

Creating asks the game's name, then what the game should be (textures can be added any time before). Editing asks
what to change. The bear's pictures follow the work: thinking while the game is written, testing while it is tried in
the browser, an idea when a bug is found and fixed, then success or a worried face."""
import threading
import tkinter as tk
import webbrowser
from pathlib import Path
from types import SimpleNamespace

from k_minigames import i18n, library, settings, studio
from k_minigames import memory as memory_notes
from k_minigames.checker import CheckReport
from k_minigames.generator import Generator
from k_minigames.htmlscan import Problem
from k_minigames.library import Game
from k_minigames.report_server import ReportServer
from k_minigames.testlist import FAILED, PASSED, UNVERIFIED
from k_minigames.ui import fonts
from k_minigames.ui.services import Services
from k_minigames.ui.stage import BEAR_NAME, TEXT_COLOR, TEXT_X
from k_minigames.ui.typewriter import type_text
from k_minigames.ui.worker import CancelToken

t = i18n.t

SPEAKER = BEAR_NAME
ASK_NAME = "Ben Bob! Oyununa ne ad verelim?"
ASK_DESCRIPTION = ("Nasıl bir oyun istiyorsun? Anlat bakalım. İstersen önce sağ üstteki 'Doku ekle' ile resimlerini "
                   "ekleyebilirsin.")
ASK_KNOWN = ("Don bana şunları anlattı:\n")
ASK_KNOWN_END = "\nBunu yapayım mı? 'evet' yaz ya da eklemek istediklerini yaz."
YES_WORDS = ("evet", "e", "tamam", "olur", "yap", "yes", "y", "ok")
ASK_CHANGE = "Ne değiştirmek istiyorsun?"
NOT_RUNNING = "Ollama çalışmıyor. Açıp tekrar dener misin?"
FAILED_TEXT = "Oyunu üretemedim"
READY = "Hazır!"
_STATE_TO_POSE = {"generating": "thinking", "testing": "testing", "fixing": "fixed"}


MAX_ERROR_LINES = 3


def _leftover_lines(report: CheckReport) -> list[str]:
    """The errors that are still there after the last try (the first few, then a count)."""
    texts = [f"Hata kaldı: {error}" for error in report.js_errors]
    texts += [f"Sorun kaldı: {p.as_text()}" for p in report.problems if isinstance(p, Problem) and p.severity == "error"]
    lines = texts[:MAX_ERROR_LINES]
    if len(texts) > MAX_ERROR_LINES:
        lines.append(f"… ve {len(texts) - MAX_ERROR_LINES} hata daha")
    return lines


def summary_lines(report: CheckReport, attempts: int, rejected: bool) -> list[str]:
    """What the user is told after a try, in Turkish (the screen translates). Only counts above zero are shown."""
    counts = {PASSED: 0, UNVERIFIED: 0, FAILED: 0}
    for item in report.items:
        counts[item.status] = counts.get(item.status, 0) + 1
    lines = []
    if counts[PASSED]:
        lines.append(f"{counts[PASSED]} madde geçti")
    if counts[UNVERIFIED]:
        lines.append(f"{counts[UNVERIFIED]} madde doğrulanamadı")
    if counts[FAILED]:
        lines.append(f"{counts[FAILED]} madde kaldı")
    if attempts > 0:
        lines.append(f"{attempts} kez otomatik düzelttim")
    lines += _leftover_lines(report)
    if not report.finished:
        lines.append("Oyun tarayıcıda denenemedi; çalıştığını doğrulayamadım.")
    if report.console_errors:
        lines.append(f"Dikkat: oyun konsola {len(report.console_errors)} hata mesajı yazıyor")
    for problem in report.problems:
        if isinstance(problem, Problem) and problem.kind == "external_url":
            lines.append(f"Dikkat: oyun bir dış ağ adresi kullanıyor ({problem.detail})")
        elif isinstance(problem, Problem) and problem.kind.startswith("probe_") and problem.severity == "warning":
            lines.append(f"Dikkat: {problem.detail}")
    if rejected:
        lines.append("Bu düzenleme çalışmadı; oyunun önceki hâli korundu.")
    return lines


def result_pose(report: CheckReport, rejected: bool) -> str:
    """Bob's face after a try: success only when the game ran, nothing is broken and nothing is unverified."""
    hard = any(isinstance(p, Problem) and p.severity == "error" for p in report.problems)
    if rejected or report.js_errors or hard or not report.finished:
        return "error"
    if any(item.status in (UNVERIFIED, FAILED) for item in report.items):
        return "unsure"
    return "success"


def _in_background(generator, game, user_text: str, note: str, previous: str) -> None:
    """The memory update runs on its own thread so the result is shown without waiting for it."""
    threading.Thread(target=studio.remember_exchange, args=(generator, game, user_text, note, previous),
                     daemon=True).start()


class _NotRunning(Exception):
    pass


class StudioScreen:
    def __init__(self, services: Services, flows=None, typing_ms: int = 30, generator_factory=None,
                 server_factory=None, open_url=None):
        self.s = services
        self._flows = flows or SimpleNamespace(create=studio.create_game_flow, edit=studio.edit_game_flow)
        self._typing_ms = typing_ms
        self._generator_factory = generator_factory or (lambda: Generator(self.s.client, settings.get("game_model"), keep_alive="2m"))
        self._server_factory = server_factory or (lambda game: ReportServer(game.folder))
        self._open_url = open_url or webbrowser.open
        self._game: Game | None = None
        self._mode = "create"
        self._jobs: list[str] = []
        self._widgets: list[tk.Widget] = []
        self._action_widgets: list[tk.Widget] = []
        self._busy = False
        self._status = ("generating", "")
        self._cancel: CancelToken | None = None
        self._hidden = False
        self._notes = ""

    # --- life cycle ------------------------------------------------------------------------------------

    def show(self) -> None:
        self._hidden = False
        stage = self.s.stage
        stage.set_scene("lobi")
        if not settings.get("game_model"):
            self.s.root.after(0, lambda: self.s.navigate("advisor"))
            return
        self._mode = self.s.session.get("mode", "create")
        self._game = self.s.session.get("game") if self._mode == "edit" else None
        if self._mode == "edit" and self._game is None:
            self.s.root.after(0, lambda: self.s.navigate("library"))
            return
        self._toolbar()
        if self._mode == "edit":
            self._ask(ASK_CHANGE, self._on_change)
        else:
            self._ask(ASK_NAME, self._on_name)

    def hide(self) -> None:
        self._hidden = True
        if self._busy and self._cancel is not None:
            self._cancel.cancel()   # leaving mid-build stops the build instead of letting it draw over the next screen
        self._busy = False
        for job in self._jobs:
            self.s.root.after_cancel(job)
        self._jobs = []
        self._clear_actions()
        self.s.stage.stop_asking()
        self.s.stage.delete("studio")
        for widget in self._widgets:
            widget.destroy()
        self._widgets = []

    # --- helpers -----------------------------------------------------------------------------------------

    def _small_button(self, text: str, x: int, y: int, width: int, command, tag: str = "studio") -> tk.Button:
        button = tk.Button(self.s.stage, text=t(text), command=command, relief="flat", bg="#333333", fg=TEXT_COLOR,
                           activebackground="#555555", activeforeground=TEXT_COLOR, font=fonts.font(self.s.stage, fonts.BUTTON))
        self.s.stage.create_window(x, y, anchor="nw", window=button, width=width, height=24, tags=tag)
        return button

    def _toolbar(self) -> None:
        self._widgets.append(self._small_button("Doku ekle", 640, 380, 100, self.add_textures))
        if self._mode == "edit":
            self._widgets.append(self._small_button("Eski sürüme dön", 748, 380, 112, self.go_back_a_version))
        else:
            self._widgets.append(self._small_button("Kütüphane", 748, 380, 112, lambda: self.s.navigate("library")))

    def _say(self, text: str, then_state: str, then) -> None:
        type_text(self.s.stage, self.s.root.after, self._jobs, "bear", SPEAKER, t(text), then_state, then,
                  self._typing_ms)

    def _ask(self, prompt: str, on_submit) -> None:
        self._clear_actions()

        def listen() -> None:
            self.s.stage.set_character("bear", "listening")
            self.s.stage.ask(on_submit)

        self._say(prompt, "idle", listen)

    def _clear_actions(self) -> None:
        self.s.stage.delete("actions")
        for widget in self._action_widgets:
            widget.destroy()
        self._action_widgets = []

    def actions_visible(self) -> bool:
        return bool(self._action_widgets)

    # --- talking -------------------------------------------------------------------------------------------

    def _on_name(self, name: str) -> None:
        folder = settings.games_dir()
        if folder is None or not library.can_write(folder):
            self.s.info(t("Klasör kullanılamıyor"), t("Bu klasöre yazılamıyor ya da diskte yeterli yer yok."))
            return
        self._game = library.create_game(folder, name)
        if self.s.session.get("modules"):
            library.set_modules(self._game, self.s.session["modules"])   # what Don chose from the game library
        # what Don learned in the talk before is not asked again: Bob reads Don's notes and only wants a yes or more
        self._notes = memory_notes.load(memory_notes.advisor_path()).strip()
        self._ask(ASK_KNOWN + self._notes + ASK_KNOWN_END if self._notes else ASK_DESCRIPTION, self._on_description)

    def _on_description(self, description: str) -> None:
        if self._notes:
            description = self._notes if description.strip().lower() in YES_WORDS else f"{self._notes}\n{description}"
        self._run(lambda game, textures, server, status, cancel: self._flows.create(
            self._generator_factory(), game, description, textures, server, self._open_url, status, cancel,
            background=_in_background), retry=self._on_description)

    def _on_change(self, request: str) -> None:
        self._run(lambda game, textures, server, status, cancel: self._flows.edit(
            self._generator_factory(), game, request, textures, server, self._open_url, status, cancel,
            background=_in_background), retry=self._on_change)

    # --- textures and versions ------------------------------------------------------------------------------

    def add_textures(self) -> None:
        if self._busy:
            return
        if self._game is None:
            self.s.info(t("Doku ekle"), t("Önce oyunun adını yaz."))
            return
        for name in self.s.choose_files():
            path = Path(name)
            description = self.s.ask_text(t("Doku açıklaması"), t(f"{path.name} ne için kullanılsın? (örn. zemin, düşman)"))
            try:
                library.add_texture(self._game, path, description or "")
            except ValueError:
                self.s.info(t("Doku ekle"), t(f"{path.name} bir resim değil."))

    def go_back_a_version(self) -> None:
        if self._busy or self._game is None:
            return
        available = library.versions(self._game)
        if not available:
            self.s.info(t("Eski sürüme dön"), t("Henüz eski bir sürüm yok."))
            return
        answer = self.s.ask_text(t("Eski sürüme dön"), t(f"Hangi sürüme dönelim? Var olanlar: {available}"))
        if answer and answer.strip().isdigit() and library.restore_version(self._game, int(answer.strip())):
            self._say(f"Tamam, {int(answer.strip())}. sürüme döndüm.", "idle", lambda: None)

    # --- building --------------------------------------------------------------------------------------------

    def _run(self, work, retry) -> None:
        stage = self.s.stage
        stage.stop_asking()
        folder = settings.games_dir()
        if folder is None or not library.can_write(folder):   # before every generation, create or edit
            self._finish_with_error(t("Bu klasöre yazılamıyor ya da diskte yeterli yer yok."), retry)
            return
        game = self._game
        self._busy, self._status, self._cancel = True, ("generating", t("Oyun üretiliyor…")), CancelToken()
        stage.set_character("bear", "thinking")
        self._poll()
        server = self._server_factory(game)

        def status(state: str, text: str) -> None:
            self._status = (state, t(text))

        def job():
            if not self.s.client.is_running():
                raise _NotRunning()
            server.start()
            try:
                return work(game, library.textures(game), server, status, self._cancel)
            finally:
                server.stop()

        self.s.worker.run(job, lambda outcome: self._done(outcome, retry), lambda error: self._failed(error, retry))

    def _poll(self) -> None:
        if not self._busy:
            return
        state, text = self._status
        self.s.stage.say(SPEAKER, text)
        self.s.stage.set_character("bear", _STATE_TO_POSE.get(state, "thinking"))
        self._jobs.append(self.s.root.after(250, self._poll))

    def _done(self, outcome, retry) -> None:
        self._busy = False
        if self._hidden:
            return
        lines = summary_lines(outcome.report, outcome.attempts, outcome.rejected)
        text = "\n".join(t(line) for line in lines) or t(READY)
        pose = result_pose(outcome.report, outcome.rejected)
        self._say(text, pose, lambda: self._show_actions(can_play=self._game is not None and self._game.html_path.exists(),
                                                       retry=retry))

    def _failed(self, error: Exception, retry) -> None:
        self._busy = False
        if self._hidden:
            return
        if isinstance(error, _NotRunning):
            self._finish_with_error(t(NOT_RUNNING), retry)
            return
        self._finish_with_error(f"{t(FAILED_TEXT)}: {error}", retry)

    def _finish_with_error(self, text: str, retry) -> None:
        self._busy = False
        can_play = self._game is not None and self._game.html_path.exists()
        self._say(text, "error", lambda: self._show_actions(can_play=can_play, retry=retry))

    def _show_actions(self, can_play: bool, retry) -> None:
        self._clear_actions()
        x = TEXT_X
        buttons = []
        if can_play:
            buttons += [("Oyna", lambda: self.s.open_path(self._game.launcher_path)), ("Düzenle", self._edit_again)]
        else:
            buttons += [("Tekrar dene", lambda: self._ask(ASK_DESCRIPTION if self._mode == "create" else ASK_CHANGE, retry))]
        buttons += [("Kütüphane", lambda: self.s.navigate("library"))]
        for text, command in buttons:
            self._action_widgets.append(self._small_button(text, x, 530, 150, command, tag="actions"))
            x += 160

    def _edit_again(self) -> None:
        self._mode = "edit"
        self._ask(ASK_CHANGE, self._on_change)
