"""Training and evaluation data for the fighting kit (CPU only); the shared maker is specdata_generic.py.

  examples, held = build_fighter_examples(600, 100, seed=0)"""
import specdata_generic as sg

THEMES = ("dojo", "street", "temple", "volcano")
TYPES = ("brawler", "ninja", "sumo")
COLORS = ("red", "blue", "yellow", "green")
FEATURES = ("special", "versus", "rage")
TITLES = ("Sokak Dövüşü", "Altın Kemer", "Gölge Turnuvası", "Son Raunt", "Ejderha Kavgası", "Demir Yumruk", "Arena Savaşı")
COLOR_TR = {"red": "kırmızı", "blue": "mavi", "yellow": "sarı", "green": "yeşil"}
NUM = {1: "bir", 2: "iki", 3: "üç", 4: "dört", 5: "beş"}

WORDS = {
    "theme": {"dojo": ["dojoda geçsin", "dövüş salonu teması", "bir dojoda"], "street": ["sokakta geçsin", "sokak teması", "şehir sokağında"], "temple": ["tapınakta geçsin", "tapınak teması", "eski bir tapınakta"], "volcano": ["yanardağın başında", "volkan teması", "lavların yanında"]},
    "hero": {"brawler": ["dengeli bir dövüşçü olayım", "boksör gibi dövüşçü", "ben dövüşçü olayım"], "ninja": ["ninja olayım", "hızlı bir ninja", "ben ninja olarak oynayayım"], "sumo": ["sumo olayım", "koca bir sumo", "ben iri bir sumo olarak oynayayım"]},
    "rival": {"brawler": ["rakip dövüşçü olsun", "karşımda bir dövüşçü olsun"], "ninja": ["rakip ninja olsun", "karşımda hızlı bir ninja olsun"], "sumo": ["rakip sumo olsun", "karşımda koca bir sumo olsun"]},
    "color": {c: [f"{COLOR_TR[c]} dövüşçü", f"{COLOR_TR[c]} formalı dövüşçü"] for c in COLORS},
    "difficulty": {1: ["çok kolay", "en kolay zorlukta"], 2: ["kolay", "rahat bir zorlukta"], 3: ["orta zorlukta", "dengeli zorlukta"], 4: ["zor", "zorlayıcı"], 5: ["çok zor", "acımasız zorlukta"]},
    "features": {"special": ["ateş topu atabileyim", "özel hareket olsun"], "versus": ["iki kişilik oynayabilelim", "arkadaşımla oynayabileyim"], "rage": ["canı azalınca sert vursun", "öfke özelliği olsun"]},
}
LISTS = ("features",)


def sample(rng, f, spec):
    if f == "title":
        return rng.choice(TITLES)
    if f == "theme":
        return rng.choice(THEMES)
    if f == "hero":
        return rng.choice(TYPES)
    if f == "rival":
        return rng.choice([t for t in TYPES if t != spec.get("hero")])
    if f == "color":
        return rng.choice(COLORS)
    if f == "difficulty":
        return rng.randint(1, 5)
    if f == "rounds":
        return rng.randint(1, 5)
    if f == "time":
        return rng.choice((30, 45, 60, 90, 99))
    if f == "features":
        return rng.sample(FEATURES, rng.choice((1, 1, 2)))
    raise KeyError(f)


def phrase(rng, f, spec):
    if f == "title":
        return f'adı "{spec["title"]}" olsun'
    if f == "rounds":
        n = spec["rounds"]
        word = NUM.get(n, str(n)) if rng.random() < 0.4 else str(n)
        return rng.choice([f"{word} tur kazanan alsın", f"{word} turluk maç", f"ilk {word} turu kazanan galip gelsin"])
    if f == "time":
        return rng.choice([f"her tur {spec['time']} saniye sürsün", f"tur süresi {spec['time']} saniye"])
    if f == "features":
        return ", ".join(rng.choice(WORDS["features"][x]) for x in spec["features"])
    return None


