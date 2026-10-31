"""Training and evaluation data for Don, the advisor (CPU only): a small model that talks with the user about the game they want and picks
what the app needs. Two jobs, both with the exact messages the app sends (Advisor.ask and Advisor.choose_modules):

  chat     the user says what they want. A vague wish gets a short warm answer with at most two questions; a clear description gets a
           short answer and, as the last line, {"model": "<a model of the catalog>"}.
  modules  {"modules": ["core", "<kit>"]} for the game described so far.

The descriptions are the ones the spec generators write (specdata*.py), so the kit label is right by construction.

  train, held = build_don_examples(300, 40, seed=0)
"""
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

import specdata  # noqa: E402
import specdata_sandbox  # noqa: E402
import specdata_shooter  # noqa: E402
from k_minigames import advisor, catalog  # noqa: E402

CHAT_SYSTEM = advisor.system_prompt()
MODULE_SYSTEM = advisor.module_prompt()
MODEL_IDS = [m.id for m in catalog.coders()]
DECIDE_TR = ["sen karar ver", "fark etmez", "bilmiyorum, sen seç", "hepsi olabilir", "sen nasıl istersen", "önemli değil, sen yap"]
DECIDE_EN = ["you decide", "I don't mind", "surprise me", "whatever you think is best"]
SMALL, MEDIUM, LARGE = "qwen2.5-coder:3b", "qwen2.5-coder:7b", "qwen2.5-coder:14b"
assert {SMALL, MEDIUM, LARGE} <= set(MODEL_IDS)

VAGUE = {
    "platformer": ["Bir platform oyunu yapmak istiyorum.", "Zıplayarak ilerlediğim bir oyun olsun.", "Mario gibi bir şey yapar mısın?", "Koşup zıpladığım bir oyun yap.",
                   "Basit bir platform oyunu istiyorum.", "Düşmanların üstüne zıpladığım bir oyun olsun.", "mario tarzı bi oyun yap", "bi platform oyunu olsun", "zıplamalı bi şey yapsana"],
    "shooter": ["Bir uzay oyunu istiyorum.", "Düşmanları vurduğum bir oyun yap.", "Nişancı oyunu olsun.", "Uzay gemisiyle ateş ettiğim bir oyun yapmak istiyorum.",
                "Basit bir shoot'em up yapar mısın?", "uzay oyunu yap", "bi uzay gemisi oyunu olsun", "nişancı tarzı bi şey istiyorum"],
    "sandbox": ["Minecraft gibi bir oyun istiyorum.", "Blok kırıp bir şeyler yaptığım bir oyun olsun.", "Madencilik ve inşaat yaptığım bir oyun yap.",
                "Küp dünya gibi bir şey yapmak istiyorum.", "Bloklarla bir dünya kurduğum bir oyun olsun.", "minecraft tarzı bi oyun", "minecraft tarzı bi oyun yap", "bi minecraft yapsana", "minecraft gibi bir şey olsun", "blok oyunu yap"],
    "none": ["Bir oyun yapmak istiyorum.", "Eğlenceli bir şey yapalım.", "Merhaba, oyun yaptırmak istiyorum.", "Bana bir oyun yap.", "Canım sıkılıyor, bir oyun yapalım.", "bi şeyler yapalım", "oyun yap", "bana bi oyun lazım"],
}
VAGUE_EN = {
    "platformer": ["I want a platformer.", "Make me a game where I run and jump.", "Something like a classic platform game, please."],
    "shooter": ["I want a space shooter.", "Make a game where I shoot enemies.", "A simple shoot'em up, please."],
    "sandbox": ["I want a Minecraft-like game.", "A game where I mine blocks and build.", "Make me a cube world."],
    "none": ["I want to make a game.", "Hi, can you make a game for me?", "Let's make something fun."],
}
QUESTIONS = {
    "platformer": ["Karakter nasıl biri olsun, bölümler hangi dünyada geçsin?", "Kaç canla başlasın ve zorluk nasıl olsun?", "Düşmanlar, altınlar ve zıplama nasıl olsun?",
                   "Kontroller ok tuşları mı olsun, yoksa WASD mi?"],
    "shooter": ["Hangi tür düşmanlar çıksın, sonunda patron olsun mu?", "Gemi tek mi çift mi ateş etsin, kalkan ya da bomba olsun mu?", "Kaç dalga sürsün, zorluk nasıl olsun?"],
    "sandbox": ["Hangi bölgede geçsin (orman, çöl ya da ova) ve dünya ne kadar büyük olsun?", "Mağara, maden ve göller olsun mu, gece gündüz döngüsü ister misin?",
                "Uçabilmek ister misin, müzik nasıl olsun?"],
    "none": ["Nasıl bir oyun düşünüyorsun: koşup zıplamalı bir platform oyunu, uzay nişancısı ya da madencilik ve inşaat olan bir küp dünya?",
             "Oyunun türü ne olsun, ve kontrolleri nasıl düşünüyorsun?"],
}
QUESTIONS_EN = {
    "platformer": ["What should the hero be like, and what world should the levels be in?", "How many lives, and how hard should it be?"],
    "shooter": ["Which enemies should show up, and should there be a boss at the end?", "Single or double fire, and do you want a shield or bombs?"],
    "sandbox": ["Which region (forest, desert or plains), and how big should the world be?", "Do you want caves, ores and lakes, and a day and night cycle?"],
    "none": ["What kind of game do you have in mind: a run-and-jump platformer, a space shooter or a cube world for mining and building?",
             "What type of game should it be, and how would you like to control it?"],
}
ACK = ["Harika bir fikir!", "Güzel bir fikir!", "Süper, hemen bakalım.", "Tamam, anladım.", "Olur, birlikte yapalım!", "Eğlenceli olacak!"]
ACK_EN = ["Great idea!", "Sounds fun!", "Okay, let's do it.", "Got it!", "Nice, I like it."]
PROPOSE_TR = {
    SMALL: ["Bu oyun oldukça sade, küçük bir model yeter.", "Basit bir oyun, hızlı bir model işini görür.", "Fazla karmaşık değil, küçük model yeterli olur."],
    MEDIUM: ["Birkaç farklı özellik var, orta boy bir model iyi olur.", "Biraz ayrıntılı bir oyun, orta boy model dengeli olur.", "Özellikler çok, orta boy bir model uygun."],
    LARGE: ["Epey ayrıntılı bir oyun, büyük bir model daha iyi yapar.", "Çok özellik var, büyük model en sağlam sonucu verir.", "İstediklerin fazla, büyük bir model seçelim."],
}
PROPOSE_EN = {
    SMALL: ["This one is quite simple, a small model is enough.", "A simple game, a fast model will do."],
    MEDIUM: ["There are several features, a mid-size model fits well.", "A bit detailed, a mid-size model is a good balance."],
    LARGE: ["This is quite detailed, a large model will do it best.", "Lots of features, let's pick a large model."],
}
OUT_OF_SCOPE = ["3 boyutlu açık dünya bir oyun yap.", "Çok oyunculu online bir oyun yapmak istiyorum.", "Telefon için bir uygulama yap.", "Gerçekçi bir araba yarışı oyunu istiyorum.",
                "Bir MMO yapabilir misin?"]
