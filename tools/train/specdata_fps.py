"""Training and evaluation data for the first person shooter kit (CPU only), the same way specdata_shooter.py does it: the spec is built first,
the description is written from it, so the label is right by construction. The answers carry only what the description asks for (the kit
fills the rest) and never a seed. Messages are exactly what the app sends (Generator.create_spec / edit_spec with kit "fps").

  examples, held = build_fps_examples(600, 100, seed=0)
"""
import json
import random

import specdata
from specdata import ASCII_FOLD_KEEP_CASE, MOODS, MOODS_TR, NUMBER_WORDS_TR, PREFIXES, SUFFIXES, TEMPOS_TR

THEMES = ("bunker", "space", "ruins", "lab", "factory")
ENEMIES = ("guard", "runner", "sniper", "brute", "turret")
WEAPONS = ("pistol", "shotgun", "rifle", "magnum")
FEATURES = ("sprint", "regen", "armor")
MAPS = ("depo", "liman", "kale", "tunel")
TAC_WORDS = ["tur tur oynanan taktik modda olsun", "taktik nişancı modu: bölgeye spike kurmalı", "bir bölgeye bomba kurup savunduğum taktik mod", "hazırlıkta silah alıp tur tur oynadığım taktik mod"]
TITLES = ("Sığınak", "Son Hat", "Kızıl Alarm", "Derin Tesis", "Gece Operasyonu", "Çelik Koridor", "Sıfır Nokta")
DEFAULTS = {"theme": "bunker", "difficulty": 3, "levels": 3, "size": "medium", "mode": "campaign", "ammo": "normal", "enemies": ("guard", "runner", "sniper"),
            "weapons": ("pistol", "shotgun", "rifle"), "boss": True}
NUM_WORDS_SMALL = {1: "bir", 2: "iki", 3: "üç", 4: "dört", 5: "beş", 6: "altı"}

TR = {
    "theme": {"bunker": ["bir sığınakta geçsin", "yeraltı sığınağı teması", "beton bir sığınakta"],
              "space": ["uzay istasyonunda geçsin", "uzay istasyonu teması", "yıldızlara bakan bir uzay istasyonunda"],
              "ruins": ["harabelerde geçsin", "antik harabe teması", "yıkık bir şehirde"],
              "lab": ["laboratuvarda geçsin", "bir laboratuvar teması", "steril bir laboratuvarda"],
              "factory": ["fabrikada geçsin", "terk edilmiş bir fabrikada", "fabrika teması"]},
    "difficulty": {1: ["çok kolay", "en kolay zorlukta"], 2: ["kolay", "rahat bir zorlukta"], 3: ["orta zorlukta", "dengeli zorlukta"], 4: ["zor", "zorlayıcı"],
                   5: ["çok zor", "acımasız zorlukta", "kabus gibi zor"]},
    "size": {"small": ["küçük bölümler", "küçük haritalar"], "medium": ["orta büyüklükte bölümler"], "large": ["büyük ve geniş bölümler", "devasa haritalar"]},
    "map": {"depo": ["depo haritasında", "bir depoda"], "liman": ["liman haritasında", "limanda"], "kale": ["kale haritasında", "bir kalede"], "tunel": ["tünel haritasında", "tünelde"]},
    "mode": {"campaign": ["bölümlerden oluşsun", "bölüm bölüm ilerleyelim"], "tactical": TAC_WORDS, "arena": ["arena modunda olsun", "dalga dalga gelen düşmanlara karşı hayatta kalma", "tek bir arenada dalgalar halinde düşman gelsin"]},
    "ammo": {"scarce": ["mermi kıt olsun", "az mermi", "mermi bulmak zor olsun"], "normal": ["normal miktarda mermi"], "plenty": ["bol mermi", "mermi bol olsun", "sınırsız gibi mermi"]},
    "enemies": {"guard": ["ateş eden nöbetçiler", "silahlı muhafızlar"], "runner": ["üstüne koşan koşucular", "yaklaşıp vuran düşmanlar"],
                "sniper": ["keskin nişancılar", "uzaktan vuran keskin nişancı düşmanlar"], "brute": ["iri ve dayanıklı düşmanlar", "dev gibi ağır düşmanlar"],
                "turret": ["sabit tuzak taretler", "duvardaki taretler"]},
    "weapons": {"pistol": ["tabanca", "bir tabanca"], "shotgun": ["pompalı tüfek", "pompalı"], "rifle": ["otomatik tüfek", "seri atan tüfek"], "magnum": ["güçlü bir magnum", "tek atışlık magnum"]},
    "boss": {True: ["sonunda patron çıksın", "son bölümde patron olsun"], False: ["patron olmasın", "patronsuz olsun"]},
    "features": {"sprint": ["hızlı koşabileyim", "koşma özelliği"], "regen": ["canım yavaş yavaş dolsun", "can yenilenmesi olsun"], "armor": ["zırhla başlayayım", "zırhlı başlasın"]},
}
HEADS = ["FPS oyunu yap:", "Bana bir birinci şahıs nişancı oyunu yaz:", "Doom gibi bir oyun istiyorum,", "Silahla düşman vurduğum bir oyun olsun:",
         "Birinci şahıs bir nişancı yap:", "Klasik bir FPS istiyorum,"]
