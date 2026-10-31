"""Training and evaluation data for the shooter kit (CPU only), the same way specdata.py does it for the platformer: the spec is built first,
the description is written from it, so the label is right by construction. The answers carry only what the description asks for (the
kit fills the rest) and never a seed. Messages are exactly what the app sends (Generator.create_spec / edit_spec with kit "shooter").

  examples, held = build_shooter_examples(600, 100, seed=0)
"""
import json
import random

import specdata
from specdata import ASCII_FOLD_KEEP_CASE, MOODS, MOODS_TR, NUMBER_WORDS_TR, PREFIXES, SUFFIXES, TEMPOS_TR, fold

THEMES = ("space", "night", "sky", "underwater", "cave", "castle", "forest")
KINDS = ("drifter", "zigzag", "shooter", "kamikaze", "tank")
FEATURES = ("shield", "bomb", "rapid")
TITLES = ("Yıldız Savaşı", "Uzay Nöbeti", "Galaksi Koruyucusu", "Kızıl Gezegen", "Son Filo", "Kozmik Av", "Meteor Yağmuru")
COUNTS = (4, 5, 6, 8, 10, 12, 15, 20)
LIVES = (1, 2, 3, 4, 5, 7, 9)
DEFAULTS = {"theme": "space", "difficulty": 3, "count": 8, "lives": 3, "fire": "single", "enemies": ("drifter", "zigzag", "shooter"), "boss": False}
NUM_WORDS_SMALL = {3: "üç", 4: "dört", 2: "iki", 1: "bir", 7: "yedi", 9: "dokuz", 5: "beş", 6: "altı", 8: "sekiz", 10: "on"}

TR = {
    "theme": {"space": ["uzayda geçsin", "uzay temalı", "galaksinin derinliklerinde", "yıldızlar arasında", "uzay boşluğunda uçalım"],
              "night": ["gece gökyüzünde", "karanlık bir gece", "gece teması"],
              "sky": ["gökyüzünde bulutların arasında", "gündüz gökyüzünde", "bulutlu bir gökyüzünde"],
              "underwater": ["su altında", "denizin dibinde", "okyanus teması", "denizaltı dünyasında"],
              "cave": ["mağara içinde", "yeraltında", "karanlık bir mağarada"],
              "castle": ["bir kalenin üstünde", "kale teması", "şatonun üzerinde"],
              "forest": ["bir ormanın üstünde", "orman teması", "yeşil bir ormanda"]},
    "difficulty": {1: ["çok kolay", "çocuklar için çok kolay", "en kolay zorlukta"], 2: ["kolay", "rahat bir zorlukta", "sakin tempolu"],
                   3: ["orta zorlukta", "dengeli zorlukta", "normal zorlukta"], 4: ["zor", "zorlayıcı", "oldukça zorlu"],
                   5: ["çok zor", "acımasız zorlukta", "kabus gibi zor"]},
    "fire": {"single": ["tek ateş eden bir gemi", "tek mermi atan gemi", "tek namlulu"], "double": ["çift ateş eden gemi", "iki top atan gemi", "çift namlulu"],
             "spread": ["üç yöne ateş eden gemi", "yayılan ateşli gemi", "saçma gibi dağılan mermiler"]},
    "enemies": {"drifter": ["süzülen düşmanlar", "yavaşça inen düşmanlar"], "zigzag": ["zikzak çizen düşmanlar", "kıvrılarak gelen düşmanlar"],
                "shooter": ["ateş eden düşmanlar", "mermi atan düşmanlar"], "kamikaze": ["üstüne atılan kamikaze düşmanlar", "intihar saldırısı yapan düşmanlar"],
                "tank": ["dayanıklı tank düşmanlar", "zırhlı tanklar"]},
    "boss": {True: ["sonunda patron çıksın", "patron savaşı olsun", "bir de büyük bir patron"], False: ["patron olmasın", "patronsuz olsun"]},
    "features": {"shield": ["kalkan olsun", "kalkanlı gemi", "koruyucu bir kalkan"], "bomb": ["bomba atabileyim", "bombalı", "ekranı temizleyen bomba olsun"],
                 "rapid": ["hızlı ateş", "seri ateş eden", "çabuk ateş edebilsin"]},
}
HEADS = ["Uzay nişancısı yap:", "Bana bir nişancı oyunu yaz:", "Bir shoot'em up istiyorum,", "Klasik bir uzay oyunu olsun:", "Ateş edip düşman vurduğum bir oyun:",
         "Dikey kayan bir nişancı oyunu yap:"]
