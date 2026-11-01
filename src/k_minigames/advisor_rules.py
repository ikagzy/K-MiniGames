"""Rules around the advisor's answer, for a small advisor model that rushes: a proposal made after a short wish ("minecraft tarzı bi oyun")
is replaced by questions, because the game is not understood yet. Rules only hold a proposal back; they never make one up."""
import re

DECIDED = re.compile(r"sen (karar|se[cç]|nas[iı]l istersen|yap)|fark etmez|bilmiyorum|[oö]nemli de[gğ]il|you decide|surprise me|don'?t mind|whatever", re.I)
KITS = (("fps", re.compile(r"fps|birinci [sş]ah[iı]s|first[- ]person|doom|pompal[iı]|silahla|tabanca|t[uü]fek|s[iı][gğ][iı]nak|bunker", re.I)),
        ("sandbox", re.compile(r"minecraft|k[uü]p d[uü]nya|blok|maden|in[sş]aat|cube world|mining|voxel", re.I)),
        ("football", re.compile(r"futbol|\bma[cç]\b|halisaha|football|soccer|kaleci|\bgol\b", re.I)),
        ("puzzle", re.compile(r"bulmaca|tetris|puzzle|eşleştir|eslestir|hafıza|hafiza|\bkart|match|candy|şeker", re.I)),
        ("adventure", re.compile(r"macera|zindan|rpg|kaşif|canavar|hazine|dungeon|zelda|diablo", re.I)),
        ("tower", re.compile(r"kule|savunma|tower|defen[cs]e|dalga dalga d[uü][sş]man|kale\w* koru", re.I)),
        ("fighter", re.compile(r"d[oö]v[uü][sş]|kavga|fight|street fighter|mortal|tekken|yumruk|tekme|ninja|sumo", re.I)),
        ("race", re.compile(r"yar[iı][sş]|araba|pist|formula|race|racing|rally|ralli|drift", re.I)),
        ("shooter", re.compile(r"uzay|ni[sş]anc[iı]|gemi|shoot|space|shooter", re.I)),
        ("platformer", re.compile(r"platform|z[iı]pla|mario|jump|run", re.I)))
QUESTIONS = {
    "football": "Güzel! Kaç kişilik takımlar olsun, hangi renk formalar? Maç kaç dakika sürsün, kaleci olsun mu, saha çim mi salon mu gece mi?",
    "puzzle": "Güzel! Hangi bulmaca olsun: düşen bloklar, üçlü eşleştirme ya da hafıza kartları? Tema (şeker, neon, orman, gece) ve zorluk nasıl olsun?",
    "adventure": "Güzel! Kahraman kim olsun: şövalye, okçu ya da büyücü? Zindan mı, orman, çöl ya da kale mi? Hangi canavarlar çıksın, sonunda patron olsun mu?",
    "tower": "Güzel! Hangi ortamda geçsin: çim, çöl, gece ya da lav? Kaç dalga olsun, hangi düşmanlar (asker, koşucu, zırhlı, sürü) ve hangi kuleler (ok, top, buz, keskin nişancı)?",
    "fighter": "Güzel! Hangi sahnede dövüşelim: dojo, sokak, tapınak ya da yanardağ? Dövüşçün ve rakibin kim olsun (dövüşçü, ninja, koca), kaç tur sürsün, özel hareket ister misin?",
    "race": "Güzel! Hangi ortamda yarışsın: şehir, çöl, orman ya da gece? Kaç tur ve kaç rakip olsun, nitro istiyor musun?",
    "fps": "Güzel! Hangi ortamda geçsin: sığınak, uzay istasyonu, harabe, laboratuvar ya da fabrika? Hangi silahlar ve düşmanlar olsun, sonunda patron var mı?",
    "sandbox": "Güzel fikir! Hangi bölgede geçsin (orman, çöl ya da ova) ve dünya ne kadar büyük olsun? Mağara, maden ve göller olsun mu?",
    "shooter": "Süper! Hangi tür düşmanlar çıksın, sonunda patron olsun mu? Gemi tek mi çift mi ateş etsin?",
    "platformer": "Tamam! Karakter nasıl biri olsun, bölümler hangi dünyada geçsin? Kaç canla başlasın?",
    None: "Olur! Nasıl bir oyun düşünüyorsun: koşup zıplamalı bir platform oyunu, uzay nişancısı ya da madencilik ve inşaat olan bir küp dünya?",
}
QUESTIONS_EN = {
    "football": "Nice! How many players per team and which shirt colours? How long is the match, a keeper, and which pitch: grass, indoor, night?",
    "puzzle": "Nice! Which puzzle: falling blocks, match-three or memory cards? Which theme (candy, neon, forest, night) and how hard?",
    "adventure": "Nice! Which hero: knight, ranger or mage? Which setting (dungeon, forest, desert, castle), which monsters, and a boss at the end?",
    "tower": "Nice! Which setting: grass, desert, night or lava? How many waves, which enemies and which towers (arrow, cannon, frost, sniper)?",
    "fighter": "Nice! Which stage: dojo, street, temple or volcano? Who are you and who is the rival (brawler, ninja, sumo), how many rounds, and do you want a special move?",
    "race": "Nice! Which setting: city, desert, forest or night? How many laps and rivals, and do you want nitro?",
    "fps": "Nice! Which setting: bunker, space station, ruins, lab or factory? Which weapons and enemies, and a boss at the end?",
    "sandbox": "Nice! Which region (forest, desert or plains), and how big should the world be? Do you want caves, ores and lakes?",
    "shooter": "Great! Which enemies should show up, and should there be a boss at the end? Single or double fire?",
    "platformer": "Okay! What should the hero be like, and what world should the levels be in? How many lives?",
    None: "Sounds fun! What kind of game: a run-and-jump platformer, a space shooter or a cube world for mining and building?",
}
STRONG_FPS = re.compile(r"fps|birinci [sş]ah[iı]s|first[- ]person|doom|pompal[iı]", re.I)   # words that mean a first person shooter and nothing else
KIT_MODULES = ("platformer", "shooter", "sandbox", "fps", "race", "football", "puzzle", "adventure", "tower", "fighter")


def fix_modules(history: list, names: list) -> list:
    """The kit among the chosen modules, put right by the words of the user: a small model that has never seen the newest kit picks the nearest old one (a shooter for an FPS)."""
    said = " ".join(m["content"] for m in history if m.get("role") == "user")
    if STRONG_FPS.search(said) and "fps" not in names:
        return [n for n in names if n not in KIT_MODULES] + ["fps"]
    return names


_ENGLISH = re.compile(r"\b(the|want|make|game|please|with|and|a)\b", re.I)


def understood(history: list[dict], user_text: str) -> bool:
    """Is there enough to go on: several details, an answer to a question, or the user leaving the choice to the advisor."""
    users = [m["content"] for m in history if m.get("role") == "user"] + [user_text]
    if DECIDED.search(user_text):
        return True
    return len(users) >= 2 or len(" ".join(users).split()) >= 10


def question_for(history: list[dict], user_text: str) -> str:
    said = " ".join([m["content"] for m in history if m.get("role") == "user"] + [user_text])
    kit = next((name for name, pattern in KITS if pattern.search(said)), None)
    english = bool(_ENGLISH.search(said)) and not re.search(r"[ığşöçüİĞŞÖÇÜ]", said)
    return (QUESTIONS_EN if english else QUESTIONS)[kit]
