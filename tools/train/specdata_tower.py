"""Training and evaluation data for the tower defence kit (CPU only); the shared maker is specdata_generic.py.

  examples, held = build_tower_examples(600, 100, seed=0)"""
import specdata_generic as sg

THEMES = ("grass", "desert", "night", "lava")
ENEMIES = ("soldier", "runner", "tank", "swarm")
TOWERS = ("arrow", "cannon", "frost", "sniper")
FEATURES = ("speed", "bonus", "freeze")
TITLES = ("Orman Savunması", "Son Kale", "Kum Fırtınası", "Lav Geçidi", "Gece Nöbeti", "Taş Duvar", "Kuşatma")
NUM = {1: "bir", 2: "iki", 3: "üç", 4: "dört", 5: "beş", 6: "altı", 7: "yedi", 8: "sekiz", 9: "dokuz", 10: "on"}

WORDS = {
    "theme": {"grass": ["çimenlik bir haritada", "orman teması", "yeşil bir arazide"], "desert": ["çölde geçsin", "çöl teması", "kumlu bir haritada"],
              "night": ["gece teması", "karanlık bir gece haritasında", "gece savunması"], "lava": ["lav teması", "volkanik bir haritada", "ateşli lav haritasında"]},
    "difficulty": {1: ["çok kolay", "en kolay zorlukta"], 2: ["kolay", "rahat bir zorlukta"], 3: ["orta zorlukta", "dengeli zorlukta"], 4: ["zor", "zorlayıcı"], 5: ["çok zor", "acımasız zorlukta"]},
    "size": {"small": ["kısa yol", "küçük bir harita"], "medium": ["orta uzunlukta yol"], "large": ["uzun kıvrımlı yol", "büyük bir harita"]},
    "enemies": {"soldier": ["askerler", "yürüyen askerler"], "runner": ["hızlı koşucular", "koşucu düşmanlar"], "tank": ["zırhlı düşmanlar", "ağır tanklar"], "swarm": ["kalabalık sürüler", "minik düşman sürüsü"]},
    "towers": {"arrow": ["ok kulesi", "ok atan kuleler"], "cannon": ["top kulesi", "alan hasarı veren toplar"], "frost": ["buz kulesi", "yavaşlatan buz kuleleri"], "sniper": ["keskin nişancı kulesi", "uzaktan vuran keskin nişancılar"]},
    "boss": {True: ["sonunda patron gelsin", "son dalgada patron olsun"], False: ["patron olmasın", "patronsuz olsun"]},
    "features": {"speed": ["F ile hızlandırabileyim", "oyunu hızlandırma olsun"], "bonus": ["bol altınla başlayayım", "zengin başlangıç"], "freeze": ["düşmanları dondurabileyim", "dondurma yeteneği olsun"]},
}
LISTS = ("enemies", "towers", "features")


def sample(rng, f, spec):
    if f == "title":
        return rng.choice(TITLES)
    if f == "theme":
        return rng.choice(THEMES)
    if f == "difficulty":
        return rng.randint(1, 5)
    if f == "size":
        return rng.choice(("small", "large", "medium"))
    if f == "waves":
        return rng.choice((5, 8, 10, 12, 15, 20, 25))
    if f == "enemies":
        return rng.sample(ENEMIES, rng.choice((1, 2, 2, 3)))
    if f == "towers":
        return rng.sample(TOWERS, rng.choice((1, 2, 2, 3)))
    if f == "boss":
        return rng.random() < 0.6
    if f == "features":
        return rng.sample(FEATURES, rng.choice((1, 1, 2)))
    raise KeyError(f)


def phrase(rng, f, spec):
    if f == "title":
        return f'adı "{spec["title"]}" olsun'
    if f == "waves":
        n = spec["waves"]
        word = NUM.get(n, str(n)) if rng.random() < 0.4 else str(n)
        return rng.choice([f"{word} dalga sürsün", f"{word} dalgalı bir savunma", f"toplam {word} dalga olsun"])
    if f in LISTS:
        return ", ".join(rng.choice(WORDS[f][x]) for x in spec[f]) + (" olsun" if f != "features" and rng.random() < 0.5 else "")
    return None