VAGUE = ["Bir nişancı oyunu yap.", "Basit bir uzay oyunu istiyorum.", "Düşmanları vurduğum bir oyun yap.", "Nişancı oyunu olsun."]


def _spec(rng: random.Random, fields: set) -> dict:
    spec: dict = {"kit": "shooter"}
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
    if "waves" in fields:
        spec["waves"] = {"count": rng.choice(COUNTS)}
    ship = {}
    if "lives" in fields:
        ship["lives"] = rng.choice(LIVES)
    if "fire" in fields:
        ship["fire"] = rng.choice(("single", "double", "spread"))
    if ship:
        spec["ship"] = ship
    if "enemies" in fields:
        spec["enemies"] = rng.sample(KINDS, rng.choice((1, 2, 2, 3)))
    if "boss" in fields:
        spec["boss"] = rng.random() < 0.7
    if "features" in fields:
        spec["features"] = rng.sample(FEATURES, rng.choice((1, 1, 2)))
    return spec


def _fields(rng: random.Random) -> set:
    probs = {"title": 0.25, "theme": 0.6, "musicStyle": 0.2, "difficulty": 0.5, "waves": 0.35, "lives": 0.25, "fire": 0.3, "enemies": 0.4, "boss": 0.3, "features": 0.4}
    if rng.random() < 0.05:
        return set()
    return {f for f, p in probs.items() if rng.random() < p} or {"theme"}


def _count_phrase(rng: random.Random, n: int) -> str:
    word = NUMBER_WORDS_TR.get(n) if n >= 5 and rng.random() < 0.35 else str(n)
    return rng.choice([f"{word} dalga sürsün", f"{word} dalgalık bir oyun", f"toplam {word} dalga olsun", f"{word} dalga"])


def _phrase(rng: random.Random, field: str, spec: dict) -> str:
    if field == "title":
        return f'adı "{spec["title"]}" olsun'
    if field == "musicStyle":
        style = spec["musicStyle"]
        return rng.choice(MOODS_TR[style["mood"]]) + (", " + rng.choice(TEMPOS_TR[style["tempo"]]) if "tempo" in style else "")
    if field == "waves":
        return _count_phrase(rng, spec["waves"]["count"])
    if field == "lives":
        n = spec["ship"]["lives"]
        if n == 1:
            return rng.choice(["tek canlı", "bir canım olsun", "1 can"])
        word = NUM_WORDS_SMALL.get(n, str(n)) if rng.random() < 0.3 else str(n)
        return rng.choice([f"{word} can", f"{word} canla başlasın", f"{word} canı olsun"])
    if field == "fire":
        return rng.choice(TR["fire"][spec["ship"]["fire"]])
    if field == "enemies":
        return ", ".join(rng.choice(TR["enemies"][k]) for k in spec["enemies"])
    if field == "boss":
        return rng.choice(TR["boss"][spec["boss"]])
    if field == "features":
        return ", ".join(rng.choice(TR["features"][f]) for f in spec["features"])
    return rng.choice(TR[field][spec[field]])


