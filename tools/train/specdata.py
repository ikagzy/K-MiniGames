"""Training data for the spec model: pairs of (what a user says) -> (the game spec), made FROM the spec, so every label is
right by construction. A spec is sampled first; the sentence is then written from it with many ways to say each thing.

What is held back for the evaluation: (theme, difficulty) pairs the training never shows, extra ways of saying things, and
hand-written prompts (HAND_EVAL). Messages are built with the app's own Generator, so they match what it sends."""
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))

from k_minigames.generator import Generator  # noqa: E402
from k_minigames import kits  # noqa: E402

DENSITIES = ("enemies", "coins", "pits", "pipes", "blocks", "flyers", "spikes")
THEMES = ("sky", "cave", "castle", "night", "underwater", "space", "forest")
HELD_PAIRS = {("night", 4), ("cave", 5), ("castle", 1), ("forest", 3), ("space", 2), ("underwater", 4), ("sky", 5)}
TITLES = ("Kagzy", "Orman Macerası", "Gece Koşusu", "Kara Şövalye", "Mavi Yolculuk", "Zıpla Kahraman", "Altın Avcısı", "Yıldız Yolu")
LIVES = (1, 2, 3, 5, 7, 9)
TIMES = (90, 120, 180, 300, 500)
WIDTH_CLASSES = {"short": (30, 40), "medium": (50, 70), "long": (90, 130), "huge": (140, 160)}
MOODS = ("happy", "calm", "tense", "epic", "mystery", "spooky")
FEATURES_ALL = ("doubleJump", "spring", "dashPad", "rings", "checkpoint", "ice", "movingPlatforms")

# ---- how things are said (Turkish; English for the main fields) ----
TR = {
    "theme": {"sky": ["gökyüzü teması", "gündüz, açık hava", "güneşli bir dünya", "bulutlu gökyüzünde"],
              "cave": ["mağara teması", "karanlık bir mağarada", "yeraltı dünyası"],
              "castle": ["kale teması", "bir şatoda", "kale içinde geçsin"],
              "night": ["gece teması", "gece vakti", "yıldızlı gece"],
              "underwater": ["su altı teması", "denizin altında", "okyanus dünyası"],
              "space": ["uzay teması", "uzayda geçsin", "galaksi dünyası"],
              "forest": ["orman teması", "ormanda geçsin", "yeşil bir orman"]},
    "difficulty": {1: ["çok kolay", "en kolay zorluk", "çocuklar için çok kolay"], 2: ["kolay", "rahat bir zorluk"],
                   3: ["orta zorlukta", "dengeli zorluk"], 4: ["zor", "zorlu"], 5: ["çok zor", "acımasız zorlukta", "en zor seviye"]},
    "width": {"short": ["kısa seviye", "kısa bir bölüm"], "medium": ["orta uzunlukta seviye"],
              "long": ["uzun seviye", "uzun bir bölüm"], "huge": ["çok uzun, bitmek bilmeyen seviye"]},
    "enemies": {0: ["düşman olmasın", "hiç düşman yok", "düşmansız"], 1: ["az düşman", "birkaç düşman"], 3: ["bol düşman"],
                4: ["çok düşman"], 5: ["düşman dolu", "her yerde düşman"]},
    "coins": {0: ["altın olmasın", "altınsız"], 1: ["az altın"], 3: ["bol altın"], 4: ["çok altın"], 5: ["altın yağmuru", "altın dolu"]},
    "pits": {0: ["çukur olmasın", "çukursuz"], 1: ["az çukur"], 3: ["bol çukur"], 4: ["çok çukur"], 5: ["çukur dolu", "sürekli çukurlar"]},
    "pipes": {0: ["boru olmasın"], 1: ["az boru"], 3: ["bol boru"], 4: ["çok boru"], 5: ["boru ormanı"]},
    "blocks": {0: ["blok olmasın", "tuğlasız"], 1: ["az blok"], 3: ["bol tuğla ve soru bloğu"], 4: ["çok blok"], 5: ["bloklarla dolu"]},
    "flyers": {1: ["birkaç uçan düşman"], 2: ["uçan düşmanlar olsun"], 3: ["bol uçan düşman"], 4: ["çok uçan düşman"],
               5: ["uçan düşman sürüsü"]},
    "spikes": {1: ["birkaç diken"], 2: ["dikenler olsun"], 3: ["bol diken"], 4: ["çok diken"], 5: ["diken dolu"]},
    "features": ["çift zıplama olsun", "iki kez zıplayabilsin", "double jump"],
    "levels": {2: ["iki seviyeli", "2 bölüm"], 3: ["üç seviyeli", "3 bölüm"], 4: ["dört seviyeli", "4 seviyeli"]},
    "music": {"boss": ["tempolu müzik"], "underground": ["sakin müzik"], "castle": ["gerilimli müzik"], "overworld": ["neşeli müzik"]},
    "speed": {"slow": ["yavaş yürüyen kahraman"], "fast": ["hızlı koşan kahraman", "çok hızlı"]},
    "jump": {"low": ["alçak zıplayan"], "high": ["yüksek zıplayan kahraman", "çok yükseğe zıplasın"]},
    "qblocks": {"mushroom": ["blok ve mantar çıksın"], "star": ["bloklardan yıldız çıksın"]},
}
# ways of saying things that only the evaluation uses (the model has to understand, not remember)
EVAL_EXTRA = {
    "theme": {"night": ["karanlık bir gecede"], "cave": ["yer altındaki tüneller"], "forest": ["ağaçların arasında"],
              "space": ["yıldızlar arasında"], "underwater": ["derin sularda"], "castle": ["ortaçağ şatosunda"], "sky": ["güzel bir günde"]},
    "difficulty": {1: ["çok basit"], 2: ["hafif"], 3: ["ne kolay ne zor"], 4: ["sert"], 5: ["imkânsıza yakın zor"]},
    "enemies": {0: ["tek bir düşman bile olmasın"], 4: ["düşman kaynasın"], 5: ["düşmandan geçilmesin"]},
    "features": ["havada bir kez daha zıplayabilsin"],
}
EN = {
    "theme": {"sky": ["sunny sky theme"], "cave": ["a dark cave"], "castle": ["castle theme"], "night": ["night theme"],
              "underwater": ["underwater world"], "space": ["outer space"], "forest": ["forest theme"]},
    "difficulty": {1: ["very easy"], 2: ["easy"], 3: ["medium difficulty"], 4: ["hard"], 5: ["very hard"]},
    "width": {"short": ["short level"], "medium": ["medium length level"], "long": ["long level"], "huge": ["huge endless level"]},
    "enemies": {0: ["no enemies"], 1: ["few enemies"], 3: ["lots of enemies"], 4: ["many enemies"], 5: ["packed with enemies"]},
    "coins": {0: ["no coins"], 1: ["few coins"], 3: ["lots of coins"], 4: ["many coins"], 5: ["raining coins"]},
    "pits": {0: ["no pits"], 1: ["few pits"], 3: ["lots of pits"], 4: ["many pits"], 5: ["pits everywhere"]},
    "features": ["double jump", "can jump twice"],
    "levels": {2: ["two levels"], 3: ["three levels"], 4: ["four levels"]},
}
TR_HEADS = ["Bir platform oyunu yap:", "Bana bir platform oyunu hazırla:", "Platform oyunu istiyorum:", "Klasik bir platform oyunu olsun:",
            "Şunlara sahip bir platform oyunu:", "Bir koşup zıplama oyunu yapar mısın?"]