def edit(rng, spec):
    new = {**spec}
    kind = rng.choice(["rival", "theme", "harder", "easier", "rounds", "special", "versus"])
    if kind == "rival":
        r = rng.choice([t for t in TYPES if t != new.get("rival")])
        new["rival"] = r
        return rng.choice(WORDS["rival"][r]), new, "rival"
    if kind == "theme":
        t = rng.choice([x for x in THEMES if x != new.get("theme")])
        new["theme"] = t
        return rng.choice(WORDS["theme"][t]).replace(" geçsin", "") + " olsun", new, "theme"
    if kind == "harder" and new.get("difficulty", 3) < 5:
        new["difficulty"] = new.get("difficulty", 3) + 1
        return rng.choice(["biraz daha zor olsun", "rakip güçlensin"]), new, "difficulty"
    if kind == "easier" and new.get("difficulty", 3) > 1:
        new["difficulty"] = new.get("difficulty", 3) - 1
        return rng.choice(["biraz daha kolay olsun", "rakip zayıflasın"]), new, "difficulty"
    if kind == "rounds":
        n = rng.choice([c for c in range(1, 6) if c != new.get("rounds")])
        new["rounds"] = n
        return f"{n} tur kazanan alsın", new, "rounds"
    feat = "special" if kind == "special" else "versus"
    if feat not in new.get("features", []):
        new["features"] = new.get("features", []) + [feat]
        return rng.choice(WORDS["features"][feat]), new, "features"
    return None


CONFIG = sg.Config(
    kit="fighter", fields=("title", "theme", "hero", "rival", "color", "musicStyle", "difficulty", "rounds", "time", "features"),
    probs={"title": 0.2, "theme": 0.5, "hero": 0.45, "rival": 0.4, "color": 0.2, "musicStyle": 0.12, "difficulty": 0.35, "rounds": 0.3, "time": 0.2, "features": 0.35},
    sample=sample, phrase=phrase, words=WORDS,
    heads=["Dövüş oyunu yap:", "Bana bir dövüş oyunu yaz:", "Yandan görünümlü bir dövüş oyunu istiyorum,", "Yumruk tekme attığım bir oyun olsun:", "Klasik bir sokak dövüşü yap,"],
    vague=["Bir dövüş oyunu yap.", "Yumruk tekme attığım bir oyun olsun.", "Street Fighter gibi bir şey istiyorum.", "İki dövüşçünün kapıştığı bir oyun yap."],
    edit=edit, defaults={"theme": "street", "hero": "brawler", "rival": "ninja", "color": "red", "difficulty": 3, "rounds": 2, "time": 60}, hand=[],
    list_fields=LISTS, seed_base=8000)
messages, build_fighter_examples, score_fighter, expect_ok_fighter = sg.make(CONFIG)

HAND_EVAL_FIGHTER = [
    {"kit": "fighter", "prompt": "Sokakta ninja ile sumo dövüşsün, ateş topu olsun, zor", "expect": {"theme": "street", "hero": "ninja", "rival": "sumo", "features": ["special"], "difficulty": 4}},
    {"kit": "fighter", "prompt": "Tapınakta geçen, ben sumo olayım, üç tur kazanan alsın, öfke özelliği olsun", "expect": {"theme": "temple", "hero": "sumo", "rounds": 3, "features": ["rage"]}},
    {"kit": "fighter", "prompt": "Yanardağın başında iki kişilik bir dövüş, her tur 45 saniye", "expect": {"theme": "volcano", "features": ["versus"], "time": 45}},
    {"kit": "fighter", "prompt": "Dojoda kolay bir dövüş, mavi dövüşçü, karşımda hızlı bir ninja olsun", "expect": {"theme": "dojo", "difficulty": 2, "color": "blue", "rival": "ninja"}},
    {"kit": "fighter", "prompt": "Adı Altın Kemer olsun, çok zor, ilk iki turu kazanan galip gelsin, destansı müzikli", "expect": {"title": "Altın Kemer", "difficulty": 5, "rounds": 2, "music": "epic"}},
    {"kit": "fighter", "prompt": "Bana sadece düz bir dövüş oyunu yap", "expect": {}},
]