VAGUE = ["Bir FPS oyunu yap.", "Silahla düşman vurduğum bir oyun olsun.", "Doom gibi bir şey istiyorum.", "Birinci şahıs nişancı oyunu yap."]


def _spec(rng: random.Random, fields: set) -> dict:
    spec: dict = {"kit": "fps"}
    if "title" in fields:
        spec["title"] = rng.choice(TITLES)
    if "theme" in fields:
        spec["theme"] = rng.choice(THEMES)
    if "musicStyle" in fields:
        style = {"mood": rng.choice(MOODS)}
        if rng.random() < 0.4:
            style["tempo"] = rng.choice(("slow", "fast"))
        spec["musicStyle"] = style
    if "difficulty" in fields:
        spec["difficulty"] = rng.randint(1, 5)
    if "levels" in fields:
        spec["levels"] = rng.randint(1, 6)
    if "size" in fields:
        spec["size"] = rng.choice(("small", "medium", "large"))
    if "mode" in fields:
        spec["mode"] = rng.choice(("campaign", "arena", "tactical"))
        if spec["mode"] in ("arena", "tactical") and rng.random() < 0.5:
            spec["map"] = rng.choice(MAPS)
        if spec["mode"] == "tactical" and rng.random() < 0.4:
            spec["rounds"] = rng.randint(2, 7)
    if "ammo" in fields:
        spec["ammo"] = rng.choice(("scarce", "plenty"))
    if "enemies" in fields:
        spec["enemies"] = rng.sample(ENEMIES, rng.choice((1, 2, 2, 3)))
    if "weapons" in fields:
        spec["weapons"] = rng.sample(WEAPONS, rng.choice((1, 2, 2, 3)))
    if "boss" in fields:
        spec["boss"] = rng.random() < 0.6
    if "features" in fields:
        spec["features"] = rng.sample(FEATURES, rng.choice((1, 1, 2)))
    return spec


def _fields(rng: random.Random) -> set:
    probs = {"title": 0.2, "theme": 0.6, "musicStyle": 0.2, "difficulty": 0.45, "levels": 0.3, "size": 0.2, "mode": 0.2, "ammo": 0.2, "enemies": 0.4,
             "weapons": 0.45, "boss": 0.3, "features": 0.3}
    if rng.random() < 0.05:
        return set()
    return {f for f, p in probs.items() if rng.random() < p} or {"theme"}


def _phrase(rng: random.Random, field: str, spec: dict) -> str:
    if field == "title":
        return f'adı "{spec["title"]}" olsun'
    if field == "musicStyle":
        style = spec["musicStyle"]
        return rng.choice(MOODS_TR[style["mood"]]) + (", " + rng.choice(TEMPOS_TR[style["tempo"]]) if "tempo" in style else "")
    if field == "levels":
        n = spec["levels"]
        word = NUM_WORDS_SMALL.get(n, str(n)) if rng.random() < 0.4 else str(n)
        return rng.choice([f"{word} bölüm sürsün", f"{word} bölümlük bir oyun", f"toplam {word} bölüm olsun"])
    if field in ("enemies", "weapons"):
        return ", ".join(rng.choice(TR[field][k]) for k in spec[field]) + (" olsun" if field == "weapons" and rng.random() < 0.5 else "")
    if field == "rounds":
        return rng.choice([f"{spec['rounds']} tur kazanan maçı alsın", f"ilk {spec['rounds']} turu kazanan galip gelsin"])
    if field == "boss":
        return rng.choice(TR["boss"][spec["boss"]])
    if field == "features":
        return ", ".join(rng.choice(TR["features"][f]) for f in spec["features"])
    return rng.choice(TR[field][spec[field]])


def _mentioned(spec: dict) -> list:
    return [f for f in ("title", "theme", "musicStyle", "difficulty", "levels", "size", "mode", "map", "rounds", "ammo", "enemies", "weapons", "boss", "features") if f in spec]


