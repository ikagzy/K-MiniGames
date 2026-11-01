"""Training and evaluation data for the puzzle kit (CPU only); the shared maker is specdata_generic.py.

  examples, held = build_puzzle_examples(600, 100, seed=0)"""
import specdata_generic as sg

MODES = ("blocks", "match", "memory")
THEMES = ("candy", "neon", "forest", "night")
FEATURES = ("ghost", "hold", "hint")
TITLES = ("Şeker Bulmacası", "Blok Ustası", "Hafıza Oyunu", "Neon Taşlar", "Zihin Bulmacası", "Renkli Taşlar", "Satır Avcısı")

WORDS = {
    "mode": {"blocks": ["düşen bloklu bir bulmaca", "tetris gibi bir oyun", "satır silmeli blok oyunu", "düşen blokları dizdiğim bulmaca"],
             "match": ["üçlü eşleştirme oyunu", "taşları yer değiştirip patlattığım bir bulmaca", "şeker patlatma gibi bir oyun", "aynı taşları eşleştirdiğim oyun"],
             "memory": ["hafıza kartı oyunu", "kartları çevirip eşlerini bulduğum bir oyun", "hafıza oyunu", "aynı kartları bulmaca"]},
    "theme": {"candy": ["şeker teması", "tatlı renkli bir tema"], "neon": ["neon tema", "parlak neon renkler"], "forest": ["orman teması", "yeşil doğal bir tema"], "night": ["gece teması", "karanlık gece teması"]},
    "difficulty": {1: ["çok kolay", "en kolay zorlukta"], 2: ["kolay", "rahat bir zorlukta"], 3: ["orta zorlukta", "dengeli zorlukta"], 4: ["zor", "zorlayıcı"], 5: ["çok zor", "acımasız zorlukta"]},
    "size": {"small": ["küçük tahta", "küçük bir oyun alanı"], "medium": ["orta büyüklükte tahta"], "large": ["büyük tahta", "geniş bir oyun alanı"]},
    "features": {"ghost": ["bloğun düşeceği yer görünsün", "gölge göstergesi olsun"], "hold": ["parçayı saklayabileyim", "hold özelliği"], "hint": ["takılınca ipucu göstersin", "ipucu olsun"]},
}


def sample(rng, f, spec):
    if f == "title":
        return rng.choice(TITLES)
    if f == "mode":
        return rng.choice(MODES)
    if f == "theme":
        return rng.choice(THEMES)
    if f == "difficulty":
        return rng.randint(1, 5)
    if f == "size":
        return rng.choice(("small", "large", "medium"))
    if f == "goal":
        return rng.choice((500, 1000, 2000, 3000, 5000, 10000))
    if f == "features":
        mode = spec.get("mode")
        pool = ["ghost", "hold"] if mode == "blocks" else ["hint"] if mode == "match" else list(FEATURES)
        return rng.sample(pool, rng.choice((1, 1, 2)) if len(pool) > 1 else 1)
    raise KeyError(f)


def phrase(rng, f, spec):
    if f == "title":
        return f'adı "{spec["title"]}" olsun'
    if f == "goal":
        return rng.choice([f"hedef {spec['goal']} puan olsun", f"{spec['goal']} puana ulaşınca kazanayım", f"{spec['goal']} puan hedefi"])
    if f == "features":
        return ", ".join(rng.choice(WORDS["features"][x]) for x in spec["features"])
    return None


def edit(rng, spec):
    new = {**spec}
    kind = rng.choice(["mode", "theme", "harder", "easier", "goal", "hint", "size"])
    if kind == "mode":
        m = rng.choice([x for x in MODES if x != new.get("mode")])
        new["mode"] = m
        new.pop("features", None)
        return rng.choice(WORDS["mode"][m]) + " olsun", new, "mode"
    if kind == "theme":
        t = rng.choice([x for x in THEMES if x != new.get("theme")])
        new["theme"] = t
        return rng.choice(WORDS["theme"][t]) + " olsun", new, "theme"
    if kind == "harder" and new.get("difficulty", 3) < 5:
        new["difficulty"] = new.get("difficulty", 3) + 1
        return rng.choice(["biraz daha zor olsun", "zorluğu artır"]), new, "difficulty"
    if kind == "easier" and new.get("difficulty", 3) > 1:
        new["difficulty"] = new.get("difficulty", 3) - 1
        return rng.choice(["biraz daha kolay olsun", "zorluğu azalt"]), new, "difficulty"
    if kind == "goal":
        g = rng.choice([x for x in (500, 1000, 2000, 3000, 5000, 10000) if x != new.get("goal")])
        new["goal"] = g
        return f"hedef {g} puan olsun", new, "goal"
    if kind == "size":
        s = rng.choice([x for x in ("small", "medium", "large") if x != new.get("size")])
        new["size"] = s
        return rng.choice(WORDS["size"][s]) + " olsun", new, "size"
    if new.get("mode") == "match" and "hint" not in new.get("features", []):
        new["features"] = new.get("features", []) + ["hint"]
        return rng.choice(["ipucu ekle", "ipucu göstersin"]), new, "features"
    return None


CONFIG = sg.Config(
    kit="puzzle", fields=("title", "mode", "theme", "musicStyle", "difficulty", "size", "goal", "features"),
    probs={"title": 0.2, "mode": 0.8, "theme": 0.45, "musicStyle": 0.12, "difficulty": 0.35, "size": 0.2, "goal": 0.2, "features": 0.3},
    sample=sample, phrase=phrase, words=WORDS,
    heads=["Bulmaca oyunu yap:", "Bana bir bulmaca oyunu yaz:", "Zihin açıcı bir oyun istiyorum,", "Küçük bir bulmaca oyunu olsun:", "Klasik bir bulmaca yap,"],
    vague=["Bir bulmaca oyunu yap.", "Zihin oyunu olsun.", "Bulmaca istiyorum.", "Düşünerek oynadığım bir oyun yap."],
    edit=edit, defaults={"mode": "blocks", "theme": "candy", "difficulty": 3, "size": "medium", "goal": 0}, hand=[], list_fields=("features",), seed_base=5000)
messages, build_puzzle_examples, score_puzzle, expect_ok_puzzle = sg.make(CONFIG)

HAND_EVAL_PUZZLE = [
    {"kit": "puzzle", "prompt": "Neon temalı tetris gibi bir oyun, bloğun düşeceği yer görünsün", "expect": {"mode": "blocks", "theme": "neon", "features": ["ghost"]}},
    {"kit": "puzzle", "prompt": "Şeker patlatma gibi üçlü eşleştirme oyunu, takılınca ipucu göstersin, zor", "expect": {"mode": "match", "theme": "candy", "features": ["hint"], "difficulty": 4}},
    {"kit": "puzzle", "prompt": "Orman temalı hafıza kartı oyunu, küçük tahta", "expect": {"mode": "memory", "theme": "forest", "size": "small"}},
    {"kit": "puzzle", "prompt": "Gece teması, düşen bloklar, hedef 3000 puan, parçayı saklayabileyim", "expect": {"mode": "blocks", "theme": "night", "goal": 3000, "features": ["hold"]}},
    {"kit": "puzzle", "prompt": "Adı Zihin Bulmacası olsun, aynı kartları bulmaca, çok kolay", "expect": {"title": "Zihin Bulmacası", "mode": "memory", "difficulty": 1}},
    {"kit": "puzzle", "prompt": "Bana sadece düz bir bulmaca yap", "expect": {}},
]