EVAL_HEADS = ["Kahramanımızın macerası:", "Bir oyun tasarla:", "Oynamak için şöyle bir platform oyunu lazım:"]
EN_HEADS = ["Make a platformer:", "I want a platform game:", "Build me a platformer game:", "Can you make me a platformer?",
            "Hey, I need a platform game:"]

# more ways of saying the same things (real people do not write like the first list): suffixed forms, longer wordings, "no X" forms
MORE_TR = {
    "theme": {"sky": ["gündüz vakti", "mavi gökyüzü", "güneşli ve açık hava"], "cave": ["yer altında", "mağaranın içinde", "karanlık tüneller"],
              "castle": ["şatoda geçen", "kale"], "night": ["gecenin karanlığında", "ay ışığında", "gece"],
              "underwater": ["su altında", "denizde", "sualtı"], "space": ["uzay", "uzayda", "yıldızlararası"],
              "forest": ["ormanda", "orman", "ağaçlık bir yer"]},
    "difficulty": {1: ["çocuk oyuncağı", "tamamen rahat"], 2: ["kolayca geçilebilir", "fazla zor olmayan"],
                   3: ["ortalama zorlukta", "orta seviye"], 4: ["zorlayıcı", "oldukça zor"],
                   5: ["çok çok zor", "kabus gibi zor", "çıldırtıcı derecede zor"]},
    "width": {"short": ["minik bir seviye", "kısacık bir bölüm"], "medium": ["ortalama uzunlukta bir bölüm"],
              "long": ["epey uzun bir yol", "uzun uzun giden bir seviye"], "huge": ["dev gibi uzun bir seviye", "bitmeyen bir bölüm"]},
    "enemies": {0: ["düşmansız olsun", "kimse saldırmasın"], 1: ["az düşmanlı", "tek tük düşman"], 3: ["bol düşmanlı", "epey düşman"],
                4: ["çok düşmanlı", "düşman çok olsun"], 5: ["düşman yağmuru", "düşmanlarla dolu"]},
    "coins": {0: ["altınsız olsun", "altın toplanmasın"], 1: ["birkaç altın", "az altınlı"], 3: ["bol altınlı", "epey altın"],
              4: ["çok altınlı", "bir sürü altın"], 5: ["altınlarla dolu", "altın içinde yüzsün"]},
    "pits": {0: ["çukursuz olsun", "hiç çukur olmasın"], 1: ["birkaç çukur", "az çukurlu"], 3: ["bol çukurlu"], 4: ["çok çukurlu"],
             5: ["çukurlarla dolu"]},
    "pipes": {0: ["borusuz", "hiç boru olmasın"], 1: ["birkaç boru"], 3: ["bol borulu"], 4: ["çok borulu"], 5: ["borularla dolu"]},
    "blocks": {0: ["bloksuz"], 1: ["birkaç blok"], 3: ["bol bloklu", "tuğla ve blok bol"], 4: ["çok bloklu"], 5: ["bloklarla dolu"]},
    "flyers": {0: ["uçan düşman olmasın", "uçan düşmansız"], 1: ["az uçan düşman"], 2: ["uçan düşmanlar da olsun"],
               3: ["epey uçan düşman"], 4: ["bir sürü uçan düşman"], 5: ["uçan düşmanlarla dolu"]},
    "spikes": {0: ["diken olmasın", "dikensiz"], 1: ["az diken"], 2: ["dikenli yerler olsun"], 3: ["epey diken"],
               4: ["bir sürü diken"], 5: ["dikenlerle dolu"]},
    "levels": {2: ["iki bölüm", "2 seviye"], 3: ["üç bölüm", "3 seviye"], 4: ["dört bölüm", "4 bölüm"]},
    "music": {"boss": ["boss müziği", "heyecanlı müzik"], "underground": ["yeraltı müziği"], "castle": ["kale müziği"],
              "overworld": ["gündüz müziği", "şen müzik"]},
}
MORE_TR_LISTS = {
    "features": ["çift zıplama özelliği", "havada ikinci zıplama", "iki defa zıplayabilsin"],
}
MORE_TR_NESTED = {
    "speed": {"slow": ["ağır yürüyen kahraman"], "fast": ["ışık hızında koşan", "hızlı bir kahraman"]},
    "jump": {"low": ["kısa zıplayan"], "high": ["uçarcasına zıplayan"]},
    "qblocks": {"mushroom": ["bloktan mantar çıksın", "soru bloklarında mantar olsun"],
                "star": ["soru bloğundan yıldız çıksın", "yıldız veren bloklar"]},
}
for _field, _table in MORE_TR.items():
    for _value, _phrases in _table.items():
        TR.setdefault(_field, {}).setdefault(_value, []).extend(_phrases)
