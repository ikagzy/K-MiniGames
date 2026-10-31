"""Training and evaluation data for the sandbox (cube world) kit, built like specdata_shooter.py: the spec first, the description from it, so the
label is right by construction. The answers carry only what the description asks for and never a seed. Messages are exactly what the app sends
(Generator.create_spec / edit_spec with kit "sandbox")."""
import json
import random

import specdata
from specdata import ASCII_FOLD_KEEP_CASE, MOODS, MOODS_TR, PREFIXES, SUFFIXES, TEMPOS_TR

BIOMES = ("forest", "plains", "desert", "snow")
SIZES = ("small", "medium", "large")
FEATURES = ("fly", "sprint")
TITLES = ("Küp Dünya", "Madenci Köyü", "Kazı Diyarı", "Blok Ülkesi", "Mavi Vadi", "Taş Devri", "İnşaat Meydanı")
DEFAULTS = {"biome": "forest", "size": "medium", "caves": 2, "ores": 2, "trees": 2, "lakes": True, "time": "cycle"}

TR = {
    "biome": {"forest": ["bir orman", "ormanlık bir dünya", "ormanın ortasında"], "desert": ["bir çöl", "kumlarla kaplı çöl", "çölün ortasında"],
              "snow": ["karlı bir dünya", "kış dünyası", "kar tutmuş bir yer"], "plains": ["düz bir ova", "geniş çayırlar", "düzlük bir arazi"]},
    "size": {"small": ["küçük bir dünya", "minik bir harita", "ufak bir arazi"], "medium": ["orta boy bir dünya", "orta büyüklükte harita"],
             "large": ["büyük bir dünya", "devasa bir harita", "geniş bir arazi"]},
    "caves": {0: ["mağarasız", "hiç mağara olmasın"], 1: ["az mağara", "birkaç mağara"], 2: ["mağaralı", "mağaralar olsun"], 3: ["bol mağara", "mağara dolu"]},
    "ores": {0: ["madensiz", "maden olmasın"], 1: ["az maden", "birkaç maden"], 2: ["madenli", "maden olsun"], 3: ["bol maden", "maden dolu", "elmas ve altın dolu"]},
    "trees": {0: ["ağaçsız", "hiç ağaç olmasın"], 1: ["az ağaç", "birkaç ağaç"], 2: ["ağaçlı", "ağaçlar olsun"], 3: ["bol ağaç", "ağaç dolu"]},
    "lakes": {True: ["göllü", "göller olsun", "nehirli"], False: ["gölsüz", "su olmasın", "kuru bir dünya"]},
    "time": {"cycle": ["gece gündüz döngüsü olsun", "gündüz ve gece değişsin"], "day": ["hep gündüz olsun", "sürekli gündüz"], "night": ["hep gece olsun", "sürekli gece"]},
    "features": {"fly": ["uçabileyim", "uçma modu olsun"], "sprint": ["koşabileyim", "hızlı koşabileyim"]},
}
HEADS = ["Madencilik ve inşaat oyunu yap:", "Bir blok dünyası istiyorum,", "Küp küp bir dünya yap:", "Minecraft gibi bir oyun yap:", "Minecraft tarzı bir blok oyunu olsun:",
         "Kazıp bina yapabildiğim bir oyun:", "Eski Minecraft gibi basit bir dünya olsun:"]
VAGUE = ["Bir blok dünyası yap.", "Madencilik oyunu olsun.", "Basit bir inşaat oyunu istiyorum.", "Küp dünyalı bir oyun yap."]


def _fields(rng: random.Random) -> set:
    probs = {"title": 0.2, "biome": 0.6, "size": 0.35, "caves": 0.3, "ores": 0.3, "trees": 0.25, "lakes": 0.25, "time": 0.3, "musicStyle": 0.15, "features": 0.3}
    if rng.random() < 0.05:
        return set()
    return {f for f, p in probs.items() if rng.random() < p} or {"biome"}


