"""Rules that read the user's description and set what it clearly says in a platformer spec, whatever the small model wrote.
A rule only fires on an unmistakable word (a stem and, for amounts, the thing it counts); when the description is unclear
the model's spec stays as it is. They cost nothing and need no training, so a new wording is one line here."""
import re

_ASCII = str.maketrans("ıİşŞçÇğĞöÖüÜ", "iissccggoouu")
_NUMBERS = {"iki": 2, "uc": 3, "dort": 4, "bes": 5, "alti": 6, "yedi": 7, "sekiz": 8, "dokuz": 9, "on": 10, "on bir": 11, "on iki": 12,
            "on uc": 13, "on dort": 14, "on bes": 15, "on alti": 16, "on yedi": 17, "on sekiz": 18, "on dokuz": 19, "yirmi": 20}
_NUMBER = "|".join(sorted(_NUMBERS, key=len, reverse=True)) + r"|\d+"

THEMES = {"sky": r"gokyuz|gunduz|bulut", "cave": r"magara|yeralti", "castle": r"\bkale|\bsato", "night": r"\bgece\b|\bgecesi|yildizli gece",
          "underwater": r"su alti|\bdeniz|okyanus", "space": r"\buzay|galaksi", "forest": r"\borman"}
FEATURES = {"spring": r"\byay(lar|li)?\b", "dashPad": r"hiz zemin|hizlandiran zemin", "rings": r"\bhalka",
            "checkpoint": r"kontrol nokta|checkpoint|ara kayit", "ice": r"\bbuz|kaygan zemin",
            "movingPlatforms": r"hareketli platform|kayan platform|giden platform", "doubleJump": r"cift ziplama|double jump|iki kez ziplay"}
MOODS = {"mystery": r"gizem|esrarengiz", "happy": r"neseli|\bsen muzik|\bsen melodi", "calm": r"sakin|dinlendirici", "tense": r"gerilim|tedirgin",
         "epic": r"\bepik|destans", "spooky": r"urkutucu|korkunc muzik|korkunc melodi"}
# what is counted: a noun stem for each density field (flying enemies are matched first and removed from the text)
THINGS = {"coins": r"altin", "pits": r"cukur", "pipes": r"\bboru", "blocks": r"\bblok|\btugla", "enemies": r"dusman", "spikes": r"diken"}
MANY, FEW = r"(?:bol|cok|epey|bir suru|bir yigin)", r"(?:az|birkac|tek tuk)"


def _fold(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().translate(_ASCII))


def _without_titles(text: str) -> str:
    """A title in quotes is a name, not a wish: "Orman Macerası" is no forest theme."""
    return re.sub(r'"[^"]*"|“[^”]*”', " ", text)


def _number(word: str) -> int:
    return int(word) if word.isdigit() else _NUMBERS[word]


def _negated(text: str, end: int) -> bool:
    return re.match(r"\s*(?:\w+\s+)?(?:olmasin|istemiyorum|yok\b|istemem|olmayacak)", text[end:end + 30]) is not None


def _amount(text: str, noun: str):
    """0-5 for how much of a thing the text asks for, or None when it says nothing about it."""
    if re.search(rf"(?:{noun})\w*\s+(?:olmasin|yok\b|istemiyorum)|\bhic\s+(?:\w+\s+)?(?:{noun})|(?:{noun})s[iu]z", text):
        return 0
    if re.search(rf"{FEW}\s+(?:\w+\s+)?(?:{noun})", text):
        return 1
    if re.search(rf"{MANY}\s+(?:\w+\s+)?(?:{noun})|(?:{noun})\w*\s+{MANY}\b", text):
        return 4
    return None


def _difficulty(text: str):
    """1-5 when the text names one level of difficulty; None for a ramp (easy to hard), a negation or no word at all."""
    if re.search(r"kolaydan zora|giderek|yavas yavas|olmayan|degil|olmasin", text):
        return None
    for value, rx in ((3, r"\borta\w* zorluk|dengeli|ne kolay ne zor|ortalama"), (1, r"cok kolay|en kolay|cocuklar icin"),
                      (5, r"cok zor|en zor|acimasiz|kabus"), (2, r"\bkolay\b|\brahat\b|kolay zorluk"), (4, r"\bzor\b|\bzorlu\b|zorlayici")):
        if re.search(rx, text):
            return value
    return None


