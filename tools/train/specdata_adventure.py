"""Training and evaluation data for the adventure kit (CPU only); the shared maker is specdata_generic.py.

  examples, held = build_adventure_examples(600, 100, seed=0)"""
import specdata_generic as sg

THEMES = ("dungeon", "forest", "desert", "castle")
HEROES = ("knight", "ranger", "mage")
ENEMIES = ("slime", "bat", "skeleton", "goblin", "ghost")
FEATURES = ("dash", "regen", "loot")
TITLES = ("Kayıp Kale", "Karanlık Zindan", "Ejderha Mağarası", "Gölge Krallığı", "Eski Hazine", "Son Kat", "Kristal Yolu")
NUM = {1: "bir", 2: "iki", 3: "üç", 4: "dört", 5: "beş", 6: "altı"}

WORDS = {
    "theme": {"dungeon": ["zindanda geçsin", "karanlık bir zindan teması", "yeraltı zindanında"], "forest": ["ormanda geçsin", "orman teması", "ağaçlı bir orman zindanında"],
              "desert": ["çölde geçsin", "çöl harabeleri teması", "kumlu bir çöl tapınağında"], "castle": ["kalede geçsin", "eski bir kale teması", "devasa bir sarayda"]},
    "hero": {"knight": ["şövalye kahraman", "kılıçlı bir şövalye", "yakın dövüşen şövalye"], "ranger": ["okçu kahraman", "yayla ok atan okçu", "uzaktan vuran bir okçu"], "mage": ["büyücü kahraman", "büyü yapan bir büyücü", "asası olan büyücü"]},
    "difficulty": {1: ["çok kolay", "en kolay zorlukta"], 2: ["kolay", "rahat bir zorlukta"], 3: ["orta zorlukta", "dengeli zorlukta"], 4: ["zor", "zorlayıcı"], 5: ["çok zor", "acımasız zorlukta"]},
    "size": {"small": ["küçük katlar", "küçük zindanlar"], "medium": ["orta büyüklükte katlar"], "large": ["büyük ve geniş katlar", "devasa zindanlar"]},
    "enemies": {"slime": ["balçıklar", "yavaş balçık canavarları"], "bat": ["yarasalar", "uçuşan yarasalar"], "skeleton": ["ok atan iskeletler", "iskeletler"], "goblin": ["sert goblinler", "hızlı goblinler"], "ghost": ["duvardan geçen hayaletler", "hayaletler"]},
    "boss": {True: ["sonunda patron olsun", "son katta patron çıksın"], False: ["patron olmasın", "patronsuz olsun"]},
    "features": {"dash": ["atılma özelliği olsun", "Shift ile atılabileyim"], "regen": ["canım yavaş yavaş dolsun", "can yenilensin"], "loot": ["bol ganimet düşsün", "canavarlar çok ganimet bıraksın"]},
}
LISTS = ("enemies", "features")


def sample(rng, f, spec):
    if f == "title":
        return rng.choice(TITLES)
    if f == "theme":
        return rng.choice(THEMES)
    if f == "hero":
        return rng.choice(HEROES)
    if f == "difficulty":
        return rng.randint(1, 5)
    if f == "levels":
        return rng.randint(1, 6)
    if f == "size":
        return rng.choice(("small", "large", "medium"))
    if f == "enemies":
        return rng.sample(ENEMIES, rng.choice((1, 2, 2, 3)))
    if f == "boss":
        return rng.random() < 0.6
    if f == "features":
        return rng.sample(FEATURES, rng.choice((1, 1, 2)))
    raise KeyError(f)


def phrase(rng, f, spec):
    if f == "title":
        return f'adı "{spec["title"]}" olsun'
    if f == "levels":
        n = spec["levels"]
        word = NUM.get(n, str(n)) if rng.random() < 0.4 else str(n)
        return rng.choice([f"{word} kat sürsün", f"{word} katlı bir zindan", f"toplam {word} kat olsun"])
    if f in ("enemies", "features"):
        return ", ".join(rng.choice(WORDS[f][x]) for x in spec[f]) + (" olsun" if f == "enemies" and rng.random() < 0.5 else "")
    return None