def _spec(rng: random.Random, fields: set) -> dict:
    spec: dict = {"kit": "sandbox"}
    if "title" in fields:
        spec["title"] = rng.choice(TITLES)
    if "biome" in fields:
        spec["biome"] = rng.choice(BIOMES)
    if "size" in fields:
        spec["size"] = rng.choice(SIZES)
    for f in ("caves", "ores", "trees"):
        if f in fields:
            spec[f] = rng.randint(0, 3)
    if "lakes" in fields:
        spec["lakes"] = rng.random() < 0.6
    if "time" in fields:
        spec["time"] = rng.choice(("cycle", "day", "night"))
    if "musicStyle" in fields:
        style = {"mood": rng.choice(MOODS)}
        if rng.random() < 0.4:
            style["tempo"] = rng.choice(("slow", "fast"))
        spec["musicStyle"] = style
    if "features" in fields:
        spec["features"] = rng.sample(FEATURES, rng.choice((1, 1, 2)))
    return spec


def _mentioned(spec: dict) -> list:
    return [f for f in ("title", "biome", "size", "caves", "ores", "trees", "lakes", "time", "musicStyle", "features") if f in spec]


def _phrase(rng: random.Random, field: str, spec: dict) -> str:
    if field == "title":
        return f'adı "{spec["title"]}" olsun'
    if field == "musicStyle":
        style = spec["musicStyle"]
        return rng.choice(MOODS_TR[style["mood"]]) + (", " + rng.choice(TEMPOS_TR[style["tempo"]]) if "tempo" in style else "")
    if field == "features":
        return ", ".join(rng.choice(TR["features"][f]) for f in spec["features"])
    return rng.choice(TR[field][spec[field]])


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


def _edit(rng: random.Random, spec: dict):
    new = json.loads(json.dumps(spec))
    kind = rng.choice(["biome", "bigger", "smaller", "fly", "caves", "lakes_off", "day", "ores"])
    if kind == "biome":
        biome = rng.choice([b for b in BIOMES if b != new.get("biome")])
        new["biome"] = biome
        return rng.choice(TR["biome"][biome]) + " olsun", new, "biome"
    if kind == "bigger":
        new["size"] = "large"
        return rng.choice(["dünyayı büyüt", "daha büyük bir harita olsun"]), new, "size"
    if kind == "smaller":
        new["size"] = "small"
        return rng.choice(["dünyayı küçült", "daha küçük bir harita olsun"]), new, "size"
    if kind == "fly" and "fly" not in new.get("features", []):
        new["features"] = new.get("features", []) + ["fly"]
        return rng.choice(["uçma ekle", "uçabileyim"]), new, "features"
    if kind == "caves":
        new["caves"] = 3
        return rng.choice(["daha çok mağara olsun", "mağaraları artır"]), new, "caves"
    if kind == "lakes_off":
        new["lakes"] = False
        return rng.choice(["göller olmasın", "suyu kaldır"]), new, "lakes"
    if kind == "day":
        new["time"] = "day"
        return rng.choice(["hep gündüz olsun", "geceyi kaldır"]), new, "time"
    new["ores"] = 3
    return rng.choice(["daha çok maden olsun", "madenleri artır"]), new, "ores"


class _Capture:
    def __init__(self):
        self.messages = None

    def chat(self, model, messages, **kwargs):
        self.messages = messages
        return '{"kit": "sandbox"}'


def messages(kind: str, text: str, spec: dict, before: dict | None) -> list:
    cap = _Capture()
    gen = specdata.Generator(cap, "m")
    if kind == "create":
        gen.create_spec(text, "sandbox")
    else:
        gen.edit_spec(before, text, "sandbox")
    return cap.messages + [{"role": "assistant", "content": json.dumps(spec, ensure_ascii=False)}]