def apply(spec: dict, description: str) -> dict:
    """The spec with what the description clearly says set in it (changed in place and returned)."""
    text = _fold(_without_titles(description or ""))
    levels = [lv for lv in spec.get("generate") or [] if isinstance(lv, dict)]
    found = [name for name, rx in THEMES.items() if re.search(rx, text)]
    if len(found) == 1:
        spec["theme"] = found[0]
    if re.search(r"\btilki", text):
        spec.setdefault("hero", {})["character"] = "runner"
    features = list(spec.get("features") or [])
    for name, rx in FEATURES.items():
        match = re.search(rx, text)
        if match and not _negated(text, match.end()) and name not in features and len(features) < 6:
            features.append(name)
    if features:
        spec["features"] = features
    if re.search(r"muzik|melodi", text):
        moods = [name for name, rx in MOODS.items() if re.search(rx, text)]
        if len(moods) == 1:
            spec["musicStyle"] = {**(spec.get("musicStyle") or {}), "mood": moods[0]}
    count = re.search(rf"\b({_NUMBER})\s+(?:bolum|seviye)", text)
    if count and 5 <= _number(count.group(1)) <= 20:
        spec["campaign"] = {**(spec.get("campaign") or {}), "count": _number(count.group(1))}
    lives = re.search(rf"\b({_NUMBER}|tek|bir)\s+can(?:li|\b)", text)
    if lives:
        spec.setdefault("hero", {})["lives"] = 1 if lives.group(1) in ("tek", "bir") else _number(lives.group(1))
    difficulty = _difficulty(text)
    for level in levels:
        if difficulty:
            level["difficulty"] = difficulty
    plain = re.sub(r"ucan dusman\w*", " ", text)
    flyers = _amount(text.replace("ucan dusman", "ucandusman"), "ucandusman")
    for field, noun in THINGS.items():
        amount = _amount(plain, noun)
        for level in levels:
            if amount is not None:
                level[field] = amount
            if field == "enemies" and flyers is not None:
                level["flyers"] = flyers
    return spec


SHOOTER_FEATURES = {"shield": r"\bkalkan|\bshield", "bomb": r"\bbomba", "rapid": r"hizli ates|seri ates|\brapid"}   # three-way fire is ship.fire, not a feature
SHOOTER_ENEMIES = {"drifter": r"suzulen|\bdrifter", "zigzag": r"zigzag|kivrilan|ziczac", "shooter": r"ates (?:eden|acan)(?:\s+(?!gemi)\w+){0,2}\s+dusman|mermi atan dusman|\bshooter",
                   "kamikaze": r"kamikaze|ustune atilan|intihar", "tank": r"\btank|dayanikli dusman"}


def apply_shooter(spec: dict, description: str) -> dict:
    """The same kind of rules for the shooter: what the description clearly says is set in the spec, the rest stays as the model wrote it."""
    text = _fold(_without_titles(description or ""))
    found = [name for name, rx in THEMES.items() if re.search(rx, text)]
    if len(found) == 1:
        spec["theme"] = found[0]
    features = list(spec.get("features") or [])
    for name, rx in SHOOTER_FEATURES.items():
        match = re.search(rx, text)
        if match and not _negated(text, match.end()) and name not in features:
            features.append(name)
    if features:
        spec["features"] = features
    kinds = [name for name, rx in SHOOTER_ENEMIES.items() if re.search(rx, text) and not _negated(text, re.search(rx, text).end())]
    if kinds:   # only ever adds: a keyword list is never the whole story, the model's list stays
        spec["enemies"] = list(dict.fromkeys(list(spec.get("enemies") or []) + kinds))
    if re.search(r"patronsuz|patron olmasin|patron yok|patron istemiyorum|bosssuz", text):
        spec["boss"] = False
    elif re.search(r"\bpatron|\bboss", text):
        spec["boss"] = True
    if re.search(r"muzik|melodi", text):
        moods = [name for name, rx in MOODS.items() if re.search(rx, text)]
        if len(moods) == 1:
            spec["musicStyle"] = {**(spec.get("musicStyle") or {}), "mood": moods[0]}
    count = re.search(rf"\b({_NUMBER})\s+dalga", text)
    if count and 3 <= _number(count.group(1)) <= 20:
        spec["waves"] = {**(spec.get("waves") or {}), "count": _number(count.group(1))}
    lives = re.search(rf"\b({_NUMBER}|tek|bir)\s+can(?:li|\b)", text)
    if lives:
        spec.setdefault("ship", {})["lives"] = 1 if lives.group(1) in ("tek", "bir") else _number(lives.group(1))
    if re.search(r"cift ates|iki ates", text):
        spec.setdefault("ship", {})["fire"] = "double"
    elif re.search(r"tek ates", text):
        spec.setdefault("ship", {})["fire"] = "single"
    elif re.search(r"uc yone ates|yayilan ates", text):
        spec.setdefault("ship", {})["fire"] = "spread"
    difficulty = _difficulty(text)
    if difficulty:
        spec["difficulty"] = difficulty
    return spec


