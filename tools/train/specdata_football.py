"""Training and evaluation data for the football kit (CPU only); the shared maker is specdata_generic.py.

  examples, held = build_football_examples(600, 100, seed=0)"""
import specdata_generic as sg

THEMES = ("grass", "night", "indoor", "street")
COLORS = ("red", "blue", "yellow", "green", "white", "black", "orange", "purple")
COLOR_TR = {"red": "kırmızı", "blue": "mavi", "yellow": "sarı", "green": "yeşil", "white": "beyaz", "black": "siyah", "orange": "turuncu", "purple": "mor"}
FEATURES = ("powershot", "sprint")
TITLES = ("Mahalle Maçı", "Final Gecesi", "Şampiyonlar Ligi", "Halı Saha", "Derbi", "Altın Gol", "Sokak Futbolu")
NUM = {2: "iki", 3: "üç", 4: "dört", 5: "beş", 6: "altı", 7: "yedi", 8: "sekiz"}

WORDS = {
    "theme": {"grass": ["çim sahada oynansın", "stadyum teması", "güneşli bir çim sahada"], "night": ["gece maçı olsun", "ışıklar altında gece maçı", "gece teması"],
              "indoor": ["kapalı salonda oynansın", "salon futbolu olsun", "futsal salonunda"], "street": ["sokakta oynansın", "mahalle arasında asfalt sahada", "sokak futbolu teması"]},
    "difficulty": {1: ["çok kolay", "en kolay zorlukta"], 2: ["kolay", "rahat bir zorlukta"], 3: ["orta zorlukta", "dengeli zorlukta"], 4: ["zor", "zorlayıcı"], 5: ["çok zor", "acımasız zorlukta"]},
    "keeper": {True: ["kaleci olsun", "kalecili"], False: ["kalecisiz olsun", "kaleci olmasın"]},
    "features": {"powershot": ["basılı tutarak güçlü şut", "güçlü şut özelliği"], "sprint": ["uzun koşabileyim", "sürekli koşma özelliği"]},
}


def sample(rng, f, spec):
    if f == "title":
        return rng.choice(TITLES)
    if f == "theme":
        return rng.choice(THEMES)
    if f == "difficulty":
        return rng.randint(1, 5)
    if f == "teamSize":
        return rng.randint(3, 8)
    if f == "duration":
        return rng.choice((60, 120, 180, 240, 300))
    if f == "home":
        return rng.choice(COLORS)
    if f == "away":
        return rng.choice([c for c in COLORS if c != spec.get("home")])
    if f == "keeper":
        return rng.random() < 0.5
    if f == "features":
        return rng.sample(FEATURES, rng.choice((1, 1, 2)))
    raise KeyError(f)


def phrase(rng, f, spec):
    if f == "title":
        return f'adı "{spec["title"]}" olsun'
    if f == "teamSize":
        n = spec["teamSize"]
        word = NUM.get(n, str(n)) if rng.random() < 0.4 else str(n)
        return rng.choice([f"{word} kişilik takımlar", f"takımlar {word} kişi olsun", f"{word}'e {word} maç"]) if rng.random() < 0.9 else f"{word} kişilik"
    if f == "duration":
        minutes = spec["duration"] // 60
        word = NUM.get(minutes, str(minutes)) if rng.random() < 0.4 else str(minutes)
        return rng.choice([f"maç {word} dakika sürsün", f"{word} dakikalık maç", f"{word} dakika oynansın"])
    if f == "home":
        return rng.choice([f"benim takımım {COLOR_TR[spec['home']]} formalı olsun", f"{COLOR_TR[spec['home']]} formalı takımla oynayayım"])
    if f == "away":
        return rng.choice([f"rakip {COLOR_TR[spec['away']]} formalı olsun", f"karşı takım {COLOR_TR[spec['away']]} olsun"])
    if f == "features":
        return ", ".join(rng.choice(WORDS["features"][x]) for x in spec["features"])
    return None


