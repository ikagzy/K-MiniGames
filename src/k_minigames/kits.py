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

_CHECKS["shooter"] = [
    ("Oyun açılır ve gemi sahnededir.", "return !!game.me && Number.isFinite(game.me.x) && game.g.current === 'play';"),
    ("Gemi sağa gidebilir.",
     "const x = game.me.x; K.press('d'); await new Promise(r => setTimeout(r, 500)); K.press('d', false); return game.me.x > x + 20;"),
    ("Gemi ateş eder.",
     "K.press(' '); await new Promise(r => setTimeout(r, 400)); K.press(' ', false); return game.g.all('pbullet').length > 0;"),
    ("Düşman dalgası gelir.", "await new Promise(r => setTimeout(r, 2500)); return game.g.all('enemy').length > 0;"),
    ("Gemi ekrandan çıkmaz.", "return game.me.x >= 0 && game.me.x + game.me.w <= game.g.width;"),
]

_CHECKS["sandbox"] = [
    ("Oyun açılır ve oyuncu dünyadadır.", "return !!game.p && Number.isFinite(game.p.x) && game.g.current === 'play';"),
    ("Oyuncu yere basar.", "await new Promise(r => setTimeout(r, 1500)); return game.p.onGround === true;"),
    ("Oyuncu ileri yürüyebilir.",
     "const x = game.p.x, z = game.p.z; K.press('w'); await new Promise(r => setTimeout(r, 600)); K.press('w', false); return Math.hypot(game.p.x - x, game.p.z - z) > 0.5;"),
    ("Oyuncu bir blok kırabilir.",
     "game.state.p.pitch = -0.7; K.press('f'); await new Promise(r => setTimeout(r, 2500)); K.press('f', false); return game.hud.broken > 0;"),
    ("Dünyada toprak ve taş vardır.",
     "return game.world.count(2) > 100 && game.world.count(3) > 100;"),
]

_CHECKS["fps"] = [
    ("Oyun açılır ve oyuncu sahnededir.", "return !!game.p && Number.isFinite(game.p.x) && game.g.current === 'play';"),
    ("Oyuncu ileri yürüyebilir.",
     "const x = game.p.x, y = game.p.y; K.press('w'); await new Promise(r => setTimeout(r, 600)); K.press('w', false); return Math.hypot(game.p.x - x, game.p.y - y) > 0.5;"),
    ("Oyuncu ateş edebilir ve mermi harcar.",
     "const a = game.p.ammo; const before = a.bullets + a.shells + a.heavy; K.press(' '); await new Promise(r => setTimeout(r, 500)); K.press(' ', false); return a.bullets + a.shells + a.heavy < before;"),
    ("Bölümde düşman vardır.", "await new Promise(r => setTimeout(r, 3500)); return game.state.enemies.length > 0;"),
    ("Oyuncu duvarların içine girmez.", "return !game.state.solid(Math.floor(game.p.x), Math.floor(game.p.y));"),
]

_CHECKS["race"] = [
    ("Oyun açılır ve oyuncu pistte durur.", "return !!game.p && Number.isFinite(game.p.x) && game.g.current === 'play' && game.state.tileAt(game.p.x, game.p.y) !== 0;"),
    ("Gaza basınca araba ilerler.",
     "await new Promise(r => setTimeout(r, 3600)); const x = game.p.x, y = game.p.y; K.press('w'); await new Promise(r => setTimeout(r, 1200)); K.press('w', false); return Math.hypot(game.p.x - x, game.p.y - y) > 10;"),
    ("Rakip arabalar vardır ve ilerler.", "const r = game.state.racers[0]; const x = r.x, y = r.y; await new Promise(r2 => setTimeout(r2, 1500)); return game.state.racers.length > 0 && Math.hypot(r.x - x, r.y - y) > 5;"),
    ("Yolda en az otuz yol noktası vardır.", "return game.state.track.M >= 30;"),
]