def _describe(rng: random.Random, fields: list, spec: dict) -> str:
    if not fields:
        return rng.choice(VAGUE)
    clauses = [_phrase(rng, f, spec) for f in fields]
    rng.shuffle(clauses)
    style = rng.random()
    if style < 0.4:
        text = f"{rng.choice(HEADS)} {', '.join(clauses)}."
    elif style < 0.7:
        body = clauses[0] if len(clauses) == 1 else f"{', '.join(clauses[:-1])} ve {clauses[-1]}"
        text = f"{rng.choice(PREFIXES)} {body}{rng.choice(SUFFIXES)}"
        text = text if text.endswith(("?", "!")) else text + "."
    elif style < 0.85:
        text = ", ".join(clauses) + rng.choice(["", " olsun", " istiyorum"]) + "."
    else:
        text = "\n".join(f"- {c}" for c in clauses)
    if rng.random() < 0.1:
        text = text[0].lower() + text[1:]
    if rng.random() < 0.12:
        text = text.translate(ASCII_FOLD_KEEP_CASE)
    return text


# ---- edits: a spec and a request in, the whole new spec out ----
def _edit(rng: random.Random, spec: dict):
    new = json.loads(json.dumps(spec))
    kind = rng.choice(["weapon", "boss_on", "boss_off", "harder", "easier", "levels", "theme", "arena", "regen", "tactical"])
    if kind == "tactical":
        new["mode"] = "tactical"
        return rng.choice(["taktik moda çevir", "tur tur taktik mod olsun", "spike kurmalı taktik mod yap"]), new, "mode"
    if kind == "weapon":
        pool = [w for w in WEAPONS if w not in new.get("weapons", [])]
        if pool:
            w = rng.choice(pool)
            new["weapons"] = new.get("weapons", []) + [w]
            return rng.choice([f"{TR['weapons'][w][0]} ekle", f"bir de {TR['weapons'][w][0]} olsun"]), new, "weapons"
    if kind == "boss_on":
        new["boss"] = True
        return rng.choice(["sonuna patron ekle", "patron savaşı olsun"]), new, "boss"
    if kind == "boss_off":
        new["boss"] = False
        return rng.choice(["patronu kaldır", "patron olmasın"]), new, "boss"
    if kind == "harder" and new.get("difficulty", 3) < 5:
        new["difficulty"] = new.get("difficulty", 3) + 1
        return rng.choice(["biraz daha zor olsun", "zorluğu artır"]), new, "difficulty"
    if kind == "easier" and new.get("difficulty", 3) > 1:
        new["difficulty"] = new.get("difficulty", 3) - 1
        return rng.choice(["biraz daha kolay olsun", "zorluğu azalt"]), new, "difficulty"
    if kind == "levels":
        n = rng.choice([c for c in range(1, 7) if c != new.get("levels")])
        new["levels"] = n
        return f"{n} bölüm olsun", new, "levels"
    if kind == "arena":
        new["mode"] = "arena"
        return rng.choice(["arena moduna çevir", "dalga dalga düşman gelsin"]), new, "mode"
    if kind == "regen":
        if "regen" not in new.get("features", []):
            new["features"] = new.get("features", []) + ["regen"]
            return rng.choice(["can yenilensin", "canım yavaşça dolsun"]), new, "features"
    theme = rng.choice([t for t in THEMES if t != new.get("theme")])
    new["theme"] = theme
    return rng.choice(TR["theme"][theme]).replace(" geçsin", "") + " olsun", new, "theme"


class _Capture:
    def __init__(self):
        self.messages = None

    def chat(self, model, messages, **kwargs):
        self.messages = messages
        return '{"kit": "fps"}'


def messages(kind: str, text: str, spec: dict, before: dict | None) -> list:
    cap = _Capture()
    gen = specdata.Generator(cap, "m")
    if kind == "create":
        gen.create_spec(text, "fps")
    else:
        gen.edit_spec(before, text, "fps")
    return cap.messages + [{"role": "assistant", "content": json.dumps(spec, ensure_ascii=False)}]


def build_fps_examples(n_train: int = 600, n_eval: int = 100, seed: int = 0):
    rng = random.Random(seed + 2000)
    train, held = [], []

    def make(index: int):
        if rng.random() < 0.15:
            base = _spec(rng, _fields(rng))
            request, new, field = _edit(rng, base)
            if new == base:
                return make(index)
            return {"id": index, "kit": "fps", "kind": "edit", "lang": "tr", "request": request, "description": request, "before": base, "spec": new,
                    "mentioned": [field], "messages": messages("edit", request, new, base)}
        spec = _spec(rng, _fields(rng))
        fields = _mentioned(spec)
        description = _describe(rng, fields, spec)
        return {"id": index, "kit": "fps", "kind": "create", "lang": "tr", "description": description, "spec": spec, "mentioned": fields,
                "messages": messages("create", description, spec, None)}

    for i in range(n_train):
        train.append(make(i))
    for i in range(n_eval):
        held.append(make(200000 + i))
    seen = {e["description"] for e in train}
    held = [e for e in held if e["description"] not in seen]   # never ask in the test what the training showed
    return train, held