for _field, _table in MORE_TR_NESTED.items():
    for _value, _phrases in _table.items():
        TR[_field][_value].extend(_phrases)
TR["features"].extend(MORE_TR_LISTS["features"])
EN["spikes"] = {0: ["no spikes"], 1: ["a few spikes"], 3: ["lots of spikes"], 5: ["spikes everywhere"]}
EN["flyers"] = {0: ["no flying enemies"], 1: ["a few flying enemies"], 3: ["lots of flying enemies"], 5: ["flying enemies everywhere"]}
EN["blocks"] = {1: ["few blocks"], 3: ["lots of blocks"], 5: ["blocks everywhere"]}
for _field in ("enemies", "coins", "pits", "pipes", "blocks", "flyers", "spikes"):   # "bol / lots of" means 4 (high), the same as the evaluation expects
    for _table in (TR, EN):
        if 3 in _table.get(_field, {}):
            _table[_field].setdefault(4, []).extend(_table[_field].pop(3))
FEATURE_TR = {
    "spring": ["yaylar olsun", "zıplatan yaylar", "üstüne basınca fırlatan yaylar"],
    "dashPad": ["hız zeminleri olsun", "hızlandıran zemin parçaları", "üstünden geçince hızlanılan zeminler"],
    "rings": ["halka sistemi olsun", "vurulunca ölmesin altınları kaybetsin", "halkalı can sistemi"],
    "checkpoint": ["kontrol noktası olsun", "ölünce ortadan devam etsin", "ara kayıt noktası"],
    "ice": ["buzlu zemin olsun", "kaygan buz parçaları", "kayarak ilerlenen buzlar"],
    "movingPlatforms": ["hareketli platformlar olsun", "çukurların üstünde kayan platformlar", "gidip gelen platformlar"],
}
CHARACTER_TR = {"runner": ["turuncu tilki karakter", "tilki kahraman", "hızlı tilki karakteri olsun"]}
RAMPS = {"ramp": ((1, 5), ["kolaydan zora doğru ilerlesin", "giderek zorlaşsın"]),
         "gentle": ((1, 3), ["yavaş yavaş zorlaşsın", "hafif artan zorlukla"]),
         "hard": ((3, 5), ["baştan zor, sonda çok zor", "en başından zorlu olsun"])}
NUMBER_WORDS_TR = {5: "beş", 6: "altı", 7: "yedi", 8: "sekiz", 9: "dokuz", 10: "on", 11: "on bir", 12: "on iki", 13: "on üç", 14: "on dört",
                   15: "on beş", 16: "on altı", 17: "on yedi", 18: "on sekiz", 19: "on dokuz", 20: "yirmi"}
CAMPAIGN_TR = ["{n} seviyeli bir kampanya", "{n} bölümlük macera", "tam {n} seviye olsun"]
MOODS_TR = {"happy": ["neşeli müzik", "şen bir melodi"], "calm": ["sakin müzik", "dinlendirici melodi"],
            "tense": ["gerilimli müzik", "tedirgin edici melodi"], "epic": ["epik müzik", "destansı bir müzik"],
            "mystery": ["gizemli müzik", "esrarengiz melodi"], "spooky": ["ürkütücü müzik", "korkunç bir melodi"]}
TEMPOS_TR = {"slow": ["yavaş tempolu"], "fast": ["hızlı tempolu"]}
PREFIXES = ["Şöyle bir oyun düşünüyorum:", "Bir oyun yapabilir misin?", "Hey Bob,", "Arkadaşlarla oynayacağız,", "Merhaba, bir oyun lazım:",
            "Yeni bir oyun istiyorum,", "Platform oyunu yapalım:"]
SUFFIXES = ["", "", "", " olsun", " lütfen", " Yapabilir misin?", " Teşekkürler!"]
ASCII_FOLD = str.maketrans("ıİşŞçÇğĞöÖüÜ", "iissccggoouu")


ASCII_FOLD_KEEP_CASE = str.maketrans("ıİşŞçÇğĞöÖüÜ", "iIsScCgGoOuU")


