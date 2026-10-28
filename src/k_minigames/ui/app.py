"""The window: one stage, and the screen that is shown on it."""
import tkinter as tk
from tkinter import filedialog, messagebox

from k_minigames import catalog, i18n, installer, settings
from k_minigames.ollama_client import OllamaClient
from k_minigames.startup import startup_state
from k_minigames.ui.services import Services
from k_minigames.ui.setup_screen import SetupScreen
from k_minigames.ui.stage import Stage
from k_minigames.ui.worker import Worker


def advisor_id() -> str:
    """The advisor model the user chose, else the catalog's."""
    return settings.get("advisor_model") or catalog.advisor().id


def next_screen(client) -> str:
    """Start Ollama if it is installed but not running, then decide which screen comes first."""
    installer.ensure_running(client)
    state = startup_state(client, advisor_id(), settings.get("game_model"))
    return "setup" if settings.games_dir() is None else state


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
        )
        self._factories = {"setup": SetupScreen}
        self._current = None
        self.after(100, lambda: self._begin(first_screen))

    def _begin(self, first_screen: str | None) -> None:
        if first_screen:
            self.navigate(first_screen)
        else:
            self.services.worker.run(lambda: next_screen(self.services.client), self.navigate, self._failed)

    def _failed(self, error: Exception) -> None:
        self.services.info("K-MiniGames", str(error))
        self.navigate("setup")

    def navigate(self, name: str) -> None:
        if self._current is not None:
            self._current.hide()
        self._current = self._factories[name](self.services)
        self._current.show()


def run(first_screen: str | None = None) -> None:
    App(first_screen).mainloop()
