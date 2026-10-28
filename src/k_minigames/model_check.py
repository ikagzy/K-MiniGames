"""Checks the model the advisor proposed: is it in the catalog, and does it fit this computer?

A small model can invent a model name or pick one that is too big, so the app never trusts the proposal as it is."""
from dataclasses import dataclass

from k_minigames import catalog
from k_minigames.catalog import ModelInfo

VRAM_HEADROOM = 1.2  # a card must hold the model plus some working memory


@dataclass(frozen=True)
class Recommendation:
    model: ModelInfo
    substituted: bool   # True when the app replaced the proposal
    fits: bool          # False only when even the smallest model is too big for this computer
    reason: str         # why the proposal was replaced ("" when it was kept)


def fits(model: ModelInfo, ram_gb: float, vram_gb: float | None) -> bool:
    return ram_gb >= model.min_ram_gb or (vram_gb is not None and vram_gb >= model.size_gb * VRAM_HEADROOM)


def _normalize(name: str | None) -> str:
    return (name or "").strip().strip("\"'`").strip().lower()


def recommend(proposed: str | None, ram_gb: float, vram_gb: float | None) -> Recommendation:
    coders = catalog.coders()
    key = _normalize(proposed)
    chosen = next((m for m in coders if m.id.lower() == key), None) if key else None
    if chosen and fits(chosen, ram_gb, vram_gb):
        return Recommendation(chosen, False, True, "")
    if chosen:
        reason = f"{chosen.id} bu bilgisayara sığmıyor"
    elif key:
        reason = f"{proposed.strip()} katalogda yok"
    else:
        reason = "danışman model önermedi"
    fitting = [m for m in coders if fits(m, ram_gb, vram_gb)]
    if fitting:
        return Recommendation(fitting[-1], True, True, reason)
    return Recommendation(coders[0], True, False, reason + "; bilgisayar zayıf, en küçük model denenebilir")