def fold(text: str) -> str:
    return text.lower().translate(ASCII_FOLD)


def _width_class(width: int) -> str:
    for name, (lo, hi) in WIDTH_CLASSES.items():
        if lo <= width <= hi:
            return name
    return "medium" if width < 90 else "long"


def _speed_class(v: int) -> str:
    return "slow" if v < 150 else "fast" if v > 190 else "normal"


def _jump_class(v: int) -> str:
    return "low" if v < 400 else "high" if v > 470 else "normal"


# ---- the spec as numbers, and how it reads back ----
def _level0(spec: dict) -> dict:
    return spec["generate"][0]


def _values(field: str, spec: dict):
    """What the spec says about a field (None when it says nothing)."""
    level = _level0(spec)
    hero = spec.get("hero", {})
    if field in ("theme", "title", "time"):
        return spec.get(field)
    if field == "musicStyle":
        style = spec.get("musicStyle") or {}
        return (style.get("mood"), style.get("tempo", "medium"))
    if field == "campaign":
        c = spec.get("campaign")
        return (c.get("count"), c.get("from"), c.get("to")) if c else None
    if field == "difficulty":
        return level.get("difficulty", 2)
    if field == "width":
        return _width_class(level.get("width", 60))
    if field in DENSITIES:
        return level.get(field, 0 if field in ("flyers", "spikes") else 2)
    if field == "features":
        return sorted(spec.get("features", []))
    if field == "levels":
        return len(spec["generate"])
    if field == "qblocks":
        return sorted(spec.get("qblocks", []))
    if field == "hero":
        return {"lives": hero.get("lives"), "speed": _speed_class(hero["speed"]) if "speed" in hero else None,
                "jump": _jump_class(hero["jump"]) if "jump" in hero else None, "character": hero.get("character")}
    return None


def mentions(text: str, field: str, spec: dict) -> bool:
    """Does the text say what the spec holds for this field? (a check on the data itself, in both languages)"""
    text = fold(text)
    v = _values(field, spec)
    if field == "title":
        return bool(v) and fold(v) in text
    if field == "time":
        return str(v) in text
    if field == "hero":
        parts = []
        if v["lives"] is not None:
            parts.append(f"{v['lives']} can" in text or f"{v['lives']} lives" in text or v["lives"] in (1,) and ("tek can" in text or "bir can" in text)
                         or f"{fold(_NUM_WORDS.get(v['lives'], '#'))} can" in text)
        if v["speed"] in ("slow", "fast"):
            parts.append(any(fold(p) in text for p in TR["speed"][v["speed"]]))
        if v["jump"] in ("low", "high"):
            parts.append(any(fold(p) in text for p in TR["jump"][v["jump"]]))
        if v["character"]:
            parts.append(any(fold(p) in text for p in CHARACTER_TR[v["character"]]))
        return bool(parts) and all(parts)
    if field == "campaign":
        n, ft, to = v
        ramp = next(name for name, (pair, _) in RAMPS.items() if pair == (ft, to))
        return (str(n) in text or fold(NUMBER_WORDS_TR[n]) in text) and any(fold(p) in text for p in RAMPS[ramp][1])
    if field == "musicStyle":
        mood, tempo = v
        return any(fold(p) in text for p in MOODS_TR[mood]) and (tempo == "medium" or any(fold(p) in text for p in TEMPOS_TR[tempo]))
    if field == "features":
        def said(name):
            if name == "doubleJump":
                return any(fold(p) in text for p in TR["features"] + EVAL_EXTRA["features"] + EN["features"])
            return any(fold(p) in text for p in FEATURE_TR[name])
        return bool(v) and all(said(name) for name in v)
    if field == "qblocks":
        return all(any(fold(p) in text for p in TR["qblocks"][k]) for k in v)
    phrases = []
    for source in (TR, EN, EVAL_EXTRA):
        entry = source.get(field)
        if isinstance(entry, dict) and v in entry:
            phrases += entry[v]
    return any(fold(p) in text for p in phrases)


_NUM_WORDS = {5: "beş", 3: "üç", 2: "iki", 7: "yedi", 9: "dokuz"}


# ---- sampling a spec ----
def _sample_fields(rng: random.Random, lang: str) -> set:
    probs = {"theme": 0.7, "difficulty": 0.5, "width": 0.35, "features": 0.35, "lives": 0.2, "speed": 0.15, "jump": 0.15,
             "levels": 0.25, "title": 0.25, "time": 0.15, "musicStyle": 0.15, "qblocks": 0.2, "character": 0.12, "campaign": 0.12}
    probs.update({d: 0.3 for d in DENSITIES})
    allowed = {"theme", "difficulty", "width", "features", "levels", "title", "enemies", "coins", "pits", "lives"} if lang == "en" else set(probs)
    chosen = {f for f in allowed if rng.random() < probs[f]}
    if "campaign" in chosen:
        chosen.discard("levels")   # many levels come from a campaign, not from a few generated ones
    if rng.random() < 0.05:
        return set()   # a vague request: "make me a platformer"
    return chosen or {"theme"}


