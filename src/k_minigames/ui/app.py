"""The window: one stage, and the screen that is shown on it."""
import tkinter as tk
import os
from tkinter import filedialog, messagebox, simpledialog

from k_minigames import i18n, installer, library, settings
from k_minigames.ollama_client import OllamaClient
from k_minigames.startup import advisor_id, startup_state
from k_minigames.ui.advisor_screen import AdvisorScreen
from k_minigames.ui.library_screen import LibraryScreen
from k_minigames.ui.services import Services
from k_minigames.ui.settings_screen import SettingsScreen
from k_minigames.ui.setup_screen import SetupScreen
from k_minigames.ui.title_screen import TitleScreen
from k_minigames.ui.stage import Stage
from k_minigames.ui.studio_screen import StudioScreen
from k_minigames.ui.worker import Worker


def next_screen(client) -> str:
    """Start Ollama if it is installed but not running, then decide which screen comes first."""
    installer.ensure_running(client)
    state = startup_state(client, advisor_id(), settings.get("game_model"))
    folder = settings.games_dir()
    if folder is None:
        return "setup"
    if state == "library" and not library.list_games(folder):
        return "advisor"   # nothing to show yet: Don first, then Bob makes the first game
    return state


class App(tk.Tk):
    def __init__(self, first_screen: str | None = None):
        super().__init__()
        self.title("K-MiniGames")
        self.resizable(False, False)
        i18n.follow()
        self.stage = Stage(self)
        self.stage.pack()
        self.services = Services(
            root=self, stage=self.stage, client=OllamaClient(), worker=Worker(self.after), navigate=self.navigate,
            confirm=lambda title, message: messagebox.askyesno(title, message, parent=self),
            info=lambda title, message: messagebox.showinfo(title, message, parent=self),
            choose_folder=lambda: filedialog.askdirectory(parent=self, title=i18n.t("Oyun klasörü")),
            choose_files=lambda: list(filedialog.askopenfilenames(
                parent=self, title=i18n.t("Doku ekle"),
                filetypes=[("Images", "*.png *.jpg *.jpeg *.gif *.webp *.bmp")])),
            ask_text=lambda title, prompt: simpledialog.askstring(title, prompt, parent=self),
            open_path=lambda path: os.startfile(str(path)),
        )
        self._factories = {"title": TitleScreen, "settings": SettingsScreen, "setup": SetupScreen, "advisor": AdvisorScreen, "library": LibraryScreen,
                           "studio": StudioScreen}
        self._current = None
        self.after(100, lambda: self._begin(first_screen))

    def _begin(self, first_screen: str | None) -> None:
        self.navigate(first_screen or "title")

    def start(self) -> None:
        """"Başla" on the title screen: pick the first real screen."""
        self.services.worker.run(lambda: next_screen(self.services.client), self.navigate, self._failed)

    def _failed(self, error: Exception) -> None:
        self.services.info("K-MiniGames", str(error))
        self.navigate("setup")

    def navigate(self, name: str) -> None:
        if name == "start":
            return self.start()
        if self._current is not None:
            self._current.hide()
        self.stage.cancel_fade()
        self._current = self._factories[name](self.services)
        self._current.show()
        if name != "title":   # Don's and Bob's rooms come up slowly out of the black
            self.stage.fade_in(self.after)


def run(first_screen: str | None = None) -> None:
    App(first_screen).mainloop()