# ---- judging an answer ----
def _value(field: str, spec: dict):
    if field in ("enemies", "weapons"):
        return sorted(spec.get(field) or DEFAULTS[field])
    if field == "features":
        return sorted(spec.get("features") or [])
    if field == "musicStyle":
        style = spec.get("musicStyle") or {}
        return (style.get("mood"), style.get("tempo", "medium"))
    if field == "title":
        return spec.get("title")
    if field == "boss":
        return bool(spec.get("boss", DEFAULTS["boss"]))
    if field == "map":
        return spec.get("map", "")
    if field == "rounds":
        return spec.get("rounds", 4)
    return spec.get(field, DEFAULTS.get(field))


def score_fps(pred, target: dict, mentioned) -> dict:
    if not isinstance(pred, dict) or pred.get("kit") != "fps":
        return {"valid": False, "accuracy": 0.0, "fields": {}}
    fields = {}
    for field in mentioned:
        try:
            fields[field] = _value(field, pred) == _value(field, target)
        except (KeyError, TypeError, ValueError, AttributeError):
            fields[field] = False
    return {"valid": True, "accuracy": sum(fields.values()) / len(fields) if fields else 1.0, "fields": fields}


HAND_EVAL_FPS = [
    {"kit": "fps", "prompt": "Laboratuvarda geçen, pompalılı ve çok zor bir FPS olsun", "expect": {"theme": "lab", "weapons": ["shotgun"], "difficulty": 5}},
    {"kit": "fps", "prompt": "Doom gibi bir oyun, sığınakta, sonunda patron çıksın, üç bölüm", "expect": {"theme": "bunker", "boss": True, "levels": 3}},
    {"kit": "fps", "prompt": "Arena modunda dalga dalga gelen düşmanlar, bol mermi, patron olmasın", "expect": {"mode": "arena", "ammo": "plenty", "boss": False}},
    {"kit": "fps", "prompt": "Uzay istasyonunda keskin nişancılar ve taretler olsun, tüfekle oynayalım", "expect": {"theme": "space", "enemies": ["sniper", "turret"], "weapons": ["rifle"]}},
    {"kit": "fps", "prompt": "Fabrikada geçen, kolay, iri düşmanlı, tabanca ve magnum olan bir oyun", "expect": {"theme": "factory", "difficulty": 2, "enemies": ["brute"], "weapons": ["magnum", "pistol"]}},
    {"kit": "fps", "prompt": "Harabelerde, mermi kıt olsun, canım yavaş yavaş dolsun, epik müzikli", "expect": {"theme": "ruins", "ammo": "scarce", "features": ["regen"], "music": "epic"}},
    {"kit": "fps", "prompt": "Büyük bölümler, zırhla başlayayım, koşucu düşmanlar", "expect": {"size": "large", "features": ["armor"], "enemies": ["runner"]}},
    {"kit": "fps", "prompt": "Tek bölümlük, çok zor, patronsuz bir nişancı", "expect": {"levels": 1, "difficulty": 5, "boss": False}},
    {"kit": "fps", "prompt": "Adı Sıfır Nokta olsun, birinci şahıs, korku müzikli", "expect": {"title": "Sıfır Nokta", "music": "spooky"}},
    {"kit": "fps", "prompt": "Bana sadece düz bir FPS yap", "expect": {}},
    {"kit": "fps", "prompt": "Liman haritasında tur tur oynanan taktik nişancı modu, zor", "expect": {"mode": "tactical", "map": "liman", "difficulty": 4}},
    {"kit": "fps", "prompt": "Kalede dalga dalga düşman gelsin, arena olsun, bol mermi", "expect": {"mode": "arena", "map": "kale", "ammo": "plenty"}},
]


def expect_ok_fps(pred, expect: dict) -> dict:
    if not isinstance(pred, dict) or pred.get("kit") != "fps":
        return {k: False for k in expect}
    out = {}
    for key, want in expect.items():
        try:
            if key == "music":
                out[key] = (pred.get("musicStyle") or {}).get("mood") == want
            elif key in ("features", "enemies", "weapons"):
                out[key] = sorted(_value(key, pred)) == sorted(want)
            else:
                out[key] = _value(key, pred) == want
        except (KeyError, TypeError, ValueError, AttributeError):
            out[key] = False
    return out