def edit(rng, spec):
    new = {**spec}
    kind = rng.choice(["hero", "boss_on", "boss_off", "harder", "easier", "levels", "theme", "enemy", "dash"])
    if kind == "hero":
        h = rng.choice([x for x in HEROES if x != new.get("hero")])
        new["hero"] = h
        return rng.choice(WORDS["hero"][h]) + " olsun", new, "hero"
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
        return f"{n} kat olsun", new, "levels"
    if kind == "enemy":
        pool = [x for x in ENEMIES if x not in new.get("enemies", [])]
        if pool:
            e = rng.choice(pool)
            new["enemies"] = new.get("enemies", []) + [e]
            return rng.choice(WORDS["enemies"][e]) + " da çıksın", new, "enemies"
    if kind == "dash":
        if "dash" not in new.get("features", []):
            new["features"] = new.get("features", []) + ["dash"]
            return rng.choice(["atılma ekle", "Shift ile atılabileyim"]), new, "features"
    t = rng.choice([x for x in THEMES if x != new.get("theme")])
    new["theme"] = t
    return rng.choice(WORDS["theme"][t]).replace(" geçsin", "") + " olsun", new, "theme"


CONFIG = sg.Config(
    kit="adventure", fields=("title", "theme", "hero", "musicStyle", "difficulty", "levels", "size", "enemies", "boss", "features"),
    probs={"title": 0.2, "theme": 0.5, "hero": 0.45, "musicStyle": 0.12, "difficulty": 0.35, "levels": 0.3, "size": 0.2, "enemies": 0.4, "boss": 0.3, "features": 0.3},
    sample=sample, phrase=phrase, words=WORDS,
    heads=["Macera oyunu yap:", "Bana bir zindan macerası yaz:", "Yukarıdan görünümlü bir macera oyunu istiyorum,", "Canavar kesip hazine bulduğum bir oyun olsun:", "Klasik bir zindan oyunu yap,"],
    vague=["Bir macera oyunu yap.", "Zindanda canavar kestiğim bir oyun olsun.", "Zelda gibi bir şey istiyorum.", "Hazine arayıp canavarlarla savaştığım bir oyun yap."],
    edit=edit, defaults={"theme": "dungeon", "hero": "knight", "difficulty": 3, "levels": 3, "size": "medium", "enemies": ["slime", "bat", "skeleton"], "boss": True}, hand=[],
    list_fields=LISTS, seed_base=6000)
messages, build_adventure_examples, score_adventure, expect_ok_adventure = sg.make(CONFIG)

HAND_EVAL_ADVENTURE = [
    {"kit": "adventure", "prompt": "Kalede geçen, okçu kahramanlı, iskelet ve hayalet düşmanlı bir macera", "expect": {"theme": "castle", "hero": "ranger", "enemies": ["ghost", "skeleton"]}},
    {"kit": "adventure", "prompt": "Üç katlı karanlık bir zindan, şövalye, sonunda patron olsun, çok zor", "expect": {"theme": "dungeon", "levels": 3, "hero": "knight", "boss": True, "difficulty": 5}},
    {"kit": "adventure", "prompt": "Ormanda büyücü ile balçık ve yarasa avlayalım, patron olmasın, atılabileyim", "expect": {"theme": "forest", "hero": "mage", "enemies": ["bat", "slime"], "boss": False, "features": ["dash"]}},
    {"kit": "adventure", "prompt": "Çölde kolay bir zindan, büyük katlar, bol ganimet düşsün", "expect": {"theme": "desert", "difficulty": 2, "size": "large", "features": ["loot"]}},
    {"kit": "adventure", "prompt": "Adı Kayıp Kale olsun, goblinler ve hayaletler, korku müzikli", "expect": {"title": "Kayıp Kale", "enemies": ["ghost", "goblin"], "music": "spooky"}},
    {"kit": "adventure", "prompt": "Bana sadece düz bir zindan macerası yap", "expect": {}},
]