def _mentioned(spec: dict) -> list:
    out = [f for f in ("title", "theme", "musicStyle", "difficulty", "waves", "enemies", "boss", "features") if f in spec]
    ship = spec.get("ship", {})
    return out + [f for f in ("lives", "fire") if f in ship]


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
    kind = rng.choice(["shield", "boss_on", "boss_off", "harder", "easier", "waves", "lives", "theme"])
    if kind == "shield" and "shield" not in new.get("features", []):
        new["features"] = new.get("features", []) + ["shield"]
        return rng.choice(["kalkan ekle", "gemiye kalkan ver", "bir de kalkan olsun"]), new, "features"
    if kind == "boss_on":
        new["boss"] = True
        return rng.choice(["sonuna patron ekle", "patron savaşı olsun"]), new, "boss"
    if kind == "boss_off":
        new["boss"] = False
        return rng.choice(["patronu kaldır", "patron olmasın"]), new, "boss"
    if kind == "harder" and new.get("difficulty", 3) < 5:
        new["difficulty"] = new.get("difficulty", 3) + 1
        return rng.choice(["biraz daha zor olsun", "zorluğu artır", "daha zorlu yap"]), new, "difficulty"
    if kind == "easier" and new.get("difficulty", 3) > 1:
        new["difficulty"] = new.get("difficulty", 3) - 1
        return rng.choice(["biraz daha kolay olsun", "zorluğu azalt", "daha rahat yap"]), new, "difficulty"
    if kind == "waves":
        n = rng.choice([c for c in COUNTS if c != new.get("waves", {}).get("count")])
        new["waves"] = {"count": n}
        return f"dalga sayısı {n} olsun", new, "waves"
    if kind == "lives":
        n = rng.choice(LIVES)
        new.setdefault("ship", {})["lives"] = n
        return rng.choice([f"{n} can ver", f"canı {n} yap"]), new, "lives"
    theme = rng.choice([t for t in THEMES if t != new.get("theme")])
    new["theme"] = theme
    return rng.choice(TR["theme"][theme]) + " olsun", new, "theme"


class _Capture:
    def __init__(self):
        self.messages = None

    def chat(self, model, messages, **kwargs):
        self.messages = messages
        return '{"kit": "shooter"}'


def messages(kind: str, text: str, spec: dict, before: dict | None) -> list:
    cap = _Capture()
    gen = specdata.Generator(cap, "m")
    if kind == "create":
        gen.create_spec(text, "shooter")
    else:
        gen.edit_spec(before, text, "shooter")
    return cap.messages + [{"role": "assistant", "content": json.dumps(spec, ensure_ascii=False)}]


def build_shooter_examples(n_train: int = 600, n_eval: int = 100, seed: int = 0):
    rng = random.Random(seed + 1000)
    train, held = [], []

    def make(index: int):
        if rng.random() < 0.15:
            base = _spec(rng, _fields(rng))
            request, new, field = _edit(rng, base)
            if new == base:
                return make(index)
            return {"id": index, "kit": "shooter", "kind": "edit", "lang": "tr", "request": request, "description": request, "before": base, "spec": new,
                    "mentioned": [field], "messages": messages("edit", request, new, base)}
        spec = _spec(rng, _fields(rng))
        fields = _mentioned(spec)
        description = _describe(rng, fields, spec)
        return {"id": index, "kit": "shooter", "kind": "create", "lang": "tr", "description": description, "spec": spec, "mentioned": fields,
                "messages": messages("create", description, spec, None)}

    for i in range(n_train):
        train.append(make(i))
    for i in range(n_eval):
        held.append(make(100000 + i))
    seen = {e["description"] for e in train}
    held = [e for e in held if e["description"] not in seen]   # never ask in the test what the training showed
    return train, held