OUT_OF_SCOPE_REPLY = ["Şu an en iyi üç türde yardımcı olabiliyorum: koşup zıplamalı platform, uzay nişancısı ve küp dünya. Bunlardan biri sana yakın mı, yoksa onlardan birine uyarlayalım mı?",
                      "Bu biraz büyük bir iş, tek dosyalık küçük oyunlar yapıyoruz. Platform, uzay nişancısı ya da küp dünya gibi bir şeye uyarlayalım mı?"]
EXTRA = [  # (text, modules): games that are not one of the three kits
    ("Voleybol oyunu yapmak istiyorum, iki kişilik olsun.", ["core", "sports"]), ("Pong gibi iki oyunculu bir oyun yap.", ["core", "sports"]),
    ("Bir futbol maçı oyunu olsun, kaleye gol atayım.", ["core", "sports"]), ("Basketbol atışı oyunu yapalım, potaya top atayım.", ["core", "sports"]),
    ("Düşmanın beni kovaladığı bir labirent oyunu olsun.", ["core", "ai"]), ("Bir bot ile yarıştığım bir oyun yap, rakip akıllı olsun.", ["core", "ai"]),
    ("Devriye gezen muhafızlardan saklandığım bir oyun yap.", ["core", "ai"]), ("Tıklayınca puan kazandığım basit bir oyun yap.", ["core"]),
    ("Yılan oyunu yapalım, yem yedikçe uzasın.", ["core"]), ("Hafıza kartlarını eşleştirdiğim bir oyun olsun.", ["core"]),
    ("Düşen blokları dizdiğim bir bulmaca oyunu yap.", ["core"]), ("Kuş uçuran, borulardan geçtiğim bir oyun yap.", ["core"]),
]
KIT_MODULES = {"platformer": ["core", "platformer"], "shooter": ["core", "shooter"], "sandbox": ["core", "sandbox"]}


def pick_model(n_fields: int) -> str:
    return SMALL if n_fields <= 2 else MEDIUM if n_fields <= 5 else LARGE


def _proposal(rng, model: str, english: bool) -> str:
    ack = rng.choice(ACK_EN if english else ACK)
    why = rng.choice((PROPOSE_EN if english else PROPOSE_TR)[model])
    return f"{ack} {why}\n" + json.dumps({"model": model})


def _question(rng, kit: str, english: bool) -> str:
    pool = (QUESTIONS_EN if english else QUESTIONS)[kit]
    n = 1 if rng.random() < 0.55 else min(2, len(pool))
    asked = rng.sample(pool, n)
    return rng.choice(ACK_EN if english else ACK) + " " + " ".join(asked)


def _vague(rng, kit: str, english: bool) -> str:
    return rng.choice((VAGUE_EN if english else VAGUE)[kit])


def _chat(history, user, answer):
    return [{"role": "system", "content": CHAT_SYSTEM}, *history, {"role": "user", "content": user}, {"role": "assistant", "content": answer}]