def _build_spec(rng: random.Random, fields: set, held_pairs=None, force_pair=None, english: bool = False) -> dict:
    spec: dict = {"kit": "platformer"}
    theme = difficulty = None
    if force_pair:
        theme, difficulty = force_pair
    if "theme" in fields and theme is None:
        theme = rng.choice(THEMES)
    if "difficulty" in fields and difficulty is None:
        difficulty = rng.randint(1, 5)
    if held_pairs and theme and difficulty and (theme, difficulty) in held_pairs:
        difficulty = next(d for d in (1, 2, 3, 4, 5) if (theme, d) not in held_pairs)
    if theme:
        spec["theme"] = theme
    if "title" in fields:
        spec["title"] = rng.choice(TITLES)
    if "musicStyle" in fields:
        style = {"mood": rng.choice(MOODS)}
        if rng.random() < 0.4:
            style["tempo"] = rng.choice(("slow", "fast"))
        spec["musicStyle"] = style
    if "time" in fields:
        spec["time"] = rng.choice(TIMES)
    hero = {}
    if "lives" in fields:
        hero["lives"] = rng.choice(LIVES)
    if "speed" in fields:
        hero["speed"] = rng.randint(100, 140) if rng.random() < 0.5 else rng.randint(210, 260)
    if "jump" in fields:
        hero["jump"] = rng.randint(320, 370) if rng.random() < 0.5 else rng.randint(500, 600)
    if "character" in fields:
        hero["character"] = "runner"
    if hero:
        spec["hero"] = hero
    if "features" in fields:
        if english:
            spec["features"] = ["doubleJump"]
        else:
            how_many = rng.choices((1, 2, 3), weights=(6, 3, 1))[0]
            spec["features"] = rng.sample(FEATURES_ALL, how_many)
    if "campaign" in fields:
        ramp = rng.choice(list(RAMPS))
        spec["campaign"] = {"count": rng.randint(5, 20), "from": RAMPS[ramp][0][0], "to": RAMPS[ramp][0][1]}
    if "qblocks" in fields:
        spec["qblocks"] = [rng.choice(["mushroom", "star"])]
    count = rng.choice((2, 3, 4)) if "levels" in fields else 1
    base: dict = {}
    if difficulty:
        base["difficulty"] = difficulty
    if "width" in fields:
        lo, hi = WIDTH_CLASSES[rng.choice(list(WIDTH_CLASSES))]
        base["width"] = rng.randint(lo, hi)
    for d in DENSITIES:
        if d in fields:
            pool = (0, 1, 2, 4, 5) if d in ("flyers", "spikes") else (0, 1, 4, 5)   # 3 has no wording any more: "bol" means 4
            value = rng.choice(pool)
            if value or d not in ("flyers", "spikes"):
                base[d] = value   # no flyers or spikes is the default: left out
    levels = []
    for _ in range(count):
        level = {}   # no seed: random digits cannot be learned, and the app picks them (kits.fill_seeds)
        level.update(base)
        levels.append(level)
    spec["generate"] = levels
    return spec


def _mentioned(fields: set) -> list:
    out = set(fields)
    for f in ("lives", "speed", "jump", "character"):
        if f in out:
            out.discard(f)
            out.add("hero")
    return sorted(out)


# ---- writing the sentence ----
def _phrase(rng: random.Random, field: str, spec: dict, lang: str, eval_mode: bool) -> str:
    v = _values(field, spec)
    source = EN if lang == "en" else TR
    if field == "title":
        return rng.choice([f"adı {v} olsun", f'oyunun adı "{v}"']) if lang == "tr" else f'called "{v}"'
    if field == "time":
        return rng.choice([f"{v} saniye süre", f"süre {v} saniye"])
    if field == "features":
        out = []
        for name in v:
            if name == "doubleJump":
                out.append(rng.choice(list(source["features"]) + (EVAL_EXTRA["features"] if eval_mode and lang == "tr" else [])))
            else:
                out.append(rng.choice(FEATURE_TR[name]))
        return ", ".join(out)
    if field == "campaign":
        n, ft, to = v
        ramp = next(name for name, (pair, _) in RAMPS.items() if pair == (ft, to))
        count = NUMBER_WORDS_TR[n] if rng.random() < 0.35 else n   # also spelled out: "on iki bölümlük"
        return f"{rng.choice(CAMPAIGN_TR).format(n=count)}, {rng.choice(RAMPS[ramp][1])}"
    if field == "musicStyle":
        mood, tempo = v
        return rng.choice(MOODS_TR[mood]) + (", " + rng.choice(TEMPOS_TR[tempo]) if tempo != "medium" else "")
    if field == "hero":
        parts = []
        if v["lives"] is not None:
            n = v["lives"]
            word = _NUM_WORDS.get(n, str(n)) if rng.random() < 0.3 else str(n)
            parts.append(f"{n} lives" if lang == "en" else rng.choice([f"{word} can", f"{word} canla başlasın", f"{word} canı olsun",
                                                                         f"{word} can hakkı olsun"]) if n != 1 else
                         rng.choice(["tek canlı", "bir can", "1 can"]))
        for key in ("speed", "jump"):
            if v[key] in ("slow", "fast", "low", "high"):
                parts.append(rng.choice(TR[key][v[key]]))
        if v["character"]:
            parts.append(rng.choice(CHARACTER_TR[v["character"]]))
        return ", ".join(parts)
    if field == "qblocks":
        return rng.choice(TR["qblocks"][v[0]])
    pool = list(source.get(field, {}).get(v, []) or TR[field].get(v, []))
    if eval_mode and lang == "tr":
        pool += EVAL_EXTRA.get(field, {}).get(v, [])
    return rng.choice(pool)


