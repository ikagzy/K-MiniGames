"""What every screen is given: the stage, Ollama, the background worker and the dialogs.

The dialogs are passed in (not called directly) so a test can answer them without any window popping up."""
import os
import tkinter as tk
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from k_minigames.ollama_client import OllamaClient
from k_minigames.ui.stage import Stage
from k_minigames.ui.worker import Worker


@dataclass
class Services:
    root: tk.Misc
    stage: Stage
    client: OllamaClient
    worker: Worker
    navigate: Callable[[str], None]
    confirm: Callable[[str, str], bool]      # (title, message) -> yes/no
    info: Callable[[str, str], None]         # (title, message)
    choose_folder: Callable[[], str]         # "" when the user cancels
    choose_files: Callable[[], list[str]] = lambda: []
    ask_text: Callable[[str, str], str | None] = lambda title, prompt: None     # None when cancelled
    open_path: Callable[[Path], None] = lambda path: os.startfile(str(path))
    session: dict = field(default_factory=dict)   # what the next screen needs, e.g. {"mode": "edit", "game": Game}
