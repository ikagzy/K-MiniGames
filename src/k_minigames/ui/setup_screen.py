"""First screen: get Ollama and an advisor model ready, and choose the games folder.

Nothing is downloaded without a click and a yes. If an installed model is enough for the advisor's job it is offered
first (see startup.build_offers); two noes cancel."""
import tkinter as tk
from pathlib import Path
from tkinter import ttk

from k_minigames import catalog, hardware, i18n, installer, library, model_check, settings
from k_minigames.ollama_client import InstalledModel
from k_minigames.startup import CANCEL_MESSAGE, Offer, build_offers, first_accepted, setup_buttons, SetupButtons
from k_minigames.ui import fonts
from k_minigames.ui.services import Services
from k_minigames.ui.stage import ADVISOR_NAME, LABEL_COLOR, TEXT_COLOR, TEXT_X

t = i18n.t

INTRO = "Merhaba! Önce Ollama ve bir danışman model lazım."
BUTTON_Y, PROGRESS_Y, STATUS_Y, FOLDER_Y = 448, 484, 500, 532
_MEASURE = object()
_INSTALL_RESULT = {
    "download_failed": "İndirme olmadı. İnternet bağlantını kontrol edip tekrar dene.",
    "setup_failed": "Kurulum dosyası başlatılamadı.",
    "not_running": "Ollama kuruldu ama çalışmadı. Birazdan 'Ollama'yı başlat' düğmesini dene.",
}