def _describe(rng: random.Random, fields: list, spec: dict, lang: str, eval_mode: bool) -> str:
    clauses = [_phrase(rng, f, spec, lang, eval_mode) for f in fields]
    rng.shuffle(clauses)
    heads = EN_HEADS if lang == "en" else TR_HEADS + (EVAL_HEADS if eval_mode else [])
    if not clauses:
        return rng.choice(["Bir platform oyunu yap.", "Klasik bir oyun olsun.", "Basit bir platform oyunu istiyorum."]) if lang == "tr" \
            else rng.choice(["Make a platformer.", "A simple platform game please."])
    if lang == "en":
        text = f"{rng.choice(heads)} {', '.join(clauses)}."
        return text[0].lower() + text[1:] if rng.random() < 0.1 else text
    style = rng.random()
    if style < 0.4:
        text = f"{rng.choice(heads)} {', '.join(clauses)}."
    elif style < 0.7:   # a chatty request: joined with "ve", maybe a greeting first and a polite ending
        body = clauses[0] if len(clauses) == 1 else f"{', '.join(clauses[:-1])} ve {clauses[-1]}"
        text = f"{rng.choice(PREFIXES)} {body}{rng.choice(SUFFIXES)}"
        text = text if text.endswith(("?", "!")) else text + "."
    elif style < 0.85:   # no greeting, only the wishes
        text = ", ".join(clauses) + rng.choice(["", " olsun", " istiyorum"]) + "."
    else:   # a list
        text = "\n".join(f"- {c}" for c in clauses)
    if rng.random() < 0.1:
        text = text[0].lower() + text[1:]
    if rng.random() < 0.12:   # written on a keyboard without Turkish letters
        text = text.translate(ASCII_FOLD_KEEP_CASE)
    return text


# ---- messages exactly as the app builds them ----
class _Capture:
    def __init__(self):
        self.messages = None

    def chat(self, model, messages, **kwargs):
        self.messages = messages
        return '{"kit": "platformer"}'


def _messages(kind: str, text: str, spec: dict, before: dict | None) -> list:
    cap = _Capture()
    gen = Generator(cap, "m")
    if kind == "create":
        gen.create_spec(text, "platformer")
    else:
        gen.edit_spec(before, text, "platformer")
    return cap.messages + [{"role": "assistant", "content": json.dumps(spec, ensure_ascii=False)}]


def prompt_text(example: dict) -> str:
    return example["description"]


# ---- edits ----
def changed_fields(old: dict, new: dict) -> set:
    out = set()
    for f in ("theme", "title", "musicStyle", "campaign", "time", "features", "qblocks"):
        if old.get(f) != new.get(f):
            out.add(f)
    if old.get("hero", {}) != new.get("hero", {}):
        out.add("hero")
    if len(old["generate"]) != len(new["generate"]):
        out.add("levels")
    a, b = old["generate"][0], new["generate"][0]
    for k in set(a) | set(b):
        if k != "seed" and a.get(k) != b.get(k):
            out.add("width" if k == "width" else k)
    return out


_EDIT_FEATURE = {"spring": ["yaylar ekle", "zıplatan yaylar koy"], "dashPad": ["hız zeminleri ekle", "hızlandıran zeminler koy"],
                 "rings": ["halka sistemi ekle", "vurulunca altınlar gitsin ama ölmeyeyim"], "checkpoint": ["kontrol noktası ekle", "ortada bir kayıt noktası olsun"],
                 "ice": ["buzlu zemin ekle", "kaygan buzlar koy"], "movingPlatforms": ["hareketli platformlar ekle", "çukurlara kayan platform koy"]}
_EDIT_MUSIC = {"happy": ["müziği neşeli yap"], "calm": ["müziği sakinleştir"], "tense": ["müziği gerilimli yap"], "epic": ["müziği epik yap"],
               "mystery": ["müziği gizemli yap"], "spooky": ["müziği ürkütücü yap"]}
_EDIT_THEME = {"sky": ["gündüz olsun", "gökyüzü teması yap"], "cave": ["mağaraya çevir", "mağara teması olsun"],
               "castle": ["kale teması yap"], "night": ["gece olsun", "geceye çevir"], "underwater": ["su altına taşı"],
               "space": ["uzaya taşı"], "forest": ["ormana çevir"]}