SANDBOX_BIOMES = {"forest": r"\borman", "desert": r"\bcol\b|\bcol dunya|kumluk", "snow": r"\bkar\b|\bkarli|\bkis\b|buzul", "plains": r"\bova\b|duzluk|cayir"}
SANDBOX_SIZES = {"small": r"\bkucuk|\bminik|\bufak", "large": r"\bbuyuk|\bdevasa|\bgenis"}


def _level03(text: str, noun: str):
    """0-3 for how much of a thing a world has: 0 none, 1 a little, 3 a lot; None when the text says nothing."""
    if re.search(rf"(?:{noun})\w*\s+(?:olmasin|yok\b)|\bhic\s+(?:{noun})|(?:{noun})s[iu]z", text):
        return 0
    if re.search(rf"{FEW}\s+(?:\w+\s+)?(?:{noun})", text):
        return 1
    if re.search(rf"{MANY}\s+(?:\w+\s+)?(?:{noun})|(?:{noun})\w*\s+dolu|(?:{noun})\w*\s+{MANY}\b", text):
        return 3
    return None


def apply_sandbox(spec: dict, description: str) -> dict:
    """The same kind of rules for the sandbox world: only unmistakable words, and what the model wrote is only ever added to or set by them."""
    text = _fold(_without_titles(description or ""))
    found = [name for name, rx in SANDBOX_BIOMES.items() if re.search(rx, text)]
    if len(found) == 1:
        spec["biome"] = found[0]
    sizes = [name for name, rx in SANDBOX_SIZES.items() if re.search(rx, text)]
    if len(sizes) == 1:
        spec["size"] = sizes[0]
    for field, noun in (("caves", r"magara"), ("ores", r"maden|cevher"), ("trees", r"agac")):
        value = _level03(text, noun)
        if value is not None:
            spec[field] = value
    if re.search(r"gol\w*\s+(?:olmasin|yok)|golsuz|su olmasin|kuru bir dunya", text):
        spec["lakes"] = False
    elif re.search(r"\bgol|\bnehir|\bdeniz", text):
        spec["lakes"] = True
    if re.search(r"gece\s*(?:ve|-)?\s*gunduz|gunduz\s*(?:ve|-)?\s*gece|\bdongu", text):
        spec["time"] = "cycle"
    elif re.search(r"hep gece|surekli gece", text):   # "dark cave" is not a night
        spec["time"] = "night"
    elif re.search(r"hep gunduz|surekli gunduz", text):
        spec["time"] = "day"
    features = list(spec.get("features") or [])
    for name, rx in (("fly", r"\bucabil|\bucma\b|\bucmak|ucus modu"), ("sprint", r"\bkosabil|\bhizli yuru|\bkosma")):
        match = re.search(rx, text)
        if match and not _negated(text, match.end()) and name not in features:
            features.append(name)
    if features:
        spec["features"] = features
    if re.search(r"muzik|melodi", text):
        moods = [name for name, rx in MOODS.items() if re.search(rx, text)]
        if len(moods) == 1:
            spec["musicStyle"] = {**(spec.get("musicStyle") or {}), "mood": moods[0]}
    return spec


FPS_THEMES = {"bunker": r"siginak|\bbunker", "space": r"uzay istasyon|uzay gemisinde|uzay ussu", "ruins": r"harabe|antik|kalinti", "lab": r"laboratuvar|\blab\b", "factory": r"fabrika|endustri"}
FPS_WEAPONS = {"pistol": r"tabanca|\bpistol", "shotgun": r"pompali|\bshotgun", "rifle": r"tufek|otomatik silah|\brifle", "magnum": r"magnum|guclu tek atis"}
FPS_ENEMIES = {"guard": r"nobetci|muhafiz|\basker", "runner": r"kosucu|zombi|yaklasip vuran", "sniper": r"keskin nisanci|\bsniper", "brute": r"\bdev\b|\biri dusman|agir dusman|\bbrute", "turret": r"\btaret|sabit silah"}


