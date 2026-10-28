"""The title screen: the name of the app, Don and Bob at the sides, and a small menu with a heart.

Up/Down and Enter work, and so does the mouse. "Başla" goes on to the first real screen (setup, advisor or library)."""
import tkinter as tk

from k_minigames import i18n
from k_minigames.ui import fonts
from k_minigames.ui.services import Services
from k_minigames.ui.stage import LABEL_COLOR, TEXT_COLOR, WIDTH

t = i18n.t

TITLE = "K-MiniGames"
ITEMS = (("Başla", "start"), ("Ayarlar", "settings"), ("Çıkış", "exit"))
MENU_Y, MENU_STEP = 330, 52
HEART_COLOR = "#ff2a2a"


class TitleScreen:
    def __init__(self, services: Services):
        self.s = services
        self.index = 0
        self._bound: list[tuple[str, str]] = []

    def show(self) -> None:
        stage = self.s.stage
        stage.clear()
        self.index = 0
        stage.create_text(WIDTH // 2, 100, text=TITLE, fill=TEXT_COLOR, font=fonts.font(stage, 72), tags="title")
        from k_minigames import __version__
        stage.create_text(WIDTH // 2, 160, text=f"v{__version__}", fill="#777777", font=fonts.font(stage, fonts.SMALL),
                          tags="title")
        for character, state, x in (("advisor", "greeting", 190), ("bear", "greeting", WIDTH - 190)):
            from k_minigames import mascot
            stage.create_image(x, 470, anchor="s", image=stage._picture(mascot.frame(character, state) + ".png"),
                               tags="title")
        for i, (label, _) in enumerate(ITEMS):
            y = MENU_Y + i * MENU_STEP
            item = stage.create_text(WIDTH // 2, y, text=t(label), fill=TEXT_COLOR,
                                     font=fonts.font(stage, fonts.MESSAGE + 4), tags=("title", f"item{i}"))
            stage.tag_bind(item, "<Button-1>", lambda event, i=i: self.choose(i))
            stage.tag_bind(item, "<Enter>", lambda event, i=i: self.move_to(i))
        stage.create_text(WIDTH // 2 - 110, MENU_Y, text="♥", fill=HEART_COLOR,
                          font=fonts.font(stage, fonts.MESSAGE + 4), tags=("title", "heart"))
        for key, command in (("<Up>", lambda e: self.move(-1)), ("<Down>", lambda e: self.move(1)),
                             ("<Return>", lambda e: self.choose(self.index))):
            self.s.root.bind(key, command)
            self._bound.append((key, key))
        stage.focus_set()
        self._place_heart()

    def hide(self) -> None:
        for key, _ in self._bound:
            self.s.root.unbind(key)
        self._bound = []
        self.s.stage.delete("title")

    def _place_heart(self) -> None:
        stage = self.s.stage
        y = MENU_Y + self.index * MENU_STEP
        stage.coords("heart", WIDTH // 2 - 110, y)
        for i in range(len(ITEMS)):
            stage.itemconfigure(f"item{i}", fill=LABEL_COLOR if i == self.index else TEXT_COLOR)

    def move(self, step: int) -> None:
        self.move_to((self.index + step) % len(ITEMS))

    def move_to(self, index: int) -> None:
        self.index = index
        self._place_heart()

    def choose(self, index: int) -> None:
        action = ITEMS[index][1]
        if action == "exit":
            self.s.root.destroy()
        else:
            self.s.navigate(action)