# ---- judging an answer ----
def _value(field: str, spec: dict):
    ship = spec.get("ship") or {}
    if field == "theme":
        return spec.get("theme", DEFAULTS["theme"])
    if field == "difficulty":
        return spec.get("difficulty", DEFAULTS["difficulty"])
    if field == "waves":
        return (spec.get("waves") or {}).get("count", DEFAULTS["count"])
    if field == "lives":
        return ship.get("lives", DEFAULTS["lives"])
    if field == "fire":
        return ship.get("fire", DEFAULTS["fire"])
    if field == "enemies":
        return sorted(spec.get("enemies") or DEFAULTS["enemies"])
    if field == "boss":
        return bool(spec.get("boss", DEFAULTS["boss"]))
    if field == "features":
        return sorted(spec.get("features") or [])
    if field == "musicStyle":
        style = spec.get("musicStyle") or {}
        return (style.get("mood"), style.get("tempo", "medium"))
    if field == "title":
        return spec.get("title")
    return None


def score_shooter(pred, target: dict, mentioned) -> dict:
    if not isinstance(pred, dict) or pred.get("kit") != "shooter":
        return {"valid": False, "accuracy": 0.0, "fields": {}}
    fields = {}
    for field in mentioned:
        try:
            fields[field] = _value(field, pred) == _value(field, target)
        except (KeyError, TypeError, ValueError, AttributeError):
            fields[field] = False
    return {"valid": True, "accuracy": sum(fields.values()) / len(fields) if fields else 1.0, "fields": fields}


HAND_EVAL_SHOOTER = [
    {"kit": "shooter", "prompt": "Uzayda geçen, kalkanlı, çok zor bir oyun olsun", "expect": {"theme": "space", "features": ["shield"], "difficulty": 5}},
    {"kit": "shooter", "prompt": "Denizin altında torpido atan bir gemiyle düşman balıkları vuruyorum, sonunda dev bir patron çıksın", "expect": {"theme": "underwater", "boss": True}},
    {"kit": "shooter", "prompt": "Kolay bir nişancı oyunu, on dalga sürsün, beş canım olsun", "expect": {"difficulty": 2, "waves": 10, "lives": 5}},
    {"kit": "shooter", "prompt": "Üç yöne ateş eden gemi, bomba da atabileyim", "expect": {"fire": "spread", "features": ["bomb"]}},
    {"kit": "shooter", "prompt": "Gece gökyüzünde, kamikaze düşmanlı ve tanklı bir oyun, epik müzikli", "expect": {"theme": "night", "enemies": ["kamikaze", "tank"], "music": "epic"}},
    {"kit": "shooter", "prompt": "Patron olmasın, sadece dalgalar; on beş dalgalık sakin bir oyun", "expect": {"boss": False, "waves": 15}},
    {"kit": "shooter", "prompt": "Hızlı ateş eden bir gemi ve ateş eden düşmanlar olsun", "expect": {"features": ["rapid"], "enemies": ["shooter"]}},
    {"kit": "shooter", "prompt": "Tek canlı, acımasız zorlukta, kalesi olan bir oyun", "expect": {"lives": 1, "difficulty": 5, "theme": "castle"}},
    {"kit": "shooter", "prompt": "Orman üzerinde, çift ateş eden gemi, gizemli müzik, adı Yeşil Av", "expect": {"theme": "forest", "fire": "double", "music": "mystery", "title": "Yeşil Av"}},
    {"kit": "shooter", "prompt": "Bana sadece düz bir nişancı oyunu yap", "expect": {}},
]


def expect_ok_shooter(pred, expect: dict) -> dict:
    if not isinstance(pred, dict) or pred.get("kit") != "shooter":
        return {k: False for k in expect}
    out = {}
    for key, want in expect.items():
        try:
            if key == "music":
                out[key] = (pred.get("musicStyle") or {}).get("mood") == want
            elif key in ("features", "enemies"):
                out[key] = sorted(_value(key, pred)) == sorted(want) if key == "features" else sorted(want) == _value(key, pred)
            else:
                out[key] = _value(key, pred) == want
        except (KeyError, TypeError, ValueError, AttributeError):
            out[key] = False
    return out
