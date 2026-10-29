"""The stage every screen is drawn on: a 1024x572 scene, one character, and the dialogue box at the bottom.

Pictures are loaded from assets/runtime (prepared by tools/prepare_assets.py, so no resizing happens here).
The dialogue box shows who is speaking (DON, the advisor; BOB, the bellhop bear; or SEN, the user) above the
message; only one side speaks at a time."""
import base64
import tkinter as tk
from tkinter import font as tkfont
from collections.abc import Callable
from pathlib import Path

from k_minigames import i18n, mascot
from k_minigames.ui import fonts

RUNTIME = Path(__file__).resolve().parent.parent / "assets" / "runtime"
_SCENES = {"danisman": "danisman_sahne.png", "lobi": "lobi.png"}

WIDTH, HEIGHT = 1024, 572
ADVISOR_NAME, BEAR_NAME, USER_NAME = "DON", "BOB", "SEN"   # the labels above the messages
ADVISOR_ANCHOR = (529, 297)   # bottom centre of the advisor, sitting behind the desk
BEAR_ANCHOR = (512, 352)      # where the bear's feet stand on the lobby floor
FOOT_PAD = 4                  # transparent margin under the feet in the prepared pictures
DIALOG_ORIGIN = (145, 360)   # 733x212 box, bottom centre of the stage
TEXT_X = 170
LABEL_Y, MESSAGE_Y, INPUT_Y = 380, 410, 520
MESSAGE_WIDTH = 680
PAGER_RIGHT = TEXT_X + 430    # the page arrows sit left of the studio's top-right buttons (x 640 and on)
MESSAGE_BOTTOM = 512         # the message ends above the text box (INPUT_Y)
FADE_STIPPLES = ("", "gray75", "gray50", "gray25", "gray12")   # black, then thinner and thinner
FADE_MS = 240
MESSAGE_SIZES = (fonts.MESSAGE, 20)   # a long message first gets a smaller type, then pages (click ◀ ▶ or the wheel)
LABEL_COLOR, TEXT_COLOR = "#ffcc66", "#f2f2f2"


