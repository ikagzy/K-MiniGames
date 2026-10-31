"""The library: the games made so far, in the lobby. Play, edit, open the folder or start a new game."""
import tkinter as tk

from k_minigames import i18n, kgamelib, library, settings
from k_minigames.library import Game
from k_minigames.ui import fonts
from k_minigames.ui.services import Services
from k_minigames.ui.stage import BEAR_NAME, LABEL_COLOR, TEXT_COLOR, TEXT_X

t = i18n.t

INTRO = "Ben Bob! Oyunların burada, birini seç."
EMPTY = "Ben Bob! Henüz oyunun yok, ilkini yapalım!"
SPEAKER = BEAR_NAME
LIST_Y, BUTTON_X, BUTTON_W = 440, 660, 190


class LibraryScreen:
    def __init__(self, services: Services):
        self.s = services
        self.listbox: tk.Listbox | None = None
        self._games: list[Game] = []
        self._widgets: list[tk.Widget] = []

    def show(self) -> None:
        stage = self.s.stage
        stage.stop_asking()
        stage.set_scene("lobi")
        folder = settings.games_dir()
        self._games = library.list_games(folder) if folder else []
        stage.set_character("bear", "greeting" if not self._games else "idle")
        stage.say(SPEAKER, t(INTRO if self._games else EMPTY))
        self._build()

    def hide(self) -> None:
        self.s.stage.delete("library")
        for widget in self._widgets:
            widget.destroy()
        self._widgets = []

    def _place(self, widget: tk.Widget, x: int, y: int, width: int, height: int) -> None:
        self.s.stage.create_window(x, y, anchor="nw", window=widget, width=width, height=height, tags="library")
        self._widgets.append(widget)

    def _button(self, text: str, y: int, command) -> None:
        button = tk.Button(self.s.stage, text=t(text), command=command, relief="flat", bg="#333333", fg=TEXT_COLOR,
                           activebackground="#555555", activeforeground=TEXT_COLOR,
                           font=fonts.font(self.s.stage, fonts.BUTTON))
        self._place(button, BUTTON_X, y, BUTTON_W, 26)

    def _build(self) -> None:
        self.listbox = tk.Listbox(self.s.stage, bg="black", fg=TEXT_COLOR, selectbackground=LABEL_COLOR,
                                  selectforeground="black", relief="flat", highlightthickness=1,
                                  highlightbackground="#666666", font=fonts.font(self.s.stage, fonts.LIST), activestyle="none",
                                  exportselection=False)
        for game in self._games:
            self.listbox.insert("end", game.name)
        self.listbox.bind("<Double-Button-1>", lambda event: self.play())
        self._place(self.listbox, TEXT_X, LIST_Y, 470, 118)
        for text, y, command in (("Oyna", LIST_Y, self.play), ("Düzenle", LIST_Y + 31, self.edit),
                                 ("Klasörü aç", LIST_Y + 62, self.open_folder), ("Yeni oyun", LIST_Y + 93, self.new_game)):
            self._button(text, y, command)

    def selected(self) -> Game | None:
        chosen = self.listbox.curselection() if self.listbox else ()
        return self._games[chosen[0]] if chosen else None

    def play(self) -> None:
        game = self.selected()
        if game is not None:
            try:   # a game keeps its own copy of the library files: playing it uses the newest ones
                kgamelib.install(game, library.modules(game))
            except OSError:
                pass   # a locked or missing file: the game still opens with what it has
            self.s.open_path(game.launcher_path)

    def open_folder(self) -> None:
        game = self.selected()
        if game is not None:
            self.s.open_path(game.folder)

    def edit(self) -> None:
        game = self.selected()
        if game is not None:
            self.s.session = {"mode": "edit", "game": game}
            self.s.navigate("studio")

    def new_game(self) -> None:
        self.s.navigate("advisor")   # a new game starts with Don; he hands over to Bob (see AdvisorScreen._finish)