def apply_fps(spec: dict, description: str) -> dict:
    """The same kind of rules for the first person shooter: only unmistakable words, and what the model wrote is only ever added to or set by them."""
    text = _fold(_without_titles(description or ""))
    found = [name for name, rx in FPS_THEMES.items() if re.search(rx, text)]
    if len(found) == 1:
        spec["theme"] = found[0]
    for field, table in (("weapons", FPS_WEAPONS), ("enemies", FPS_ENEMIES)):
        names = [n for n, rx in table.items() if re.search(rx, text) and not _negated(text, re.search(rx, text).end())]
        if names:   # only ever adds: a keyword list is never the whole story, the model's list stays
            spec[field] = list(dict.fromkeys(list(spec.get(field) or []) + names))
    if re.search(r"patronsuz|patron olmasin|patron yok|patron istemiyorum|bosssuz", text):
        spec["boss"] = False
    elif re.search(r"\bpatron|\bboss", text):
        spec["boss"] = True
    if re.search(r"valorant|taktik|spike|tur tur|\btaktiksel", text):
        spec["mode"] = "tactical"
    elif re.search(r"\barena|dalga dalga|hayatta kal", text):
        spec["mode"] = "arena"
    elif re.search(r"kampanya|bolumler", text):
        spec["mode"] = "campaign"
    maps = [n for n, rx in (("depo", r"\bdepo"), ("liman", r"\bliman"), ("kale", r"\bkale\b"), ("tunel", r"\btunel")) if re.search(rx, text)]
    if len(maps) == 1 and spec.get("mode") in ("arena", "tactical"):
        spec["map"] = maps[0]
    if re.search(r"bol mermi|sinirsiz mermi|mermi bol", text):
        spec["ammo"] = "plenty"
    elif re.search(r"az mermi|kit mermi|mermi az|mermi kit", text):
        spec["ammo"] = "scarce"
    count = re.search(rf"\b({_NUMBER})\s+bolum", text)
    if count and 1 <= _number(count.group(1)) <= 6:
        spec["levels"] = _number(count.group(1))
    sizes = {"small": r"\bkucuk|\bminik|\bufak", "large": r"\bbuyuk|\bdevasa|\bgenis"}
    which = [n for n, rx in sizes.items() if re.search(rx, text)]
    if len(which) == 1:
        spec["size"] = which[0]
    features = list(spec.get("features") or [])
    for name, rx in (("regen", r"can yenilen|can dolsun|iyilesen|\bregen"), ("armor", r"zirhla basla|zirhli basla|zirh ile basla"), ("sprint", r"hizli kos|kosabil")):
        match = re.search(rx, text)
        if match and not _negated(text, match.end()) and name not in features:
            features.append(name)
    if features:
        spec["features"] = features
    if re.search(r"muzik|melodi", text):
        moods = [name for name, rx in MOODS.items() if re.search(rx, text)]
        if len(moods) == 1:
            spec["musicStyle"] = {**(spec.get("musicStyle") or {}), "mood": moods[0]}
    difficulty = _difficulty(text)
    if difficulty:
        spec["difficulty"] = difficulty
    return spec


RACE_THEMES = {"city": r"sehir|sokak|\bkent\b|asfalt", "desert": r"\bcol(de|un|u|ler|lerde)?\b|\bkum\b|\bkumda", "forest": r"orman|dag yolu|\bagac", "night": r"\bgece|karanlik"}
RACE_CARS = {"muscle": r"kas araba|muscle|\bv8\b|guclu araba", "rally": r"ralli|rally|toprak yolu", "sport": r"spor araba|sport|formula"}
RACE_COLORS = {"red": r"kirmizi", "blue": r"\bmavi", "yellow": r"\bsari", "green": r"\byesil"}


def apply_race(spec: dict, description: str) -> dict:
    """The same kind of rules for the racing game: only unmistakable words, and what the model wrote is only ever added to or set by them."""
    text = _fold(_without_titles(description or ""))
    for field, table in (("theme", RACE_THEMES), ("car", RACE_CARS)):
        found = [name for name, rx in table.items() if re.search(rx, text)]
        if len(found) == 1:
            spec[field] = found[0]
    colors = [name for name, rx in RACE_COLORS.items() if re.search(rx + r"\s+(araba|arac|otomobil)", text)]
    if len(colors) == 1:
        spec["color"] = colors[0]
    laps = re.search(rf"\b({_NUMBER})\s+tur\b", text)
    if laps and 1 <= _number(laps.group(1)) <= 9:
        spec["laps"] = _number(laps.group(1))
    rivals = re.search(rf"\b({_NUMBER})\s+(rakip|rakipli|arabaya karsi|yarismaci)", text)
    if rivals and 1 <= _number(rivals.group(1)) <= 7:
        spec["rivals"] = _number(rivals.group(1))
    if re.search(r"kisa pist|kucuk pist|minik pist", text):
        spec["length"] = "small"
    elif re.search(r"uzun pist|buyuk pist|genis pist", text):
        spec["length"] = "large"
    features = list(spec.get("features") or [])
    for name, rx in (("nitro", r"nitro|turbo|hiz patlamasi"), ("grip", r"iyi yol tutus|kaymasin|yol tutsun")):
        match = re.search(rx, text)
        if match and not _negated(text, match.end()) and name not in features:
            features.append(name)
    if features:
        spec["features"] = features
    if re.search(r"muzik|melodi", text):
        moods = [name for name, rx in MOODS.items() if re.search(rx, text)]
        if len(moods) == 1:
            spec["musicStyle"] = {**(spec.get("musicStyle") or {}), "mood": moods[0]}
    difficulty = _difficulty(text)
    if difficulty:
        spec["difficulty"] = difficulty
    return spec
