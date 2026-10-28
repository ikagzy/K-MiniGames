"""The title screen: the name of the app, Don and Bob at the sides, and a small menu with a heart.

Up/Down and Enter work, and so does the mouse. "Başla" goes on to the first real screen (setup, advisor or library);
it only appears once Ollama runs and the advisor model is installed, so until then the menu is Settings and Quit."""
from k_minigames import i18n, installer, mascot
from k_minigames.startup import advisor_id
from k_minigames.ui import fonts
from k_minigames.ui.services import Services
from k_minigames.ui.stage import LABEL_COLOR, TEXT_COLOR, WIDTH

t = i18n.t

TITLE = "K-MiniGames"
START = ("Başla", "start")
ITEMS = (("Ayarlar", "settings"), ("Çıkış", "exit"))   # what is always there
MENU_Y, MENU_STEP = 330, 52
HEART_COLOR = "#ff2a2a"


def ready_to_play(client) -> bool:
    """Ollama is installed and running (it is started if it was only closed) and the advisor model is there."""
    if not installer.ensure_running(client):
        return False
    try:
        return advisor_id() in client.models()
    except Exception:
        return False


class TitleScreen:
    def __init__(self, services: Services):
        self.s = services
        self.items = list(ITEMS)
        self.index = 0
        self._bound: list[str] = []
        self._hidden = False

    def show(self) -> None:
        stage = self.s.stage
        stage.clear()
        self._hidden = False
        stage.create_text(WIDTH // 2, 100, text=TITLE, fill=TEXT_COLOR, font=fonts.font(stage, 72), tags="title")
        from k_minigames import __version__
        stage.create_text(WIDTH // 2, 160, text=f"v{__version__}", fill="#777777", font=fonts.font(stage, fonts.SMALL),
                          tags="title")
        for character, x in (("advisor", 190), ("bear", WIDTH - 190)):
            stage.create_image(x, 470, anchor="s", image=stage._picture(mascot.frame(character, "greeting") + ".png"),
                               tags="title")
        for key, command in (("<Up>", lambda e: self.move(-1)), ("<Down>", lambda e: self.move(1)),
                             ("<Return>", lambda e: self.choose(self.index))):
            self.s.root.bind(key, command)
            self._bound.append(key)
        stage.focus_set()
        self._draw_menu()
        self.s.worker.run(lambda: ready_to_play(self.s.client), self._probed, lambda error: None)

    def hide(self) -> None:
        self._hidden = True
        for key in self._bound:
            self.s.root.unbind(key)
        self._bound = []
        self.s.stage.delete("title")

    def _probed(self, ready: bool) -> None:
        if self._hidden or (START in self.items) == bool(ready):
            return
        self.items = ([START] if ready else []) + list(ITEMS)
        self.index = 0
        self._draw_menu()

    def _draw_menu(self) -> None:
        stage = self.s.stage
        stage.delete("menu")
        for i, (label, _) in enumerate(self.items):
            item = stage.create_text(WIDTH // 2, MENU_Y + i * MENU_STEP, text=t(label), fill=TEXT_COLOR,
                                     font=fonts.font(stage, fonts.MESSAGE + 4), tags=("title", "menu", f"item{i}"))
            stage.tag_bind(item, "<Button-1>", lambda event, i=i: self.choose(i))
            stage.tag_bind(item, "<Enter>", lambda event, i=i: self.move_to(i))
        stage.create_text(WIDTH // 2 - 110, MENU_Y, text="♥", fill=HEART_COLOR,
                          font=fonts.font(stage, fonts.MESSAGE + 4), tags=("title", "menu", "heart"))
        self._place_heart()

    def _place_heart(self) -> None:
        stage = self.s.stage
        stage.coords("heart", WIDTH // 2 - 110, MENU_Y + self.index * MENU_STEP)
        for i in range(len(self.items)):
            stage.itemconfigure(f"item{i}", fill=LABEL_COLOR if i == self.index else TEXT_COLOR)

    def move(self, step: int) -> None:
        self.move_to((self.index + step) % len(self.items))

    def move_to(self, index: int) -> None:
        self.index = index
        self._place_heart()

    def choose(self, index: int) -> None:
        action = self.items[index][1]
        if action == "exit":
            self.s.root.destroy()
        else:
            self.s.navigate(action)
