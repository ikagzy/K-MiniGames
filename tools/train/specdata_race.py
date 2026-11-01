"""Training and evaluation data for the racing kit (CPU only); the shared maker is specdata_generic.py.

  examples, held = build_race_examples(600, 100, seed=0)"""
import specdata_generic as sg

THEMES = ("city", "desert", "forest", "night")
CARS = ("sport", "muscle", "rally")
COLORS = ("red", "blue", "yellow", "green")
FEATURES = ("nitro", "grip")
TITLES = ("Şehir Yarışı", "Çöl Fırtınası", "Gece Sürüşü", "Asfalt Ateşi", "Orman Rallisi", "Son Viraj", "Hız Tutkusu")
NUM = {1: "bir", 2: "iki", 3: "üç", 4: "dört", 5: "beş", 6: "altı", 7: "yedi"}

WORDS = {
    "theme": {"city": ["şehir sokaklarında geçsin", "şehir teması", "asfalt şehir pistinde"], "desert": ["çölde geçsin", "çöl teması", "kumlu bir çöl pistinde"],
              "forest": ["ormanda geçsin", "orman teması", "ağaçların arasında bir pistte"], "night": ["gece yarışı olsun", "gece teması", "karanlık bir gece pistinde"]},
    "difficulty": {1: ["çok kolay", "en kolay zorlukta"], 2: ["kolay", "rahat bir zorlukta"], 3: ["orta zorlukta", "dengeli zorlukta"], 4: ["zor", "zorlayıcı"], 5: ["çok zor", "acımasız zorlukta", "kabus gibi zor"]},
    "length": {"small": ["kısa pist", "kısa bir pist"], "medium": ["orta uzunlukta pist"], "large": ["uzun pist", "çok uzun bir pist"]},
    "car": {"sport": ["spor araba", "spor bir araba"], "muscle": ["kas araba", "güçlü bir kas araba"], "rally": ["ralli arabası", "ralli aracı"]},
    "color": {"red": ["kırmızı araba", "kırmızı bir araba"], "blue": ["mavi araba", "mavi bir araba"], "yellow": ["sarı araba", "sarı bir araba"], "green": ["yeşil araba", "yeşil bir araba"]},
    "features": {"nitro": ["nitro olsun", "nitro ile hızlanayım", "nitro özelliği"], "grip": ["yol tutuşu iyi olsun", "araba kaymasın"]},
}
LIST_PHRASES = ("features",)


def sample(rng, f, spec):
    if f == "title":
        return rng.choice(TITLES)
    if f == "theme":
        return rng.choice(THEMES)
    if f == "difficulty":
        return rng.randint(1, 5)
    if f == "laps":
        return rng.randint(1, 7)
    if f == "rivals":
        return rng.randint(1, 7)
    if f == "length":
        return rng.choice(("small", "large", "medium"))
    if f == "car":
        return rng.choice(CARS)
    if f == "color":
        return rng.choice(COLORS)
    if f == "features":
        return rng.sample(FEATURES, rng.choice((1, 1, 2)))
    raise KeyError(f)


def phrase(rng, f, spec):
    if f == "title":
        return f'adı "{spec["title"]}" olsun'
    if f == "laps":
        n = spec["laps"]
        word = NUM.get(n, str(n)) if rng.random() < 0.4 else str(n)
        return rng.choice([f"{word} tur sürsün", f"{word} turluk bir yarış", f"toplam {word} tur olsun"])
    if f == "rivals":
        n = spec["rivals"]
        word = NUM.get(n, str(n)) if rng.random() < 0.4 else str(n)
        return rng.choice([f"{word} rakip olsun", f"{word} rakibe karşı", f"{word} rakipli"])
    if f == "features":
        return ", ".join(rng.choice(WORDS["features"][x]) for x in spec["features"])
    return None