def build_sandbox_examples(n_train: int = 600, n_eval: int = 100, seed: int = 0):
    rng = random.Random(seed + 2000)
    train, held = [], []

    def make(index: int):
        if rng.random() < 0.15:
            base = _spec(rng, _fields(rng))
            request, new, field = _edit(rng, base)
            if new == base:
                return make(index)
            return {"id": index, "kit": "sandbox", "kind": "edit", "lang": "tr", "request": request, "description": request, "before": base, "spec": new,
                    "mentioned": [field], "messages": messages("edit", request, new, base)}
        spec = _spec(rng, _fields(rng))
        fields = _mentioned(spec)
        description = _describe(rng, fields, spec)
        return {"id": index, "kit": "sandbox", "kind": "create", "lang": "tr", "description": description, "spec": spec, "mentioned": fields,
                "messages": messages("create", description, spec, None)}

    for i in range(n_train):
        train.append(make(i))
    for i in range(n_eval):
        held.append(make(200000 + i))
    seen = {e["description"] for e in train}
    held = [e for e in held if e["description"] not in seen]
    return train, held


def _value(field: str, spec: dict):
    if field in DEFAULTS:
        return spec.get(field, DEFAULTS[field])
    if field == "features":
        return sorted(spec.get("features") or [])
    if field == "musicStyle":
        style = spec.get("musicStyle") or {}
        return (style.get("mood"), style.get("tempo", "medium"))
    if field == "title":
        return spec.get("title")
    return None


def score_sandbox(pred, target: dict, mentioned) -> dict:
    if not isinstance(pred, dict) or pred.get("kit") != "sandbox":
        return {"valid": False, "accuracy": 0.0, "fields": {}}
    fields = {}
    for field in mentioned:
        try:
            fields[field] = _value(field, pred) == _value(field, target)
        except (KeyError, TypeError, ValueError, AttributeError):
            fields[field] = False
    return {"valid": True, "accuracy": sum(fields.values()) / len(fields) if fields else 1.0, "fields": fields}


HAND_EVAL_SANDBOX = [
    {"kit": "sandbox", "prompt": "Karlı, küçük bir dünya, bol maden, uçabileyim", "expect": {"biome": "snow", "size": "small", "ores": 3, "features": ["fly"]}},
    {"kit": "sandbox", "prompt": "Çölde geçen büyük bir harita, gölsüz, hep gündüz olsun", "expect": {"biome": "desert", "size": "large", "lakes": False, "time": "day"}},
    {"kit": "sandbox", "prompt": "Ağaç dolu bir orman, mağaralar olsun, gece gündüz değişsin", "expect": {"biome": "forest", "trees": 3, "caves": 2, "time": "cycle"}},
    {"kit": "sandbox", "prompt": "Madencilik oyunu, elmas ve altın dolu, mağaralı", "expect": {"ores": 3, "caves": 2}},
    {"kit": "sandbox", "prompt": "Düz ova, ağaçsız, mağarasız, sade bir inşaat dünyası", "expect": {"biome": "plains", "trees": 0, "caves": 0}},
    {"kit": "sandbox", "prompt": "Minecraft gibi bir oyun, orta boy, göllü", "expect": {"size": "medium", "lakes": True}},
    {"kit": "sandbox", "prompt": "Kış dünyası, koşabileyim, sakin müzikli", "expect": {"biome": "snow", "features": ["sprint"], "music": "calm"}},
    {"kit": "sandbox", "prompt": "Devasa bir dünya, bolca maden ve mağara", "expect": {"size": "large", "ores": 3, "caves": 3}},
    {"kit": "sandbox", "prompt": "Hep gece olsun, orman gibi bir yer", "expect": {"time": "night", "biome": "forest"}},
    {"kit": "sandbox", "prompt": "Sadece basit bir blok dünyası olsun", "expect": {}},
]


def expect_ok_sandbox(pred, expect: dict) -> dict:
    if not isinstance(pred, dict) or pred.get("kit") != "sandbox":
        return {k: False for k in expect}
    out = {}
    for key, want in expect.items():
        try:
            if key == "music":
                out[key] = (pred.get("musicStyle") or {}).get("mood") == want
            elif key == "features":
                out[key] = sorted(_value(key, pred)) == sorted(want)
            else:
                out[key] = _value(key, pred) == want
        except (KeyError, TypeError, ValueError, AttributeError):
            out[key] = False
    return out