class SetupScreen:
    def __init__(self, services: Services):
        self.s = services
        self.ollama_button = self.advisor_button = self.folder_button = None
        self.continue_button = self.cancel_button = self.bar = None
        self._widgets: list[tk.Widget] = []
        self._busy = False
        self._hidden = False
        self._cancel = None
        self._progress: tuple[int, int | None] = (0, None)
        self._last: dict = {"models": [], "buttons": SetupButtons("download", "disabled")}

    # --- life cycle ---------------------------------------------------------------------------

    def show(self) -> None:
        stage = self.s.stage
        stage.stop_asking()
        stage.set_scene("danisman")
        stage.set_character("advisor", "greeting")
        stage.say(ADVISOR_NAME, t(INTRO))
        self._hidden = False
        self._build()
        self.refresh()

    def hide(self) -> None:
        self._hidden = True
        self.s.stage.delete("setup")
        for widget in self._widgets:
            widget.destroy()
        self._widgets = []

    def _button(self, x: int, y: int, width: int, command) -> tk.Button:
        button = tk.Button(self.s.stage, relief="flat", bg="#333333", fg=TEXT_COLOR, activebackground="#555555",
                           activeforeground=TEXT_COLOR, disabledforeground="#777777", command=command,
                           font=fonts.font(self.s.stage, fonts.BUTTON))
        self.s.stage.create_window(x, y, anchor="nw", window=button, width=width, height=26, tags="setup")
        self._widgets.append(button)
        return button

    def _build(self) -> None:
        stage = self.s.stage
        self.ollama_button = self._button(TEXT_X, BUTTON_Y, 330, self._on_ollama)
        self.advisor_button = self._button(TEXT_X + 345, BUTTON_Y, 330, self._on_advisor)
        style = ttk.Style(stage)
        style.theme_use("clam")
        style.configure("Kmg.Horizontal.TProgressbar", troughcolor="#222222", background=LABEL_COLOR,
                        bordercolor="#222222", lightcolor=LABEL_COLOR, darkcolor=LABEL_COLOR)
        self.bar = ttk.Progressbar(stage, maximum=100, style="Kmg.Horizontal.TProgressbar")
        stage.create_window(TEXT_X, PROGRESS_Y, anchor="nw", window=self.bar, width=520, height=14, tags="setup")
        self._widgets.append(self.bar)
        self.cancel_button = self._button(TEXT_X + 535, PROGRESS_Y - 6, 140, self._on_cancel)
        self.cancel_button.configure(text=t("İptal"), state="disabled")
        stage.create_text(TEXT_X, STATUS_Y, anchor="nw", text="", fill=LABEL_COLOR, font=fonts.font(stage, fonts.BUTTON),
                          tags=("setup", "status"))
        stage.create_text(TEXT_X, FOLDER_Y + 5, anchor="nw", text="", fill=TEXT_COLOR, font=fonts.font(stage, fonts.BUTTON),
                          tags=("setup", "folder"))
        self.folder_button = self._button(TEXT_X + 440, FOLDER_Y, 120, self._on_folder)
        self.folder_button.configure(text=t("Klasör seç"))
        self.continue_button = self._button(TEXT_X + 575, FOLDER_Y, 100, self._on_continue)
        self.continue_button.configure(text=t("Devam →"), state="disabled")
        self._show_folder()

    # --- what is shown --------------------------------------------------------------------------

    def _status(self, text: str) -> None:
        self.s.stage.itemconfigure("status", text=text)

    def _show_folder(self) -> None:
        folder = settings.games_dir()
        shown = str(folder) if folder else t("seçilmedi")
        if len(shown) > 40:
            shown = "…" + shown[-39:]
        self.s.stage.itemconfigure("folder", text=f"{t('Oyun klasörü')}: {shown}")

    def apply_buttons(self, buttons: SetupButtons, ollama_size: str | None, advisor_gb: float,
                      has_alternative: bool) -> None:
        ollama = {
            "download": (f"Ollama'yı indir (yaklaşık {ollama_size})" if ollama_size else "Ollama'yı indir", "normal"),
            "start": ("Ollama'yı başlat", "normal"),
            "done": ("Ollama hazır ✓", "disabled"),
        }[buttons.ollama]
        advisor = {
            "disabled": ("Danışmanı indir", "disabled"),
            "download": ("Danışman modelini seç" if has_alternative
                         else f"Danışmanı indir (yaklaşık {advisor_gb:.1f} GB)", "normal"),
            "done": ("Danışman hazır ✓", "disabled"),
        }[buttons.advisor]
        self._last["buttons"] = buttons
        for button, (text, state) in ((self.ollama_button, ollama), (self.advisor_button, advisor)):
            button.configure(text=t(text), state="disabled" if self._busy else state)

    def apply_ready(self, ready: bool) -> None:
        self.continue_button.configure(state="normal" if ready and not self._busy else "disabled")

    # --- finding out where things stand ------------------------------------------------------------

    def refresh(self) -> None:
        self.s.worker.run(self._probe, self._apply_probe, self._probe_failed)

    def _probe(self) -> dict:
        client = self.s.client
        installed = installer.ollama_exe() is not None
        running = client.is_running()
        models = client.installed() if running else []
        wanted = settings.get("advisor_model") or catalog.advisor().id
        size = installer.download_size() if not installed and not running else None
        has_alternative = bool(model_check.installed_alternative(   # nvidia-smi can take seconds: here, not in the UI
            catalog.advisor(), models, hardware.ram_gb(), hardware.vram_gb()))
        return {"installed": installed, "running": running, "models": models, "has_alternative": has_alternative,
                "advisor_installed": wanted in [m.name for m in models], "ollama_size": size}

    def _apply_probe(self, probe: dict) -> None:
        if self._hidden:
            return   # the screen was left while the probe was running
        self._last.update(probe)
        needed = catalog.advisor()
        has_alternative = probe["has_alternative"]
        buttons = setup_buttons(probe["installed"], probe["running"], probe["advisor_installed"])
        size = f"{probe['ollama_size'] / 1024 ** 3:.1f} GB" if probe["ollama_size"] else None
        self.apply_buttons(buttons, size, needed.size_gb, has_alternative)
        self.apply_ready(buttons == SetupButtons("done", "done") and settings.games_dir() is not None)
        self._show_folder()

    def _probe_failed(self, error: Exception) -> None:
        if self._hidden:
            return
        self._status(f"{t('Durum okunamadı')}: {error}")

    # --- asking -----------------------------------------------------------------------------------

    def advisor_choice(self, installed: list[InstalledModel], ram_gb=_MEASURE, vram_gb=_MEASURE) -> Offer | None:
        """Ask in order: use an installed model that is enough, else download the advisor, else cancel."""
        needed = catalog.advisor()
        ram = hardware.ram_gb() if ram_gb is _MEASURE else ram_gb
        vram = hardware.vram_gb() if vram_gb is _MEASURE else vram_gb
        offers = build_offers(model_check.installed_alternative(needed, installed, ram, vram), needed)

        def ask(offer: Offer) -> bool:
            if offer.kind == "use_installed":
                return self.s.confirm(t("Kurulu model bulundu"), t(
                    f"Bilgisayarında {offer.model} modeli zaten kurulu (yaklaşık {offer.size_gb:.1f} GB) ve bu iş için "
                    "yeterli.\n\nBunu danışman olarak kullanayım mı?"))
            return self.s.confirm(t("Danışman modeli indirilsin mi?"), t(
                f"{offer.model} modeli Ollama üzerinden indirilecek (yaklaşık {offer.size_gb:.1f} GB).\n\nİndirilsin mi?"))

        chosen = first_accepted(offers, ask)
        if chosen is None:
            self.s.info(t("İptal edildi"), t(CANCEL_MESSAGE))
        return chosen

    # --- buttons ------------------------------------------------------------------------------------

    def _run_task(self, work, on_done) -> None:
        from k_minigames.ui.worker import CancelToken
        self._busy, self._cancel, self._progress = True, CancelToken(), (0, None)
        for button in (self.ollama_button, self.advisor_button, self.folder_button, self.continue_button):
            button.configure(state="disabled")
        self.cancel_button.configure(state="normal")
        self._tick()

        def finished(result):
            self._busy = False
            self.cancel_button.configure(state="disabled")
            self.bar["value"] = 0
            self.folder_button.configure(state="normal")
            on_done(result)

        self.s.worker.run(lambda: work(self._cancel), finished, lambda error: finished(error))

    def _tick(self) -> None:
        if not self._busy:
            return
        done, total = self._progress
        if total:
            self.bar["value"] = min(100, done * 100 / total)
            self._status(f"{t('İndiriliyor…')} %{done * 100 // total}")
        self.s.root.after(150, self._tick)

    def _on_cancel(self) -> None:
        if self._cancel is not None:
            self._cancel.cancel()
            self._status(t("İptal ediliyor…"))

    def _on_ollama(self) -> None:
        if self._busy:
            return
        client = self.s.client
        if self._last["buttons"].ollama == "start":
            self._status(t("Ollama başlatılıyor…"))
            self._run_task(lambda cancel: installer.ensure_running(client),
                           lambda ok: (self._status("" if ok is True else t("Ollama başlatılamadı.")), self.refresh()))
            return
        size = self._last.get("ollama_size")
        shown = f"{size / 1024 ** 3:.1f} GB" if size else t("bilinmiyor")
        if not self.s.confirm(t("Ollama indirilsin mi?"), t(
                f"Ollama'nın kurulum dosyası şu adresten indirilecek:\n{installer.OLLAMA_URL}\nBoyut: {shown}\n\n"
                "İndirilsin ve kurulsun mu?")):
            return

        def done(result):
            self._status(t(_INSTALL_RESULT.get(result, "")) if result != "ok" else "")
            self.refresh()

        self._run_task(lambda cancel: installer.install_ollama(
            client, lambda d, total: setattr(self, "_progress", (d, total)), cancel), done)

    def _on_advisor(self) -> None:
        if self._busy:
            return
        choice = self.advisor_choice(self._last["models"])
        if choice is None:
            return
        if choice.kind == "use_installed":
            settings.put("advisor_model", choice.model)
            self.refresh()
            return
        client = self.s.client

        def pull(cancel):
            return client.pull(choice.model, lambda status, d, total: setattr(self, "_progress", (d, total)), cancel)

        def done(ok):
            if ok is True:
                settings.put("advisor_model", choice.model)
                self._status("")
            else:
                self._status(t("Model indirilemedi ya da iptal edildi."))
            self.refresh()

        self._run_task(pull, done)

    def _on_folder(self) -> None:
        chosen = self.s.choose_folder()
        if not chosen:
            return
        if not library.can_write(Path(chosen)):
            self.s.info(t("Klasör kullanılamıyor"), t("Bu klasöre yazılamıyor ya da diskte yeterli yer yok."))
            return
        settings.set_games_dir(Path(chosen))
        self._show_folder()
        self.refresh()

    def _on_continue(self) -> None:
        from k_minigames.ui.app import next_screen
        self.s.worker.run(lambda: next_screen(self.s.client), self.s.navigate, self._probe_failed)
