"""Game kits: the model writes a small SPEC (JSON) and the app turns it into the game page, so the model never writes the
game's code. A kit is a library module with a schema (`<kit>.schema.json`); what the kit needs lives in the library
(`kgame.<kit>.js`), and its checks below are tests written by hand, so they do not depend on what a model can write."""
import json
import random
import re

from k_minigames import kgamelib


class SpecError(Exception):
    """The model's answer holds no usable spec."""


# What a finished game of the kit must satisfy: (checklist text, test code). `game` is what the page exposes (K.expose).
_CHECKS = {
    "platformer": [
        ("Oyun açılır ve kahraman sahnededir.", "return !!game.me && Number.isFinite(game.me.x) && game.g.current === 'play';"),
        ("Seviyede bir başlangıç ve bir bayrak vardır.", "return !!game.level.start && !!game.level.goal;"),
        ("Kahraman zemine basar ve yerçekimiyle düşmez.",
         "await new Promise(r => setTimeout(r, 700)); return game.me.onFloor === true;"),
        ("Seviyede altın ya da düşman bulunur.", "return game.g.all('coin').length + game.g.all('enemy').length > 0;"),
        ("Kahraman sağa yürüyebilir.",
         "const x = game.me.x; K.press('d'); await new Promise(r => setTimeout(r, 500)); K.press('d', false); return game.me.x > x + 20;"),
    ],
}

_SYSTEM = (
    "Sen bir oyun tasarımcısısın. Kullanıcının tarif ettiği oyun için KOD YAZMA; yalnızca oyunun ÖZETİNİ (tek bir JSON "
    "nesnesi) ver. Uygulama bu özeti hazır kit ile oyuna çevirir. Özetteki seçenekleri aşağıdaki kılavuzdan seç; olmayan "
    "alan ya da değer uydurma. Seviyeyi (levels) satır listesi olarak, kılavuzdaki harflerle çiz; seviye bitirilebilir olsun "
    "(P ve F olmalı, boşluklar en fazla 3 karo).\n\n"
)


def checks(kit: str) -> list[tuple[str, str]]:
    return list(_CHECKS.get(kit, []))


def schema(kit: str) -> dict | None:
    """The JSON schema of the kit's spec (it keeps the model's answer in shape), or None when there is none."""
    path = kgamelib.LIB_DIR / f"{kit}.schema.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def system_prompt(kit: str) -> str:
    return _SYSTEM + (kgamelib.LIB_DIR / f"{kit}.guide.md").read_text(encoding="utf-8").strip()


def parse_spec(text: str, kit: str) -> dict:
    """The spec in the model's answer: a JSON object, bare or in a code block. The kit chosen by the app always wins."""
    candidates = re.findall(r"```(?:json)?[ \t]*\r?\n(.*?)```", text or "", re.S) + [text or ""]
    first, last = (text or "").find("{"), (text or "").rfind("}")
    if 0 <= first < last:
        candidates.append(text[first:last + 1])
    for candidate in candidates:
        try:
            data = json.loads(candidate)
        except ValueError:
            continue
        if isinstance(data, dict):
            data["kit"] = kit
            return data
    if first >= 0:   # the first complete object, even when something else was written after it (a small model may repeat itself)
        try:
            data, _ = json.JSONDecoder().raw_decode(text[first:])
        except ValueError:
            data = None
        if isinstance(data, dict):
            data["kit"] = kit
            return data
    raise SpecError("Modelin cevabında geçerli bir oyun özeti (JSON) yok")


def fill_seeds(spec: dict) -> dict:
    """Gives the levels, the campaign and the music a random seed when the spec has none. The k-ai models do not write seeds (random
    digits cannot be learned, and a model that tries is thrown off by them), and without one every level would be the same."""
    def seeded(part):
        if isinstance(part, dict) and "seed" not in part:
            part["seed"] = random.randint(0, 9999)
    for level in spec.get("generate") if isinstance(spec.get("generate"), list) else []:
        seeded(level)
    seeded(spec.get("campaign"))
    seeded(spec.get("musicStyle"))
    return spec


def compile_page(spec: dict) -> str:
    """The game page for a spec: the libraries' tags (added by the app) and one call that runs the kit."""
    kit = spec.get("kit", "")
    body = json.dumps(spec, ensure_ascii=False, indent=2).replace("</", "<\\/")   # a literal `</script>` must not end the block
    title = re.sub(r"[<>&]", "", str(spec.get("title") or "Oyun"))
    html = (f'<!doctype html>\n<html><head><meta charset="utf-8"><title>{title}</title></head>\n'
            '<body style="margin:0;background:#222"><canvas></canvas>\n'
            f"<script>\nK.kit.run({body});\n</script></body></html>\n")
    return kgamelib.ensure_scripts(html, ["core", kit])
