"""The short, hand-made list of models the app knows (src/k_minigames/data/models.json).

Sizes are approximate and shown to the user as "yaklaşık"."""
import json
from dataclasses import dataclass
from pathlib import Path

_FILE = Path(__file__).with_name("data") / "models.json"


@dataclass(frozen=True)
class ModelInfo:
    id: str
    size_gb: float
    min_ram_gb: float


def _load() -> dict:
    return json.loads(_FILE.read_text(encoding="utf-8"))


def _info(item: dict) -> ModelInfo:
    return ModelInfo(item["id"], float(item["size_gb"]), float(item["min_ram_gb"]))


def advisor() -> ModelInfo:
    return _info(_load()["advisor"])


def coders() -> list[ModelInfo]:
    """Game-writing models, smallest first."""
    return sorted((_info(i) for i in _load()["coders"]), key=lambda m: m.size_gb)