class Stage(tk.Canvas):
    def __init__(self, master):
        super().__init__(master, width=WIDTH, height=HEIGHT, highlightthickness=0, bd=0, bg="black")
        self._pictures: dict[str, tk.PhotoImage] = {}
        self._on_submit: Callable[[str], None] | None = None
        self.entry: tk.Entry | None = None
        self._send_button: tk.Button | None = None
        self._dialog_drawn = False
        self._frame = ""   # the picture of the character that is shown now
        self._fade_job = None
        self._fade_hidden: list[int] = []
        self._pages: list[str] = []
        self._page = 0
        self.bind("<MouseWheel>", lambda event: self.turn_page(-1 if event.delta > 0 else 1))

    def _picture(self, relative: str) -> tk.PhotoImage:
        if relative not in self._pictures:
            # read here and hand Tk the data: Tk's own file opening fails now and then on folder names with Turkish letters
            data = base64.b64encode((RUNTIME / relative).read_bytes())
            self._pictures[relative] = tk.PhotoImage(master=self, data=data)
        return self._pictures[relative]

    def _layer(self) -> None:
        """scene at the bottom, then the character, then the dialogue box and its widgets."""
        for tag in ("dialog", "dialogtext", "input", "fade"):
            self.tag_raise(tag)
        if self.find_withtag("dialog"):
            self.tag_lower("character", "dialog")
        self.tag_lower("scene")

    def fade_in(self, after) -> None:
        """Come up slowly from black: a black sheet over everything gets thinner (a stipple, since Tk has no
        transparency). The widgets inside the stage stay hidden until it is gone."""
        self.cancel_fade()
        self.create_rectangle(0, 0, WIDTH, HEIGHT, fill="black", outline="", tags="fade")
        self._fade_step(after, 0)

    def _fade_step(self, after, step: int) -> None:
        for item in self.find_all():   # widgets that a screen added meanwhile stay hidden too
            if self.type(item) == "window" and self.itemcget(item, "state") != "hidden":
                self.itemconfigure(item, state="hidden")
                self._fade_hidden.append(item)
        if step >= len(FADE_STIPPLES):
            self.cancel_fade()
            return
        self.itemconfigure("fade", stipple=FADE_STIPPLES[step])
        self.tag_raise("fade")
        self._fade_job = after(FADE_MS, lambda: self._fade_step(after, step + 1))

    def cancel_fade(self) -> None:
        """Stop a fade-in that is running and show everything at once."""
        if self._fade_job is not None:
            try:
                self.after_cancel(self._fade_job)
            except tk.TclError:
                pass
            self._fade_job = None
        self.delete("fade")
        for item in self._fade_hidden:
            try:
                self.itemconfigure(item, state="normal")
            except tk.TclError:
                pass   # the widget was destroyed meanwhile
        self._fade_hidden = []

    def clear(self) -> None:
        """Wipe everything (a plain black stage, for the title screen)."""
        self.cancel_fade()
        self.stop_asking()
        self.delete("all")
        self._dialog_drawn = False
        self._frame = ""

    def set_scene(self, name: str) -> None:
        self.delete("scene")
        self.create_image(0, 0, anchor="nw", image=self._picture(_SCENES[name]), tags="scene")
        self._layer()

    def set_character(self, character: str, state: str, tick: int = 0) -> None:
        frame = mascot.frame(character, state, tick)
        if frame == self._frame and self.find_withtag("character"):
            return   # the same picture again: drawing it anew only makes it flicker
        x, y = ADVISOR_ANCHOR if character == "advisor" else BEAR_ANCHOR
        self.delete("character")
        self.create_image(x, y + FOOT_PAD, anchor="s", tags="character", image=self._picture(frame + ".png"))
        self._frame = frame
        self._layer()

    def say(self, speaker: str, text: str, follow: bool = False) -> None:
        if not self._dialog_drawn:
            self.create_image(*DIALOG_ORIGIN, anchor="nw", image=self._picture("diyalog.png"), tags="dialog")
            self._dialog_drawn = True
        self.delete("dialogtext")
        self.create_text(TEXT_X, LABEL_Y, anchor="nw", text=i18n.t(speaker), fill=LABEL_COLOR,
                         font=fonts.font(self, fonts.LABEL), tags="dialogtext")
        self._pages, self._page, self._size = [text], 0, MESSAGE_SIZES[0]
        for size in MESSAGE_SIZES:   # a long message first gets a smaller type
            self._size = size
            self._draw_message(text)
            if self.bbox("message")[3] <= MESSAGE_BOTTOM:
                break
        else:                        # still too long: pages, the last one while the text is still being typed
            self._pages = self._paginate(text, self._size)
            self._page = len(self._pages) - 1 if follow else 0
            self._show_page()
        self._layer()

    def _draw_message(self, text: str) -> None:
        self.delete("message")
        self.create_text(TEXT_X, MESSAGE_Y, anchor="nw", text=text, fill=TEXT_COLOR, width=MESSAGE_WIDTH,
                         font=fonts.font(self, self._size), tags=("dialogtext", "message"))

    def _paginate(self, text: str, size: int) -> list[str]:
        font = tkfont.Font(self, font=fonts.font(self, size))
        lines: list[str] = []
        for paragraph in text.split("\n"):
            line = ""
            for word in paragraph.split(" "):
                trial = f"{line} {word}" if line else word
                if line and font.measure(trial) > MESSAGE_WIDTH:
                    lines.append(line)
                    line = word
                else:
                    line = trial
            lines.append(line)
        per_page = max(1, (MESSAGE_BOTTOM - MESSAGE_Y) // font.metrics("linespace"))
        return ["\n".join(lines[i:i + per_page]) for i in range(0, len(lines), per_page)]

    def _show_page(self) -> None:
        self._draw_message(self._pages[self._page])
        self.delete("pager")
        if len(self._pages) > 1:
            font, right, y = fonts.font(self, fonts.BUTTON), PAGER_RIGHT, LABEL_Y + 4
            prev = self.create_text(right - 100, y, anchor="ne", text="◀", fill=LABEL_COLOR, font=font,
                                    tags=("dialogtext", "pager"))
            self.create_text(right - 50, y, anchor="n", text=f"{self._page + 1}/{len(self._pages)}", fill=TEXT_COLOR,
                             font=font, tags=("dialogtext", "pager"))
            nxt = self.create_text(right, y, anchor="ne", text="▶", fill=LABEL_COLOR, font=font,
                                   tags=("dialogtext", "pager"))
            self.tag_bind(prev, "<Button-1>", lambda event: self.turn_page(-1))
            self.tag_bind(nxt, "<Button-1>", lambda event: self.turn_page(1))
        self._layer()

    def turn_page(self, step: int) -> None:
        """Show the previous (-1) or next (1) page of a message that is too long for the box."""
        if len(self._pages) > 1:
            self._page = max(0, min(len(self._pages) - 1, self._page + step))
            self._show_page()

    def ask(self, on_submit: Callable[[str], None]) -> None:
        """Show a text box inside the dialogue box; Enter or the button sends the text to `on_submit`."""
        self.stop_asking()
        self._on_submit = on_submit
        self.entry = tk.Entry(self, bg="black", fg=TEXT_COLOR, insertbackground=TEXT_COLOR, relief="flat",
                              font=fonts.font(self, fonts.INPUT), highlightthickness=1, highlightbackground="#666666",
                              highlightcolor=LABEL_COLOR)
        self._send_button = tk.Button(self, text=i18n.t("Gönder"), command=self.submit, relief="flat",
                                      bg="#333333", fg=TEXT_COLOR, activebackground="#555555",
                                      activeforeground=TEXT_COLOR, font=fonts.font(self, fonts.BUTTON))
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