def edit(rng, spec):
    new = {**spec}
    kind = rng.choice(["tower", "boss_on", "boss_off", "harder", "easier", "waves", "theme", "enemy", "freeze"])
    if kind == "tower":
        pool = [x for x in TOWERS if x not in new.get("towers", [])]
        if pool:
            t = rng.choice(pool)
            new["towers"] = new.get("towers", []) + [t]
            return rng.choice(WORDS["towers"][t]) + " da olsun", new, "towers"
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
    if kind == "waves":
        n = rng.choice([x for x in (5, 8, 10, 12, 15, 20, 25) if x != new.get("waves")])
        new["waves"] = n
        return f"{n} dalga olsun", new, "waves"
    if kind == "enemy":
        pool = [x for x in ENEMIES if x not in new.get("enemies", [])]
        if pool:
            e = rng.choice(pool)
            new["enemies"] = new.get("enemies", []) + [e]
            return rng.choice(WORDS["enemies"][e]) + " da gelsin", new, "enemies"
    if kind == "freeze":
        if "freeze" not in new.get("features", []):
            new["features"] = new.get("features", []) + ["freeze"]
            return rng.choice(["dondurma ekle", "düşmanları dondurabileyim"]), new, "features"
    t = rng.choice([x for x in THEMES if x != new.get("theme")])
    new["theme"] = t
    return rng.choice(WORDS["theme"][t]).replace(" geçsin", "") + " olsun", new, "theme"


CONFIG = sg.Config(
    kit="tower", fields=("title", "theme", "musicStyle", "difficulty", "size", "waves", "enemies", "towers", "boss", "features"),
    probs={"title": 0.2, "theme": 0.5, "musicStyle": 0.12, "difficulty": 0.35, "size": 0.2, "waves": 0.35, "enemies": 0.4, "towers": 0.4, "boss": 0.3, "features": 0.3},
    sample=sample, phrase=phrase, words=WORDS,
    heads=["Kule savunması yap:", "Bana bir kule savunma oyunu yaz:", "Kale koruduğum bir oyun istiyorum,", "Düşman dalgalarına karşı kule kurduğum bir oyun olsun:", "Klasik bir kule savunması yap,"],
    vague=["Bir kule savunması yap.", "Kule kurup düşmanları durdurduğum bir oyun olsun.", "Kule savunma oyunu istiyorum.", "Dalga dalga gelen düşmanlara karşı kale koruyayım."],
    edit=edit, defaults={"theme": "grass", "difficulty": 3, "size": "medium", "waves": 10, "enemies": ["soldier", "runner", "tank", "swarm"], "towers": ["arrow", "cannon", "frost", "sniper"], "boss": True}, hand=[],
    list_fields=LISTS, seed_base=7000)
messages, build_tower_examples, score_tower, expect_ok_tower = sg.make(CONFIG)

HAND_EVAL_TOWER = [
    {"kit": "tower", "prompt": "Çölde 12 dalgalı bir kule savunması, top ve buz kulesi, zırhlı düşmanlar", "expect": {"theme": "desert", "waves": 12, "towers": ["cannon", "frost"], "enemies": ["tank"]}},
    {"kit": "tower", "prompt": "Gece haritası, keskin nişancı kulesi, sonunda patron gelsin, çok zor", "expect": {"theme": "night", "towers": ["sniper"], "boss": True, "difficulty": 5}},
    {"kit": "tower", "prompt": "Orman teması, ok kulesi ve top, askerler ve koşucular, oyunu hızlandırma olsun", "expect": {"theme": "grass", "towers": ["arrow", "cannon"], "enemies": ["runner", "soldier"], "features": ["speed"]}},
    {"kit": "tower", "prompt": "Lav teması, kolay, patron olmasın, düşmanları dondurabileyim", "expect": {"theme": "lava", "difficulty": 2, "boss": False, "features": ["freeze"]}},
    {"kit": "tower", "prompt": "Adı Son Kale olsun, kalabalık sürüler, kısa yol, destansı müzikli", "expect": {"title": "Son Kale", "enemies": ["swarm"], "size": "small", "music": "epic"}},
    {"kit": "tower", "prompt": "Bana sadece düz bir kule savunması yap", "expect": {}},
]
