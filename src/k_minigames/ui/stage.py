"""The stage every screen is drawn on: a 1024x572 scene, one character, and the dialogue box at the bottom.

Pictures are loaded from assets/runtime (prepared by tools/prepare_assets.py, so no resizing happens here).
The dialogue box shows who is speaking (DANIŞMAN or SEN) above the message; only one side speaks at a time."""
import base64
import tkinter as tk
from collections.abc import Callable
from pathlib import Path

from k_minigames import i18n, mascot

RUNTIME = Path(__file__).resolve().parent.parent / "assets" / "runtime"
_SCENES = {"danisman": "danisman_sahne.png", "lobi": "lobi.png"}

WIDTH, HEIGHT = 1024, 572
ADVISOR_ANCHOR = (512, 322)   # bottom centre of the advisor, sitting behind the desk
BEAR_ANCHOR = (512, 352)      # where the bear's feet stand on the lobby floor
FOOT_PAD = 4                  # transparent margin under the feet in the prepared pictures
DIALOG_ORIGIN = (145, 360)   # 733x212 box, bottom centre of the stage
TEXT_X = 170
LABEL_Y, MESSAGE_Y, INPUT_Y = 380, 410, 520
MESSAGE_WIDTH = 680
LABEL_COLOR, TEXT_COLOR = "#ffcc66", "#f2f2f2"


class Stage(tk.Canvas):
    def __init__(self, master):
        super().__init__(master, width=WIDTH, height=HEIGHT, highlightthickness=0, bd=0, bg="black")
        self._pictures: dict[str, tk.PhotoImage] = {}
        self._on_submit: Callable[[str], None] | None = None
        self.entry: tk.Entry | None = None
        self._send_button: tk.Button | None = None
        self._dialog_drawn = False

    def _picture(self, relative: str) -> tk.PhotoImage:
        if relative not in self._pictures:
            # read here and hand Tk the data: Tk's own file opening fails now and then on folder names with Turkish letters
            data = base64.b64encode((RUNTIME / relative).read_bytes())
            self._pictures[relative] = tk.PhotoImage(master=self, data=data)
        return self._pictures[relative]

    def _layer(self) -> None:
        """scene at the bottom, then the character, then the dialogue box and its widgets."""
        for tag in ("dialog", "dialogtext", "input"):
            self.tag_raise(tag)
        if self.find_withtag("dialog"):
            self.tag_lower("character", "dialog")
        self.tag_lower("scene")

    def set_scene(self, name: str) -> None:
        self.delete("scene")
        self.create_image(0, 0, anchor="nw", image=self._picture(_SCENES[name]), tags="scene")
        self._layer()

    def set_character(self, character: str, state: str, tick: int = 0) -> None:
        x, y = ADVISOR_ANCHOR if character == "advisor" else BEAR_ANCHOR
        self.delete("character")
        self.create_image(x, y + FOOT_PAD, anchor="s", tags="character",
                          image=self._picture(mascot.frame(character, state, tick) + ".png"))
        self._layer()

    def say(self, speaker: str, text: str) -> None:
        if not self._dialog_drawn:
            self.create_image(*DIALOG_ORIGIN, anchor="nw", image=self._picture("diyalog.png"), tags="dialog")
            self._dialog_drawn = True
        self.delete("dialogtext")
        self.create_text(TEXT_X, LABEL_Y, anchor="nw", text=i18n.t(speaker), fill=LABEL_COLOR,
                         font=("Segoe UI", 12, "bold"), tags="dialogtext")
        self.create_text(TEXT_X, MESSAGE_Y, anchor="nw", text=text, fill=TEXT_COLOR, width=MESSAGE_WIDTH,
                         font=("Segoe UI", 13), tags="dialogtext")
        self._layer()

    def ask(self, on_submit: Callable[[str], None]) -> None:
        """Show a text box inside the dialogue box; Enter or the button sends the text to `on_submit`."""
        self.stop_asking()
        self._on_submit = on_submit
        self.entry = tk.Entry(self, bg="black", fg=TEXT_COLOR, insertbackground=TEXT_COLOR, relief="flat",
                              font=("Segoe UI", 13), highlightthickness=1, highlightbackground="#666666",
                              highlightcolor=LABEL_COLOR)
        self._send_button = tk.Button(self, text=i18n.t("Gönder"), command=self.submit, relief="flat",
                                      bg="#333333", fg=TEXT_COLOR, activebackground="#555555",
                                      activeforeground=TEXT_COLOR)
        self.create_window(TEXT_X, INPUT_Y, anchor="nw", window=self.entry, width=590, height=30, tags="input")
        self.create_window(TEXT_X + 600, INPUT_Y, anchor="nw", window=self._send_button, width=80, height=30,
                           tags="input")
        self.entry.bind("<Return>", lambda event: self.submit())
        self.entry.focus_set()
        self._layer()

    def submit(self) -> None:
        if self.entry is None or self._on_submit is None:
            return
        text = self.entry.get().strip()
        if not text:
            return
        self.entry.delete(0, "end")
        self._on_submit(text)

    def stop_asking(self) -> None:
        self.delete("input")
        for widget in (self.entry, self._send_button):
            if widget is not None:
                widget.destroy()
        self.entry = self._send_button = self._on_submit = None