def _edit_example(rng: random.Random, spec: dict):
    """(request, new spec, changed field) for one edit that makes sense for this spec."""
    new = json.loads(json.dumps(spec))
    kind = rng.choice(["theme", "features", "harder", "easier", "enemies_up", "no_enemies", "level", "lives", "longer", "feature_add", "feature_add", "music"])
    level = new["generate"]
    if kind == "theme":
        theme = rng.choice([t for t in THEMES if t != spec.get("theme")])
        new["theme"] = theme
        return rng.choice(_EDIT_THEME[theme]), new, "theme"
    if kind == "features" and "doubleJump" not in spec.get("features", []) and len(spec.get("features", [])) < 4:
        new["features"] = spec.get("features", []) + ["doubleJump"]
        return rng.choice(["çift zıplama ekle", "iki kez zıplayabileyim"]), new, "features"
    if kind == "feature_add" and len(spec.get("features", [])) < 4:
        free = [f for f in FEATURE_TR if f not in spec.get("features", [])]
        if free:
            name = rng.choice(free)
            new["features"] = spec.get("features", []) + [name]
            return rng.choice(_EDIT_FEATURE[name]), new, "features"
    if kind == "music":
        mood = rng.choice(MOODS)
        new["musicStyle"] = {"mood": mood}
        return rng.choice(_EDIT_MUSIC[mood]), new, "musicStyle"
    if kind == "harder":
        for lv in level:
            lv["difficulty"] = min(5, lv.get("difficulty", 2) + 1)
        return rng.choice(["oyunu zorlaştır", "biraz daha zor olsun"]), new, "difficulty"
    if kind == "easier":
        for lv in level:
            lv["difficulty"] = max(1, lv.get("difficulty", 2) - 1)
        return rng.choice(["oyunu kolaylaştır", "biraz daha kolay olsun"]), new, "difficulty"
    if kind == "enemies_up":
        for lv in level:
            lv["enemies"] = min(5, lv.get("enemies", 2) + 1)
        return rng.choice(["daha çok düşman koy", "düşman sayısını artır"]), new, "enemies"
    if kind == "no_enemies":
        for lv in level:
            lv["enemies"] = 0
        return rng.choice(["düşmanları kaldır", "hiç düşman olmasın"]), new, "enemies"
    if kind == "level" and len(level) < 4:
        extra = dict(level[-1])
        extra.pop("seed", None)
        level.append(extra)
        return rng.choice(["bir seviye daha ekle", "yeni bir bölüm ekle"]), new, "levels"
    if kind == "lives":
        n = rng.choice([c for c in LIVES if c != spec.get("hero", {}).get("lives")])
        new.setdefault("hero", {})["lives"] = n
        return f"canı {n} yap", new, "hero"
    for lv in level:   # "longer" (and what the other kinds fall back to when they do not apply)
        lv["width"] = min(160, int(lv.get("width", 60) * 1.5))
    return rng.choice(["seviyeyi uzat", "bölüm daha uzun olsun"]), new, "width"


# ---- the dataset ----
def build_examples(n_train: int = 600, n_eval: int = 100, seed: int = 0):
    rng = random.Random(seed)
    train, held = [], []

    def make(index: int, eval_mode: bool):
        lang = "en" if rng.random() < 0.15 else "tr"
        if rng.random() < 0.2:   # an edit of a game that was made from a spec
            base_fields = _sample_fields(rng, "tr") or {"theme"}
            base_fields.discard("campaign")   # an edit starts from a simple game
            base = _build_spec(rng, base_fields, held_pairs=None if eval_mode else HELD_PAIRS)
            request, new, field = _edit_example(rng, base)
            if changed_fields(base, new) == set():
                return make(index, eval_mode)
            return {"id": index, "kind": "edit", "lang": "tr", "request": request, "description": request, "before": base, "spec": new,
                    "mentioned": [field], "messages": _messages("edit", request, new, base)}
        fields = _sample_fields(rng, lang)
        force = None
        if eval_mode and "theme" in fields and "difficulty" in fields:
            force = rng.choice(sorted(HELD_PAIRS))
        spec = _build_spec(rng, fields, held_pairs=None if eval_mode else HELD_PAIRS, force_pair=force, english=lang == "en")
        mentioned = _mentioned(fields)
        description = _describe(rng, mentioned, spec, lang, eval_mode)
        return {"id": index, "kind": "create", "lang": lang, "description": description, "spec": spec, "mentioned": mentioned,
                "messages": _messages("create", description, spec, None)}

    for i in range(n_train):
        train.append(make(i, False))
    for i in range(n_eval):
        held.append(make(n_train + i, True))
    return train, held


# ---- judging an answer ----
def score(pred, target: dict, mentioned) -> dict:
    """How many of the things the prompt asked for the answer got right. `pred` is a parsed spec (or None)."""
    if not isinstance(pred, dict) or pred.get("kit") != "platformer" or not isinstance(pred.get("generate"), list) \
            or not pred["generate"] or not all(isinstance(x, dict) for x in pred["generate"]):
        return {"valid": False, "accuracy": 0.0, "fields": {}}
    fields = {}
    for field in mentioned:
        try:
            fields[field] = _values(field, pred) == _values(field, target)
        except (KeyError, TypeError, ValueError, AttributeError):
            fields[field] = False
    accuracy = sum(fields.values()) / len(fields) if fields else 1.0
    return {"valid": True, "accuracy": accuracy, "fields": fields}