_CHECKS["football"] = [
    ("Oyun açılır ve oyuncu sahadadır.", "return !!game.p && Number.isFinite(game.p.x) && game.g.current === 'play';"),
    ("Sahada iki takımın oyuncuları ve top vardır.", "const s = game.state; return s.players.filter(p => p.team === 0).length >= 2 && s.players.filter(p => p.team === 1).length >= 2 && Number.isFinite(s.ball.x);"),
    ("Oyuncu koşabilir.", "await new Promise(r => setTimeout(r, 1800)); const x = game.p.x; K.press('d'); await new Promise(r => setTimeout(r, 700)); K.press('d', false); return Math.abs(game.p.x - x) > 6 || game.state.me !== game.p;"),
    ("Şut atınca top hızlanır.", "const s = game.state, p = s.me; s.holder = p; s.ball.x = p.x + 7; s.ball.y = p.y; p.cd = 0; s.shoot(p, 1); return Math.hypot(s.ball.vx, s.ball.vy) > 150;"),
    ("Saat işler.", "const s = game.state; const t = s.clock; await new Promise(r => setTimeout(r, 2500)); return s.clock < t;"),
]

_CHECKS["puzzle"] = [
    ("Oyun açılır ve bir oyun nesnesi vardır.", "return !!game.p && game.g.current === 'play' && !game.state.over;"),
    ("Oyun zamanla ilerler.", "const t = game.state.time; await new Promise(r => setTimeout(r, 1500)); return game.state.time > t;"),
    ("Tuşa basınca oyun tepki verir.", "const s = game.state; const before = JSON.stringify(s.game.board || s.game.grid || s.game.cards); K.press('ArrowLeft'); await new Promise(r => setTimeout(r, 300)); K.press('ArrowLeft', false); K.press(' '); await new Promise(r => setTimeout(r, 300)); K.press(' ', false); await new Promise(r => setTimeout(r, 900)); return JSON.stringify(s.game.board || s.game.grid || s.game.cards) !== before || (s.game.piece && s.game.piece.y > 0) || s.game.cx !== undefined;"),
]

_CHECKS["adventure"] = [
    ("Oyun açılır ve kahraman zindandadır.", "return !!game.p && Number.isFinite(game.p.x) && game.g.current === 'play' && game.state.tileAt(game.p.x, game.p.y) !== 1;"),
    ("Kahraman yürüyebilir.", "await new Promise(r => setTimeout(r, 400)); const x = game.p.x, y = game.p.y; K.press('d'); K.press('s'); await new Promise(r => setTimeout(r, 900)); K.press('d', false); K.press('s', false); return Math.hypot(game.p.x - x, game.p.y - y) > 4;"),
    ("Katta canavar vardır.", "return game.state.enemies.length > 0;"),
    ("Kahraman saldırabilir.", "const s = game.state; s.p.atkT = 0; return s.attack() === true;"),
    ("Katta anahtar ve kilitli kapı vardır.", "return game.state.pickups.some(q => q.kind === 'key') && !!game.state.level.door;"),
]

_CHECKS["tower"] = [
    ("Oyun açılır ve yol vardır.", "return game.g.current === 'play' && game.state.map.cells.length >= 24;"),
    ("Kule kurulabilir.", "const s = game.state; s.gold = 999; for (let y = 0; y < s.map.H; y++) for (let x = 0; x < s.map.W; x++) if (s.canBuild(x, y)) return s.build(x, y, s.spec.towers[0]) && s.towers.length === 1; return false;"),
    ("Dalga başlar ve düşman yolda yürür.", "const s = game.state; s.startWave(); await new Promise(r => setTimeout(r, 2500)); const e = s.enemies[0]; return !!e && e.dist > 0;"),
    ("Kule düşmana ateş eder.", "const s = game.state; s.gold = 9999; const c = s.map.cells[Math.floor(s.map.cells.length / 3)]; for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1]]) if (s.canBuild(c[0] + dx, c[1] + dy)) s.build(c[0] + dx, c[1] + dy, 'arrow'); await new Promise(r => setTimeout(r, 14000)); return s.kills > 0 || s.shots.length > 0 || s.gold > 9000 + 5;"),
]

# the menus: a game may open on its main menu, and the tactical mode on its buy phase; the checks start the game first
_PREP = "const st = game.state; if (st && st.closeMenu) st.closeMenu(); if (st && st.tac && st.tac.phase === 'buy') st.tac.phase = 'live'; "
for _kit in ("sandbox", "fps", "race", "football", "puzzle", "adventure", "tower"):
    _CHECKS[_kit] = [(name, _PREP + code) for name, code in _CHECKS[_kit]]

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


