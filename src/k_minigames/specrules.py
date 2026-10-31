"""Rules that read the user's description and set what it clearly says in a platformer spec, whatever the small model wrote.
A rule only fires on an unmistakable word (a stem and, for amounts, the thing it counts); when the description is unclear
the model's spec stays as it is. They cost nothing and need no training, so a new wording is one line here."""
import re

_ASCII = str.maketrans("ıİşŞçÇğĞöÖüÜ", "iissccggoouu")
_NUMBERS = {"iki": 2, "uc": 3, "dort": 4, "bes": 5, "alti": 6, "yedi": 7, "sekiz": 8, "dokuz": 9, "on": 10, "on bir": 11, "on iki": 12,
            "on uc": 13, "on dort": 14, "on bes": 15, "on alti": 16, "on yedi": 17, "on sekiz": 18, "on dokuz": 19, "yirmi": 20}
_NUMBER = "|".join(sorted(_NUMBERS, key=len, reverse=True)) + r"|\d+"

THEMES = {"sky": r"gokyuz|gunduz|bulut", "cave": r"magara|yeralti", "castle": r"\bkale|\bsato", "night": r"\bgece\b|\bgecesi|yildiz",
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


def _number(word: str) -> int:
    return int(word) if word.isdigit() else _NUMBERS[word]


def _negated(text: str, end: int) -> bool:
    return re.match(r"\s*(?:\w+\s+)?(?:olmasin|istemiyorum|yok\b|istemem|olmayacak)", text[end:end + 30]) is not None


def _amount(text: str, noun: str):
    """0-5 for how much of a thing the text asks for, or None when it says nothing about it."""
    if re.search(rf"(?:{noun})\w*\s+(?:olmasin|yok\b|istemiyorum)|\bhic\s+(?:\w+\s+)?(?:{noun})|(?:{noun})suz", text):
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
    for value, rx in ((3, r"orta\w* zorluk|dengeli|ne kolay ne zor|ortalama"), (1, r"cok kolay|en kolay|cocuklar icin"),
                      (5, r"cok zor|en zor|acimasiz|kabus"), (2, r"kolay|rahat|kolay zorluk"), (4, r"zor|zorlu|zorlayici")):
        if re.search(rx, text):
            return value
    return None


def apply(spec: dict, description: str) -> dict:
    """The spec with what the description clearly says set in it (changed in place and returned)."""
    text = _fold(description or "")
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