def edit(rng, spec):
    new = {**spec}
    kind = rng.choice(["duration", "teamSize", "harder", "easier", "theme", "keeper", "power"])
    if kind == "duration":
        d = rng.choice([x for x in (60, 120, 180, 240, 300) if x != new.get("duration")])
        new["duration"] = d
        return f"maç {d // 60} dakika sürsün", new, "duration"
    if kind == "teamSize":
        n = rng.choice([x for x in range(3, 9) if x != new.get("teamSize")])
        new["teamSize"] = n
        return f"takımlar {n} kişilik olsun", new, "teamSize"
    if kind == "harder" and new.get("difficulty", 3) < 5:
        new["difficulty"] = new.get("difficulty", 3) + 1
        return rng.choice(["rakip daha güçlü olsun", "biraz daha zor olsun"]), new, "difficulty"
    if kind == "easier" and new.get("difficulty", 3) > 1:
        new["difficulty"] = new.get("difficulty", 3) - 1
        return rng.choice(["rakip biraz zayıflasın", "biraz daha kolay olsun"]), new, "difficulty"
    if kind == "keeper":
        new["keeper"] = not new.get("keeper", True)
        return ("kaleci olsun" if new["keeper"] else "kaleciyi kaldır"), new, "keeper"
    if kind == "power":
        if "powershot" not in new.get("features", []):
            new["features"] = new.get("features", []) + ["powershot"]
            return rng.choice(["güçlü şut ekle", "basılı tutarak şut atabileyim"]), new, "features"
    t = rng.choice([x for x in THEMES if x != new.get("theme")])
    new["theme"] = t
    return rng.choice(WORDS["theme"][t]).replace(" oynansın", "").replace(" olsun", "") + " olsun", new, "theme"


CONFIG = sg.Config(
    kit="football", fields=("title", "theme", "musicStyle", "difficulty", "teamSize", "duration", "home", "away", "keeper", "features"),
    probs={"title": 0.2, "theme": 0.5, "musicStyle": 0.15, "difficulty": 0.4, "teamSize": 0.4, "duration": 0.4, "home": 0.25, "away": 0.15, "keeper": 0.3, "features": 0.3},
    sample=sample, phrase=phrase, words=WORDS,
    heads=["Futbol oyunu yap:", "Bana bir futbol maçı yaz:", "Yukarıdan görünümlü bir futbol istiyorum,", "Top oynadığım bir maç olsun:", "Klasik bir futbol oyunu yap,"],
    vague=["Bir futbol oyunu yap.", "Top oynayıp gol attığım bir maç olsun.", "Futbol maçı istiyorum.", "İki takımlı bir futbol yapalım."],
    edit=edit, defaults={"theme": "grass", "difficulty": 3, "teamSize": 5, "duration": 120, "home": "red", "away": "blue", "keeper": True}, hand=[], list_fields=("features",), seed_base=4000)
messages, build_football_examples, score_football, expect_ok_football = sg.make(CONFIG)

HAND_EVAL_FOOTBALL = [
    {"kit": "football", "prompt": "Gece maçı, beş kişilik takımlar, kaleci olsun, üç dakikalık", "expect": {"theme": "night", "teamSize": 5, "keeper": True, "duration": 180}},
    {"kit": "football", "prompt": "Sokakta kalecisiz, dört kişilik bir futbol, çok zor", "expect": {"theme": "street", "keeper": False, "teamSize": 4, "difficulty": 5}},
    {"kit": "football", "prompt": "Kapalı salonda sarı formalı takımla oynayayım, rakip mavi olsun", "expect": {"theme": "indoor", "home": "yellow", "away": "blue"}},
    {"kit": "football", "prompt": "Çim sahada kolay bir maç, basılı tutarak güçlü şut, iki dakika", "expect": {"theme": "grass", "difficulty": 2, "features": ["powershot"], "duration": 120}},
    {"kit": "football", "prompt": "Adı Derbi olsun, yedi kişilik takımlar, epik müzikli", "expect": {"title": "Derbi", "teamSize": 7, "music": "epic"}},
    {"kit": "football", "prompt": "Bana sadece düz bir futbol maçı yap", "expect": {}},
]