def edit(rng, spec):
    new = {**spec}
    kind = rng.choice(["laps", "rivals", "nitro", "theme", "harder", "easier", "color", "length"])
    if kind == "laps":
        n = rng.choice([c for c in range(1, 8) if c != new.get("laps")])
        new["laps"] = n
        return f"{n} tur olsun", new, "laps"
    if kind == "rivals":
        n = rng.choice([c for c in range(1, 8) if c != new.get("rivals")])
        new["rivals"] = n
        return f"{n} rakip olsun", new, "rivals"
    if kind == "nitro":
        if "nitro" not in new.get("features", []):
            new["features"] = new.get("features", []) + ["nitro"]
            return rng.choice(["nitro ekle", "nitro olsun", "bir de nitro koy"]), new, "features"
    if kind == "harder" and new.get("difficulty", 3) < 5:
        new["difficulty"] = new.get("difficulty", 3) + 1
        return rng.choice(["biraz daha zor olsun", "rakipleri hızlandır"]), new, "difficulty"
    if kind == "easier" and new.get("difficulty", 3) > 1:
        new["difficulty"] = new.get("difficulty", 3) - 1
        return rng.choice(["biraz daha kolay olsun", "rakipler yavaşlasın"]), new, "difficulty"
    if kind == "color":
        c = rng.choice([x for x in COLORS if x != new.get("color")])
        new["color"] = c
        return rng.choice(WORDS["color"][c]) + " olsun", new, "color"
    if kind == "length":
        new["length"] = rng.choice([x for x in ("small", "medium", "large") if x != new.get("length")])
        return rng.choice(["pist daha uzun olsun", "pist kısalsın"]) if False else (rng.choice(WORDS["length"][new["length"]]) + " olsun"), new, "length"
    t = rng.choice([x for x in THEMES if x != new.get("theme")])
    new["theme"] = t
    return rng.choice(WORDS["theme"][t]).replace(" geçsin", "").replace(" olsun", "") + " olsun", new, "theme"


CONFIG = sg.Config(
    kit="race", fields=("title", "theme", "musicStyle", "difficulty", "laps", "rivals", "length", "car", "color", "features"),
    probs={"title": 0.2, "theme": 0.55, "musicStyle": 0.15, "difficulty": 0.4, "laps": 0.4, "rivals": 0.35, "length": 0.2, "car": 0.3, "color": 0.25, "features": 0.35},
    sample=sample, phrase=phrase, words=WORDS,
    heads=["Araba yarışı yap:", "Bana bir yarış oyunu yaz:", "Yukarıdan görünümlü bir yarış istiyorum,", "Arabayla yarıştığım bir oyun olsun:", "Klasik bir araba yarışı yap,"],
    vague=["Bir araba yarışı yap.", "Arabayla yarıştığım bir oyun olsun.", "Yarış oyunu istiyorum.", "Rakiplerle pistte yarışalım."],
    edit=edit, defaults={"theme": "city", "difficulty": 3, "laps": 3, "rivals": 5, "length": "medium", "car": "sport", "color": "red"}, hand=[], list_fields=("features",), seed_base=3000)
messages, build_race_examples, score_race, expect_ok_race = sg.make(CONFIG)

HAND_EVAL_RACE = [
    {"kit": "race", "prompt": "Çölde geçen, üç turluk, nitroli bir araba yarışı olsun", "expect": {"theme": "desert", "laps": 3, "features": ["nitro"]}},
    {"kit": "race", "prompt": "Gece pistinde mavi bir spor arabayla beş rakibe karşı yarışalım", "expect": {"theme": "night", "color": "blue", "car": "sport", "rivals": 5}},
    {"kit": "race", "prompt": "Orman rallisi, ralli arabası, çok zor, kısa pist", "expect": {"theme": "forest", "car": "rally", "difficulty": 5, "length": "small"}},
    {"kit": "race", "prompt": "Şehirde kolay bir yarış, sarı araba, iki tur", "expect": {"theme": "city", "difficulty": 2, "color": "yellow", "laps": 2}},
    {"kit": "race", "prompt": "Uzun bir pistte kas araba, yol tutuşu iyi olsun, yedi rakip", "expect": {"length": "large", "car": "muscle", "features": ["grip"], "rivals": 7}},
    {"kit": "race", "prompt": "Adı Asfalt Ateşi olsun, yeşil araba, enerjik müzikli", "expect": {"title": "Asfalt Ateşi", "color": "green", "music": "epic"}},
    {"kit": "race", "prompt": "Bana sadece düz bir araba yarışı yap", "expect": {}},
]
