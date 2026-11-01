"""Training and evaluation data for the block blast kit (CPU only); the shared maker is specdata_generic.py.

  examples, held = build_blast_examples(600, 100, seed=0)"""
import specdata_generic as sg

THEMES = ("candy", "neon", "ocean", "night")
SIZES = ("small", "medium", "large")
FEATURES = ("hint", "undo", "bomb")
TITLES = ("Blok Patlat", "Renkli Bloklar", "Satır Avcısı", "Parça Ustası", "Şeker Blokları", "Neon Blast", "Kare Bulmaca")

WORDS = {
    "theme": {"candy": ["şeker teması", "tatlı renkli bir tema"], "neon": ["neon tema", "parlak neon renkler"], "ocean": ["okyanus teması", "deniz mavisi bir tema"], "night": ["gece teması", "karanlık gece teması"]},
    "size": {"small": ["küçük 6x6 tahta", "küçük tahta"], "medium": ["8x8 tahta", "orta büyüklükte tahta"], "large": ["büyük 10x10 tahta", "geniş bir tahta"]},
    "difficulty": {1: ["çok kolay", "en kolay zorlukta"], 2: ["kolay", "rahat bir zorlukta"], 3: ["orta zorlukta", "dengeli zorlukta"], 4: ["zor", "zorlayıcı"], 5: ["çok zor", "acımasız zorlukta"]},
    "features": {"hint": ["ipucu göstersin", "takılınca ipucu olsun"], "undo": ["hamleyi geri alabileyim", "geri alma özelliği olsun"], "bomb": ["ara sıra bomba parçası gelsin", "bomba olsun"]},
}
LISTS = ("features",)


def sample(rng, f, spec):
    if f == "title":
        return rng.choice(TITLES)
    if f == "theme":
        return rng.choice(THEMES)
    if f == "size":
        return rng.choice(SIZES)
    if f == "difficulty":
        return rng.randint(1, 5)
    if f == "goal":
        return rng.choice((500, 1000, 2000, 5000, 10000))
    if f == "features":
        return rng.sample(FEATURES, rng.choice((1, 1, 2)))
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
    kind = rng.choice(["theme", "size", "harder", "easier", "goal", "undo", "bomb"])
    if kind == "theme":
        t = rng.choice([x for x in THEMES if x != new.get("theme")])
        new["theme"] = t
        return rng.choice(WORDS["theme"][t]) + " olsun", new, "theme"
    if kind == "size":
        s = rng.choice([x for x in SIZES if x != new.get("size")])
        new["size"] = s
        return rng.choice(WORDS["size"][s]) + " olsun", new, "size"
    if kind == "harder" and new.get("difficulty", 3) < 5:
        new["difficulty"] = new.get("difficulty", 3) + 1
        return rng.choice(["biraz daha zor olsun", "zorluğu artır"]), new, "difficulty"
    if kind == "easier" and new.get("difficulty", 3) > 1:
        new["difficulty"] = new.get("difficulty", 3) - 1
        return rng.choice(["biraz daha kolay olsun", "zorluğu azalt"]), new, "difficulty"
    if kind == "goal":
        g = rng.choice([x for x in (500, 1000, 2000, 5000, 10000) if x != new.get("goal")])
        new["goal"] = g
        return f"hedef {g} puan olsun", new, "goal"
    feat = "undo" if kind == "undo" else "bomb"
    if feat not in new.get("features", []):
        new["features"] = new.get("features", []) + [feat]
        return rng.choice(WORDS["features"][feat]), new, "features"
    return None


CONFIG = sg.Config(
    kit="blast", fields=("title", "theme", "size", "musicStyle", "difficulty", "goal", "features"),
    probs={"title": 0.2, "theme": 0.55, "size": 0.35, "musicStyle": 0.12, "difficulty": 0.35, "goal": 0.25, "features": 0.4},
    sample=sample, phrase=phrase, words=WORDS,
    heads=["Block Blast gibi bir oyun yap:", "Bana bir blok patlatma oyunu yaz:", "Parçaları tahtaya sürüklediğim bir oyun istiyorum,", "Satır sütun patlattığım bir bulmaca olsun:", "Klasik bir block blast yap,"],
    vague=["Bir Block Blast oyunu yap.", "Parçaları yerleştirip satır patlattığım bir oyun olsun.", "Block Blast gibi bir şey istiyorum.", "8x8 tahtaya blok yerleştirdiğim bir oyun yap."],
    edit=edit, defaults={"theme": "candy", "size": "medium", "difficulty": 3, "goal": 0}, hand=[], list_fields=LISTS, seed_base=9000)
messages, build_blast_examples, score_blast, expect_ok_blast = sg.make(CONFIG)

HAND_EVAL_BLAST = [
    {"kit": "blast", "prompt": "Neon temalı bir Block Blast, büyük tahta, hamleyi geri alabileyim", "expect": {"theme": "neon", "size": "large", "features": ["undo"]}},
    {"kit": "blast", "prompt": "Okyanus teması, küçük 6x6 tahta, ipucu göstersin, kolay", "expect": {"theme": "ocean", "size": "small", "features": ["hint"], "difficulty": 2}},
    {"kit": "blast", "prompt": "Gece teması, hedef 5000 puan olsun, bomba parçası gelsin, zor", "expect": {"theme": "night", "goal": 5000, "features": ["bomb"], "difficulty": 4}},
    {"kit": "blast", "prompt": "Şeker teması, 8x8 tahta, geri alma ve ipucu olsun", "expect": {"theme": "candy", "size": "medium", "features": ["hint", "undo"]}},
    {"kit": "blast", "prompt": "Adı Neon Blast olsun, çok zor, destansı müzikli", "expect": {"title": "Neon Blast", "difficulty": 5, "music": "epic"}},
    {"kit": "blast", "prompt": "Bana sadece düz bir blok patlatma oyunu yap", "expect": {}},
]