def _modules(history, modules):
    return [{"role": "system", "content": MODULE_SYSTEM}, *history[-6:], {"role": "user", "content": "Hangi modüller gerekli?"},
            {"role": "assistant", "content": json.dumps({"modules": modules})}]


def _descriptions(kit: str, n: int, seed: int):
    if kit == "platformer":
        train, _ = specdata.build_examples(n * 2, 0, seed)
    elif kit == "shooter":
        train, _ = specdata_shooter.build_shooter_examples(n * 2, 0, seed)
    else:
        train, _ = specdata_sandbox.build_sandbox_examples(n * 2, 0, seed)
    out = [(e["description"], e.get("lang", "tr"), len(e.get("mentioned") or [])) for e in train if e["kind"] == "create"]
    return out[:n]


def build_don_examples(n_per_kit: int = 300, n_eval: int = 40, seed: int = 0):
    rng = random.Random(seed + 7000)
    train, held = [], []

    def add(bucket, task, kind, kit, messages, expect):
        bucket.append({"task": task, "kind": kind, "kit": kit, "messages": messages, "expect": expect})

    def scenario(bucket, kit, text, lang, n_fields):
        english = lang == "en"
        model = pick_model(n_fields)
        clear = n_fields >= 3 and rng.random() < 0.4   # only a description with several details is answered at once
        if clear:
            history = []
        else:                                           # a short wish gets questions first, the description comes as the answer
            vague = _vague(rng, kit, english)
            question = _question(rng, kit, english)
            history = [{"role": "user", "content": vague}, {"role": "assistant", "content": question}]
            add(bucket, "chat", "ask", kit, _chat([], vague, question), {"questions_max": 2, "english": english})
            if n_fields < 3 and rng.random() < 0.5:     # a short description as the first message is still a wish
                add(bucket, "chat", "ask", kit, _chat([], text, _question(rng, kit, english)), {"questions_max": 2, "english": english})
            if rng.random() < 0.3:                      # "you decide": Don chooses and goes on
                answer = rng.choice(DECIDE_EN if english else DECIDE_TR)
                add(bucket, "chat", "propose", kit, _chat(history, answer, _proposal(rng, MEDIUM, english)), {"model": MEDIUM, "english": english})
                add(bucket, "modules", "modules", kit, _modules([*history, {"role": "user", "content": answer}], KIT_MODULES[kit]), {"modules": KIT_MODULES[kit]})
        add(bucket, "chat", "propose", kit, _chat(history, text, _proposal(rng, model, english)), {"model": model, "english": english})
        add(bucket, "modules", "modules", kit, _modules([*history, {"role": "user", "content": text}], KIT_MODULES[kit]), {"modules": KIT_MODULES[kit]})

    for kit in KIT_MODULES:
        pool = _descriptions(kit, n_per_kit + n_eval, seed)
        for i, (text, lang, n_fields) in enumerate(pool):
            scenario(train if i < n_per_kit else held, kit, text, lang, n_fields)
    for bucket, copies in ((train, 6), (held, 1)):   # the games of no kit, and what is not possible
        for _ in range(copies):
            for text, modules in EXTRA:
                add(bucket, "chat", "propose", "none", _chat([], text, _proposal(rng, MEDIUM if modules != ["core"] else SMALL, False)), {"model": None, "english": False})
                add(bucket, "modules", "modules", "none", _modules([{"role": "user", "content": text}], modules), {"modules": modules})
            for text in OUT_OF_SCOPE:
                add(bucket, "chat", "decline", "none", _chat([], text, rng.choice(OUT_OF_SCOPE_REPLY)), {"questions_max": 2, "english": False})
            for kit in ("none",):
                for english in (False, True):
                    for _ in range(3):
                        vague = _vague(rng, kit, english)
                        add(bucket, "chat", "ask", kit, _chat([], vague, _question(rng, kit, english)), {"questions_max": 2, "english": english})
    rng.shuffle(train)
    rng.shuffle(held)
    return train, held


# ---- judging an answer ----
def judge(task: str, kind: str, expect: dict, answer: str) -> dict:
    """Facts about an answer: {'ok': bool, ...}. For chat: asks stay short and without JSON, proposals end with a JSON line that names a
    catalog model; for modules: the exact set."""
    answer = (answer or "").strip()
    if task == "modules":
        try:
            names = json.loads(answer).get("modules")
        except (ValueError, AttributeError):
            return {"ok": False, "why": "not json"}
        return {"ok": isinstance(names, list) and sorted(names) == sorted(expect["modules"]), "got": names}
    proposed = advisor.extract_proposal(answer)
    if kind in ("ask", "decline"):
        return {"ok": proposed is None and answer.count("?") <= expect["questions_max"] and 0 < len(answer) < 400, "proposed": proposed}
    in_catalog = proposed in MODEL_IDS
    right = expect.get("model") is None or proposed == expect["model"]
    last_line_json = answer.splitlines()[-1].strip().startswith("{") if answer else False
    return {"ok": in_catalog and last_line_json, "in_catalog": in_catalog, "exact_model": right, "proposed": proposed}


if __name__ == "__main__":
    tr, he = build_don_examples(300, 40, 0)
    print(len(tr), len(he))
