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


def _repair(value, node):
    """`value` brought into the shape of the schema `node`: unknown keys and values outside an enum are dropped, numbers are held
    inside their range, lists are cut to their length (a repeated entry of a list of names is dropped). None when nothing is left."""
    kind = node.get("type")
    if "enum" in node:
        return value if value in node["enum"] else None
    if kind == "integer" or kind == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return None
        value = round(value) if kind == "integer" else value
        return min(node.get("maximum", value), max(node.get("minimum", value), value))
    if kind == "string":
        return value[:node.get("maxLength", len(value))] if isinstance(value, str) else None
    if kind == "boolean":
        return value if isinstance(value, bool) else None
    if kind == "object":
        if not isinstance(value, dict):
            return None
        out = {}
        for key, sub in node.get("properties", {}).items():
            if key in value:
                fixed = _repair(value[key], sub)
                if fixed is not None:
                    out[key] = fixed
        return out
    if kind == "array":
        if not isinstance(value, list):
            return None
        items = [x for x in (_repair(v, node.get("items", {})) for v in value) if x is not None]
        if node.get("items", {}).get("enum"):
            items = list(dict.fromkeys(items))
        items = items[:node.get("maxItems", len(items))]
        return items if len(items) >= node.get("minItems", 0) else None
    return value


def repair_spec(spec: dict, kit: str) -> dict:
    """A small model's spec made safe: it keeps only what the kit's schema allows, holds numbers in their range, always has a level
    list, and gets its seeds from the app, never from the model: a seed is a random number and the models cannot write one (they
    are thrown off by the digits, and without a seed every level would be the same)."""
    node, drawn = schema(kit), spec.get("levels")   # levels drawn by hand are not in the schema, the kit still plays them
    if node:
        fixed = _repair(spec, node)
        spec = fixed if isinstance(fixed, dict) else spec
        if isinstance(drawn, list) and drawn:
            spec["levels"] = drawn
    spec["kit"] = kit
    if not spec.get("generate") and not spec.get("levels"):
        spec["generate"] = [{}]
    for level in spec.get("generate") or []:
        level["seed"] = random.randint(0, 9999)
    for part in ("campaign", "musicStyle"):
        if isinstance(spec.get(part), dict):
            spec[part]["seed"] = random.randint(0, 9999)
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