# ---- hand-written prompts (the honest test: nobody generated these from a spec) ----
HAND_EVAL = [
    {"prompt": "Karanlık bir mağarada geçen, çok düşmanlı ve zor bir platform oyunu", "expect": {"theme": "cave", "enemies": "high", "difficulty": 4}},
    {"prompt": "Kızım için çok kolay, hiç düşman olmayan, bol altınlı bir oyun", "expect": {"difficulty": 1, "enemies": "none", "coins": "high"}},
    {"prompt": "Gece vakti geçsin, çift zıplama olsun, bir de uçan düşmanlar", "expect": {"theme": "night", "features": ["doubleJump"], "flyers": "some"}},
    {"prompt": "Uzayda geçen iki seviyeli bir koşu oyunu istiyorum", "expect": {"theme": "space", "levels": 2}},
    {"prompt": "Orman temalı, uzun bir seviye, bol altın ve az düşman", "expect": {"theme": "forest", "width_class": "long", "coins": "high", "enemies": "low"}},
    {"prompt": "su altında geçen sakin bir oyun, dikenler olmasın", "expect": {"theme": "underwater", "spikes": "none"}},
    {"prompt": "Tek canlı, çok zor, hiç altın yok", "expect": {"lives": 1, "difficulty": 5, "coins": "none"}},
    {"prompt": "Kale içinde geçen, gerilimli müzikli bir macera", "expect": {"theme": "castle", "music": "tense"}},
    {"prompt": "Üç bölümlü, her bölümü kısa olan bir oyun", "expect": {"levels": 3, "width_class": "short"}},
    {"prompt": "Gökyüzünde, bol boru ve çok blok olan, rahat zorlukta bir oyun", "expect": {"theme": "sky", "pipes": "high", "blocks": "high"}},
    {"prompt": "Çukurlarla dolu, zorlu bir mağara", "expect": {"theme": "cave", "pits": "high", "difficulty": 4}},
    {"prompt": "Klasik bir platform oyunu yap", "expect": {}},
    {"prompt": "Kısa, kolay, çocuklar için bir platform oyunu; çift zıplama olsun", "expect": {"width_class": "short", "difficulty": 1, "features": ["doubleJump"]}},
    {"prompt": "Dört seviyeli bir orman macerası, giderek bol düşman çıksın", "expect": {"theme": "forest", "levels": 4}},
    {"prompt": "A night platformer with many enemies and double jump", "expect": {"theme": "night", "enemies": "high", "features": ["doubleJump"]}},
    {"prompt": "I want an easy cave level with lots of coins", "expect": {"theme": "cave", "difficulty": 2, "coins": "high"}},
    {"prompt": "Kale temalı, çok zor, diken ve uçan düşman dolu", "expect": {"theme": "castle", "difficulty": 5, "spikes": "high", "flyers": "some"}},
    {"prompt": "Gündüz, hiç çukur ve diken olmayan, düz ve rahat bir bölüm", "expect": {"theme": "sky", "pits": "none", "spikes": "none"}},
    {"prompt": "Dokuz can hakkı olan, uzay temalı oyun", "expect": {"theme": "space", "lives": 9}},
    {"prompt": "Okyanus dünyasında, orta zorlukta, az düşman", "expect": {"theme": "underwater", "difficulty": 3, "enemies": "low"}},
    {"prompt": "çok uzun bir seviye olsun, düşman dolu ve altın dolu", "expect": {"width_class": "huge", "enemies": "high", "coins": "high"}},
    {"prompt": "Yeşil bir ormanda iki seviye, ikisi de kolay", "expect": {"theme": "forest", "levels": 2, "difficulty": 2}},
    {"prompt": "Gece teması, kolay, bol blok ve tuğla", "expect": {"theme": "night", "difficulty": 2, "blocks": "high"}},
    {"prompt": "Beş canlı, hızlı koşan bir kahraman olsun", "expect": {"lives": 5}},
    {"prompt": "Hızlı koşan, yayları ve hız zeminleri olan bir koşu oyunu", "expect": {"features": ["spring", "dashPad"]}},
    {"prompt": "Karlı bir yerde kayarak ilerlediğimiz, buzlu bir oyun", "expect": {"features": ["ice"]}},
    {"prompt": "Ölünce en baştan başlamayayım, ortada bir kayıt yeri olsun", "expect": {"features": ["checkpoint"]}},
    {"prompt": "On iki bölümlük, kolaydan zora giden bir kampanya", "expect": {"campaign": 12}},
    {"prompt": "Turuncu tilkiyle oynadığım, esrarengiz müzikli bir oyun", "expect": {"character": "runner", "music": "mystery"}},
    {"prompt": "Çukurların üstünde gidip gelen platformlar olsun", "expect": {"features": ["movingPlatforms"]}},
    {"prompt": "Vurulunca ölmeyeyim, sadece altınlarım gitsin", "expect": {"features": ["rings"]}},
    {"prompt": "Korkunç müzikli, gece teması, on beş seviyelik bir macera", "expect": {"theme": "night", "music": "spooky", "campaign": 15}},
]


def expect_ok(pred_spec, expect: dict) -> dict:
    """Which of the hand-written expectations the predicted spec meets."""
    out = {}
    if not isinstance(pred_spec, dict) or not isinstance(pred_spec.get("generate"), list) or not pred_spec["generate"]:
        return {k: False for k in expect}
    for key, want in expect.items():
        try:
            if key == "theme":
                got = pred_spec.get("theme", "sky")
                out[key] = got == want
            elif key == "music":
                out[key] = (pred_spec.get("musicStyle") or {}).get("mood") == want
            elif key == "character":
                out[key] = (pred_spec.get("hero") or {}).get("character") == want
            elif key == "campaign":
                out[key] = (pred_spec.get("campaign") or {}).get("count") == want
            elif key == "features":
                out[key] = sorted(pred_spec.get("features", [])) == sorted(want)
            elif key == "levels":
                out[key] = len(pred_spec["generate"]) == want
            elif key == "lives":
                out[key] = pred_spec.get("hero", {}).get("lives") == want
            elif key == "width_class":
                out[key] = _width_class(_level0(pred_spec).get("width", 60)) == want
            else:
                got = _values(key, pred_spec)
                out[key] = (got == want if isinstance(want, int) else got == 0 if want == "none" else got >= 1 if want == "some"
                            else got <= 1 if want == "low" else got >= 4 if want == "high" else False)
        except (KeyError, TypeError, ValueError, AttributeError):
            out[key] = False
    return out