_SYSTEM_OTHER = (
    "Sen bir oyun tasarımcısısın. Kullanıcının tarif ettiği oyun için KOD YAZMA; yalnızca oyunun ÖZETİNİ (tek bir JSON "
    "nesnesi) ver. Uygulama bu özeti hazır kit ile oyuna çevirir. Özetteki seçenekleri aşağıdaki kılavuzdan seç; olmayan "
    "alan ya da değer uydurma.\n\n"
)


def system_prompt(kit: str) -> str:
    head = _SYSTEM if kit == "platformer" else _SYSTEM_OTHER   # the platformer's text stays as it was: the model was trained on it
    return head + (kgamelib.LIB_DIR / f"{kit}.guide.md").read_text(encoding="utf-8").strip()


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
    if kit == "platformer" and not spec.get("generate") and not spec.get("levels"):   # only the platformer has levels
        spec["generate"] = [{}]
    for level in spec.get("generate") or []:
        level["seed"] = random.randint(0, 9999)
    for part in ("campaign", "musicStyle", "waves", "world"):
        if isinstance(spec.get(part), dict):
            spec[part]["seed"] = random.randint(0, 9999)
    if kit in ("sandbox", "fps", "race", "football", "puzzle", "adventure", "tower") and not isinstance(spec.get("world"), dict):
        spec["world"] = {"seed": random.randint(0, 9999)}
    if kit == "shooter" and not isinstance(spec.get("waves"), dict):
        spec["waves"] = {"seed": random.randint(0, 9999)}
    if kit == "platformer":
        _platformer_variety(spec)
    elif kit == "shooter":
        _shooter_variety(spec)
    elif kit == "sandbox":
        _sandbox_variety(spec)
    elif kit == "fps":
        _fps_variety(spec)
    elif kit == "race":
        _race_variety(spec)
    elif kit == "football":
        _football_variety(spec)
    elif kit == "puzzle":
        _puzzle_variety(spec)
    elif kit == "adventure":
        _adventure_variety(spec)
    elif kit == "tower":
        _tower_variety(spec)
    return spec


_THEMES = ("sky", "cave", "castle", "night", "underwater", "space", "forest")
_MOODS = ("happy", "calm", "tense", "epic", "mystery", "spooky")


def _platformer_variety(spec: dict) -> None:
    """A small model writes only what the description says, so a vague description gave the same default game every time. What the
    spec leaves open (theme, music, how long a level is, how much is in it, its style) is drawn at random within sensible ranges;
    what the model wrote is never touched."""
    spec.setdefault("theme", random.choice(_THEMES))
    if not spec.get("music") and not spec.get("musicStyle"):
        spec["musicStyle"] = {"mood": random.choice(_MOODS), "seed": random.randint(0, 9999)}
    for level in spec.get("generate") or []:
        difficulty = level.setdefault("difficulty", random.choice((1, 2, 2, 3)))
        level.setdefault("width", random.randrange(50, 101, 10))
        for field, low, high in (("pits", 1, 3), ("enemies", 1, 3), ("blocks", 1, 3), ("coins", 1, 4), ("pipes", 0, 3)):
            level.setdefault(field, random.randint(low, high))
        if difficulty >= 2:
            level.setdefault("flyers", random.randint(0, 2))
        if difficulty >= 3:
            level.setdefault("spikes", random.randint(0, 2))
        level.setdefault("style", random.randrange(5))


def _shooter_variety(spec: dict) -> None:
    """The same for the shooter: what the spec leaves open is drawn; what it says is kept."""
    spec.setdefault("theme", random.choice(("space", "space", "night", "sky", "underwater", "cave", "castle", "forest")))
    if not spec.get("music") and not spec.get("musicStyle"):
        spec["musicStyle"] = {"mood": random.choice(_MOODS), "seed": random.randint(0, 9999)}
    spec.setdefault("difficulty", random.choice((2, 3, 3, 4)))
    spec["waves"].setdefault("count", random.randint(6, 10))
    ship = spec.setdefault("ship", {})
    ship.setdefault("fire", random.choice(("single", "double", "double")))
    if not spec.get("enemies"):
        spec["enemies"] = random.sample(["drifter", "zigzag", "shooter", "kamikaze", "tank"], random.choice((3, 3, 4)))
    spec.setdefault("boss", random.random() < 0.3)


def _sandbox_variety(spec: dict) -> None:
    """The same for the sandbox: the open parts of the world are drawn."""
    spec.setdefault("biome", random.choice(("forest", "forest", "plains", "desert", "snow")))
    spec.setdefault("size", random.choice(("small", "medium", "medium", "large")))
    for field in ("caves", "ores", "trees"):
        spec.setdefault(field, random.choice((1, 2, 2, 3)))
    spec.setdefault("lakes", random.random() < 0.8)
    spec.setdefault("time", random.choice(("cycle", "cycle", "day")))
    if not spec.get("music") and not spec.get("musicStyle"):
        spec["musicStyle"] = {"mood": random.choice(("calm", "calm", "mystery", "happy")), "tempo": "slow", "seed": random.randint(0, 9999)}


def _fps_variety(spec: dict) -> None:
    """The same for the first person shooter: the open parts of the game are drawn."""
    spec.setdefault("theme", random.choice(("bunker", "bunker", "space", "ruins", "lab", "factory")))
    if not spec.get("music") and not spec.get("musicStyle"):
        spec["musicStyle"] = {"mood": random.choice(("tense", "tense", "epic", "spooky")), "tempo": random.choice(("medium", "fast")), "seed": random.randint(0, 9999)}
    spec.setdefault("difficulty", random.choice((2, 3, 3, 4)))
    spec.setdefault("levels", random.choice((2, 3, 3, 4)))
    spec.setdefault("size", random.choice(("small", "medium", "medium", "large")))
    if not spec.get("enemies"):
        spec["enemies"] = random.sample(["guard", "runner", "sniper", "brute", "turret"], random.choice((3, 3, 4)))
    if not spec.get("weapons"):
        spec["weapons"] = random.choice((["pistol", "shotgun"], ["pistol", "shotgun", "rifle"], ["pistol", "rifle", "magnum"]))
    spec.setdefault("boss", random.random() < 0.6)


def _race_variety(spec: dict) -> None:
    """The same for the racing game: the open parts of the race are drawn."""
    spec.setdefault("theme", random.choice(("city", "desert", "forest", "night")))
    if not spec.get("music") and not spec.get("musicStyle"):
        spec["music"] = "race"   # the tune written for the racing kit
    spec.setdefault("difficulty", random.choice((2, 3, 3, 4)))
    spec.setdefault("laps", random.choice((2, 3, 3, 4)))
    spec.setdefault("rivals", random.choice((3, 4, 5, 6)))
    spec.setdefault("length", random.choice(("small", "medium", "medium", "large")))
    spec.setdefault("car", random.choice(("sport", "sport", "muscle", "rally")))
    spec.setdefault("color", random.choice(("red", "blue", "yellow", "green")))
    if not spec.get("features"):
        spec["features"] = random.choice((["nitro"], ["nitro"], ["grip"], []))


def _football_variety(spec: dict) -> None:
    """The same for the football match: the open parts of the match are drawn."""
    spec.setdefault("theme", random.choice(("grass", "grass", "night", "indoor", "street")))
    if not spec.get("music") and not spec.get("musicStyle"):
        spec["music"] = "football"   # the tune written for the football kit
    spec.setdefault("difficulty", random.choice((2, 3, 3, 4)))
    spec.setdefault("teamSize", random.choice((4, 5, 5, 6)))
    spec.setdefault("duration", random.choice((90, 120, 120, 180)))
    colors = ["red", "blue", "yellow", "green", "white", "orange", "purple"]
    spec.setdefault("home", random.choice(colors))
    spec.setdefault("away", random.choice([c for c in colors if c != spec["home"]]))
    spec.setdefault("keeper", True)
    if not spec.get("features"):
        spec["features"] = random.choice((["powershot"], ["sprint"], ["powershot", "sprint"], []))


def _puzzle_variety(spec: dict) -> None:
    """The same for the puzzle game: the open parts are drawn."""
    spec.setdefault("mode", random.choice(("blocks", "match", "match", "memory")))
    spec.setdefault("theme", random.choice(("candy", "neon", "forest", "night")))
    if not spec.get("music") and not spec.get("musicStyle"):
        spec["music"] = "puzzle"   # the tune written for the puzzle kit
    spec.setdefault("difficulty", random.choice((2, 3, 3, 4)))
    spec.setdefault("size", random.choice(("small", "medium", "medium", "large")))
    if not spec.get("features"):
        spec["features"] = {"blocks": random.choice((["ghost"], ["ghost", "hold"], [])), "match": random.choice((["hint"], [])), "memory": []}[spec["mode"]]


def _adventure_variety(spec: dict) -> None:
    """The same for the adventure game: the open parts are drawn."""
    spec.setdefault("theme", random.choice(("dungeon", "dungeon", "forest", "desert", "castle")))
    spec.setdefault("hero", random.choice(("knight", "knight", "ranger", "mage")))
    if not spec.get("music") and not spec.get("musicStyle"):
        spec["music"] = "adventure"   # the tune written for the adventure kit
    spec.setdefault("difficulty", random.choice((2, 3, 3, 4)))
    spec.setdefault("levels", random.choice((2, 3, 3, 4)))
    spec.setdefault("size", random.choice(("small", "medium", "medium", "large")))
    if not spec.get("enemies"):
        spec["enemies"] = random.sample(["slime", "bat", "skeleton", "goblin", "ghost"], random.choice((2, 3, 3, 4)))
    spec.setdefault("boss", random.random() < 0.7)
    if not spec.get("features"):
        spec["features"] = random.choice((["dash"], ["dash"], ["regen"], ["loot"], ["dash", "loot"], []))


def _tower_variety(spec: dict) -> None:
    """The same for the tower defence game: the open parts are drawn."""
    spec.setdefault("theme", random.choice(("grass", "grass", "desert", "night", "lava")))
    if not spec.get("music") and not spec.get("musicStyle"):
        spec["music"] = "tower"   # the tune written for the tower kit
    spec.setdefault("difficulty", random.choice((2, 3, 3, 4)))
    spec.setdefault("size", random.choice(("small", "medium", "medium", "large")))
    spec.setdefault("waves", random.choice((8, 10, 10, 12, 15)))
    if not spec.get("enemies"):
        spec["enemies"] = random.sample(["soldier", "runner", "tank", "swarm"], random.choice((2, 3, 4)))
    if not spec.get("towers"):
        spec["towers"] = random.sample(["arrow", "cannon", "frost", "sniper"], random.choice((3, 4, 4)))
    spec.setdefault("boss", random.random() < 0.7)
    if not spec.get("features"):
        spec["features"] = random.choice((["speed"], ["speed"], ["freeze"], ["bonus"], ["speed", "freeze"], []))


def keep_seeds(before: dict, after: dict) -> dict:
    """After an edit the levels, the campaign and the music keep the seeds they had, so a change of the title does not rebuild the levels."""
    old_levels = before.get("generate") if isinstance(before.get("generate"), list) else []
    for old, new in zip(old_levels, after.get("generate") or []):
        if isinstance(old, dict) and isinstance(new, dict) and "seed" in old:
            new["seed"] = old["seed"]
    for part in ("campaign", "musicStyle", "waves", "world"):
        if isinstance(before.get(part), dict) and isinstance(after.get(part), dict) and "seed" in before[part]:
            after[part]["seed"] = before[part]["seed"]
    return after


def compile_page(spec: dict) -> str:
    """The game page for a spec: the libraries' tags (added by the app) and one call that runs the kit."""
    kit = spec.get("kit", "")
    body = json.dumps(spec, ensure_ascii=False, indent=2).replace("</", "<\\/")   # a literal `</script>` must not end the block
    title = re.sub(r"[<>&]", "", str(spec.get("title") or "Oyun"))
    html = (f'<!doctype html>\n<html><head><meta charset="utf-8"><title>{title}</title></head>\n'
            '<body style="margin:0;background:#222"><canvas></canvas>\n'
            f"<script>\nK.kit.run({body});\n</script></body></html>\n")
    return kgamelib.ensure_scripts(html, ["core", kit])
