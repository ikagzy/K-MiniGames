"""Asks the model to write, change and fix the game, and to write the tests that check it.

The model answers in free text, so the answer is parsed strictly: only a complete HTML document counts as a game.
A cut-off or empty answer is an error, never a half game that could overwrite a working one."""
import json
import re
from collections.abc import Callable
from dataclasses import dataclass

from k_minigames import kgamelib, kits, patching, specrules
from k_minigames import memory as memory_notes
from k_minigames.library import Texture
from k_minigames.ollama_client import OllamaError

_FENCE = re.compile(r"```([a-zA-Z]*)[ \t]*\r?\n(.*?)```", re.S)
_DOC_START = re.compile(r"<!doctype html|<html", re.I)


class GenerationError(Exception):
    pass


@dataclass(frozen=True)
class Generated:
    html: str
    checklist: list[str]


_RULES = (
    "Sen bir oyun yazarısın. Kullanıcının tarif ettiği oyunu TEK bir dosyada, saf HTML + CSS + JavaScript ile yaz "
    "(dosya adı oyun.html).\n"
    "Kurallar:\n"
    "- Cevabında önce tam oyunu ```html bloğu içinde ver: <!doctype html> ile başlayıp </html> ile biten, eksiksiz bir belge.\n"
    "- Sonra bir ```json bloğunda oyunun neye benzemesi gerektiğini 3-8 kısa Türkçe maddeyle yaz: "
    '{"checklist": ["...", "..."]}\n'
    "  Maddeler oyunun nasıl oynandığını anlatsın (örneğin 'boşluk tuşuna basınca kare zıplar', 'engele çarpınca oyun "
    "biter'); bu kuralları ya da başka teknik kuralları (dokular, window.__game, canvas) madde yapma.\n"
    "- Oyun durumunu (skor, konum, can gibi) window.__game nesnesinde tut; uygulama testleri bu nesneyi okuyarak yapar.\n"
    "- Dokuları yalnızca assets/<dosya adı> yoluyla kullan; listedekilerden başka dosya uydurma. Canvas'ta drawImage ile "
    "çiz; getImageData kullanma.\n"
    "- Dış ağ adresi kullanma: kodda http:// ya da https:// geçmesin, kütüphane ya da yazı tipi indirme.\n"
    "- Oyun klavye (ok tuşları, boşluk) ve fare ile oynansın; sayfa açılır açılmaz çalışmaya hazır olsun."
)
_RULES_LIB = (
    "Sen bir oyun yazarısın. Kullanıcının tarif ettiği oyunu, aşağıda anlatılan K-MiniGames oyun kütüphanesiyle yaz: "
    "yalnızca oyunun KURALLARINI ve ayarlarını yaz (dosya adı oyun.html). Kütüphane hazır olanı (döngü, fizik, girdi, "
    "çarpışma, bot, spor kuralları) senin yerine yapar; onu yeniden yazma.\n"
    "Kurallar:\n"
    "- Cevabında önce tam oyunu ```html bloğu içinde ver: <!doctype html> ile başlayıp </html> ile biten, eksiksiz bir belge; "
    "içinde bir <canvas></canvas> ve bir <script> olsun. Kütüphane dosyalarını <script src> ile ÇAĞIRMA, uygulama ekler.\n"
    "- Sonra bir ```json bloğunda oyunun neye benzemesi gerektiğini 3-8 kısa Türkçe maddeyle yaz: "
    '{"checklist": ["...", "..."]}\n'
    "  Maddeler oyunun nasıl oynandığını anlatsın; teknik kuralları madde yapma.\n"
    "- Oyun durumunu (skor, konum, can) K.expose({...}) ile aç; uygulama testleri bunu okur.\n"
    "- Dokuları yalnızca assets/<dosya adı> yoluyla kullan ya da K.texture.make ile üret; listedekilerden başka dosya "
    "uydurma.\n"
    "- Dış ağ adresi kullanma: kodda http:// ya da https:// geçmesin.\n"
    "- Oyun klavye ve fare ile oynansın; sayfa açılır açılmaz çalışmaya hazır olsun."
)
_TESTER_RULES = (
    "Sen bir test yazarısın. Verilen oyun için, kontrol listesindeki her madde adına bir JavaScript işlev GÖVDESİ yaz. "
    "Gövde `game` parametresini (= window.__game) alır ve maddenin doğru olup olmadığını true/false döndürür; gerekirse "
    "`await` kullanabilir, oyuna document.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'})) ile tuş "
    "gönderip kısa bekleyebilir (await new Promise(r => setTimeout(r, 300))).\n"
    'Cevap yalnızca şu biçimde bir ```json bloğu olsun: {"tests": [{"index": 0, "code": "return true;"}]}\n'
    "Kod, JSON'da çift tırnaklı tek satır bir dizge olsun (satır sonu için \\n yaz); ters tırnak (`) ya da gerçek satır "
    "sonu kullanma."
)


SPEC_MAX_TOKENS = 2500   # a spec is a few hundred tokens; this only stops a model that never ends
TUNED_PREFIX = "k-ai"   # the models trained for this app (k-ai, k-ai-v2, ...)
PATCH_MIN_CHARS = 1500   # a shorter game is simply written again; patches pay off on a longer one
_PATCH_RULES = (
    "Oyunun mevcut hâlini ve kullanıcının isteğini göreceksin. Oyunu YENİDEN YAZMA; yalnızca değişen yerleri şu "
    "biçimde ver (her değişiklik için bir blok):\n"
    "<<<<<<< BUL\n(oyunda AYNEN geçen, değişecek satırlar)\n=======\n(yerine gelecek satırlar)\n>>>>>>> DEĞİŞTİR\n"
    "BUL kısmı oyunda TAM BİR kez geçmeli (yeterince benzersiz olsun) ve karakteri karakterine aynı olmalı. "
    "Sonra bir ```json bloğunda güncel kontrol listesini ver: {\"checklist\": [\"...\"]}"
)


_TESTER_LIB = (
    "Oyun K-MiniGames kütüphanesiyle yazıldı. `game` parametresi, oyunun `K.expose({...})` ile açtığı nesnedir: oyunun "
    "HTML'inde K.expose içinde adı geçen alanları kullan (örneğin `game.g` oyundur: `game.g.score('left')`, "
    "`game.g.current` ('play' ya da 'over'), `game.g.all('etiket')`; `game.ball`, `game.me` gibi varlıkların x, y, vx, vy "
    "alanları vardır). Oyunu `game.g.step(1/60)` ile ilerletebilirsin. HTML'de görmediğin işlev ya da ad uydurma "
    "(KGame, game.score() gibi); emin değilsen basit bir koşul yaz."
)


def _system(rules: str, memory: str, modules=()) -> dict:
    """The system message. With library modules the rules are the library rules followed by the modules' guides;
    without them it is exactly what it always was."""
    if modules:
        rules = f"{_RULES_LIB}\n\n{kgamelib.guides(list(modules))}"
    head = memory_notes.block(memory)
    return {"role": "system", "content": f"{head}\n\n{rules}" if head else rules}


def _texture_lines(textures: list[Texture]) -> str:
    if not textures:
        return "Doku yok; her şeyi kodla çiz."
    lines = []
    for t in textures:
        size = f"{t.width}x{t.height} piksel" if t.width and t.height else "boyutu bilinmiyor"
        lines.append(f"- {t.url} ({size}): {t.description}")   # the url form: names may hold spaces
    return "Kullanabileceğin dokular:\n" + "\n".join(lines)


def build_create_messages(description: str, textures: list[Texture], *, memory: str = "", modules=()) -> list[dict]:
    user = f"Oyun tarifi:\n{description}\n\n{_texture_lines(textures)}"
    return [_system(_RULES, memory, modules), {"role": "user", "content": user}]


def build_edit_messages(html: str, request: str, textures: list[Texture], checklist: list[str],
                        resolved: list[str] = (), *, memory: str = "", modules=()) -> list[dict]:
    parts = [f"Mevcut oyun:\n```html\n{html}\n```", f"Kullanıcının isteği:\n{request}", _texture_lines(textures)]
    if checklist:
        parts.append("Oyunun kontrol listesi (bozma):\n" + "\n".join(f"- {c}" for c in checklist))
    if resolved:
        parts.append("Daha önce çözülen hatalar (bunları tekrarlama):\n" + "\n".join(f"- {r}" for r in resolved))
    parts.append("İsteği uygula ve oyunun tamamını yeniden ver; yeni ya da değişen kontrol listesini de yaz.")
    return [_system(_RULES, memory, modules), {"role": "user", "content": "\n\n".join(parts)}]


_UNDEFINED = re.compile(r"ReferenceError: ([A-Za-z_$][\w$]*)")


_FUNCTION = re.compile(r"function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>")


def _function_at(lines: list[str], number: int) -> str:
    """The name of the function a line (1-based) is in, as far as the page's layout shows it ("" at the top level).
    Only a declaration indented like a top-level one of a script (up to 8 spaces) counts as the enclosing function."""
    for i in range(number - 1, -1, -1):
        match = _FUNCTION.search(lines[i])
        if match and len(lines[i]) - len(lines[i].lstrip()) <= 8:
            return match.group(1) or match.group(2)
    return ""


def scope_hints(html: str, problems: list[str]) -> list[str]:
    """For `ReferenceError: x` say in which function x is declared and in which others it is used without a
    declaration: the usual cause is a variable declared inside one function and used in another, which a small model
    does not see in a long page."""
    hints, seen = [], set()
    lines = html.splitlines()
    for problem in problems:
        match = _UNDEFINED.search(problem)
        if not match or match.group(1) in seen:
            continue
        name = match.group(1)
        seen.add(name)
        word = re.compile(rf"(?<![\w$.]){re.escape(name)}(?![\w$])")
        declared = [i for i, line in enumerate(lines, 1)
                    if re.search(rf"\b(?:const|let|var)\s+{re.escape(name)}\b", line)]
        homes = {_function_at(lines, i) for i in declared}
        others = []
        for i, line in enumerate(lines, 1):
            if word.search(line) and i not in declared:
                home = _function_at(lines, i)
                if home not in homes and home not in others:
                    others.append(home)
        where = ", ".join(sorted(h or "en üst düzey" for h in homes)) or "hiçbir yerde"
        users = ", ".join(h or "en üst düzey" for h in others) or "?"
        hints.append(f"'{name}' {where} içinde tanımlı ama {users} içinde de kullanılıyor; orada tanımsız. "
                     f"Her birinin başına '{name}' tanımını ekle ya da tanımı dosyanın en üstüne (fonksiyonların dışına) taşı.")
    return hints


def build_patch_messages(html: str, request: str, textures: list[Texture], checklist: list[str],
                         resolved: list[str] = (), *, memory: str = "", modules=()) -> list[dict]:
    """Like the edit messages, but the answer is find/replace blocks (see patching.py)."""
    messages = build_edit_messages(html, request, textures, checklist, resolved, memory=memory, modules=modules)
    messages[0]["content"] += "\n\n" + _PATCH_RULES
    user = messages[1]["content"].replace("İsteği uygula ve oyunun tamamını yeniden ver; yeni ya da değişen kontrol "
                                           "listesini de yaz.", "İsteği değişiklik blokları olarak uygula.")
    messages[1]["content"] = user
    return messages


def _checklist_of(text: str) -> list[str]:
    for lang, body in _FENCE.findall(text or ""):
        if lang.lower() == "json":
            try:
                data = json.loads(body)
            except ValueError:
                continue
            if isinstance(data, dict) and isinstance(data.get("checklist"), list):
                return [str(x).strip() for x in data["checklist"] if str(x).strip()]
    return []


def build_fix_messages(html: str, problems: list[str], *, memory: str = "", modules=()) -> list[dict]:
    problems = list(problems) + scope_hints(html, problems)
    user = ("Oyunda şu sorunlar bulundu. Hepsini düzelt, oyunun geri kalanını bozma ve oyunun tamamını yeniden ver:\n"
            + "\n".join(f"- {p}" for p in problems) + f"\n\nOyun:\n```html\n{html}\n```")
    return [_system(_RULES, memory, modules), {"role": "user", "content": user}]


def build_test_messages(html: str, checklist: list[str], *, memory: str = "", modules=()) -> list[dict]:
    items = "\n".join(f"{i}: {text}" for i, text in enumerate(checklist))
    user = f"Oyun:\n```html\n{html}\n```\n\nKontrol listesi:\n{items}"
    rules = f"{_TESTER_RULES}\n{_TESTER_LIB}" if modules else _TESTER_RULES
    return [_system(rules, memory), {"role": "user", "content": user}]


def parse_response(text: str) -> Generated | None:
    """A complete HTML document (and the checklist if there is one), or None."""
    fences = _FENCE.findall(text or "")
    html = next((body.strip() for lang, body in reversed(fences)
                 if lang.lower() == "html" and "</html>" in body.lower()), None)
    if html is None:
        start = _DOC_START.search(text or "")
        end = (text or "").lower().rfind("</html>")
        if start and end > start.start():
            html = text[start.start():end + len("</html>")].strip()
    if html is None:
        return None
    checklist: list[str] = []
    for lang, body in fences:
        if lang.lower() != "json":
            continue
        try:
            data = json.loads(body)
        except ValueError:
            continue
        if isinstance(data, dict) and isinstance(data.get("checklist"), list):
            checklist = [str(x).strip() for x in data["checklist"] if str(x).strip()]
    return Generated(html, checklist)


_LENIENT_TEST = re.compile(r'"index"\s*:\s*(\d+)\s*,\s*"code"\s*:\s*(?:`(.*?)`|"((?:[^"\\]|\\.)*)")', re.S)


def _lenient_tests(text: str, count: int) -> list[str | None]:
    """Small models often write the code as a JavaScript template literal (backticks) inside the JSON, which is not
    valid JSON. Read the index/code pairs directly."""
    result: list[str | None] = [None] * count
    for match in _LENIENT_TEST.finditer(text or ""):
        index = int(match.group(1))
        if match.group(2) is not None:
            code = match.group(2)
        else:
            try:
                code = json.loads('"' + match.group(3) + '"')
            except ValueError:
                code = match.group(3)
        if 0 <= index < count and code.strip():
            result[index] = code.strip()
    return result


def parse_tests(text: str, count: int) -> list[str | None]:
    """The test code per checklist index; items the model skipped stay None."""
    candidates = [body for lang, body in _FENCE.findall(text or "") if lang.lower() == "json"] + [text or ""]
    first, last = (text or "").find("{"), (text or "").rfind("}")
    if 0 <= first < last:
        candidates.append(text[first:last + 1])
    result: list[str | None] = [None] * count
    for candidate in candidates:
        try:
            data = json.loads(candidate)
        except ValueError:
            continue
        if isinstance(data, dict) and isinstance(data.get("tests"), list):
            for item in data["tests"]:
                if isinstance(item, dict) and isinstance(item.get("index"), int) and 0 <= item["index"] < count \
                        and isinstance(item.get("code"), str) and item["code"].strip():
                    result[item["index"]] = item["code"]
            return result
    return _lenient_tests(text, count)


class Generator:
    def __init__(self, client, model: str, keep_alive: str | None = None):
        self.client, self.model, self.keep_alive = client, model, keep_alive

    def _chat(self, messages: list[dict], on_token=None, cancel=None) -> str:
        extra = {"keep_alive": self.keep_alive} if self.keep_alive else {}   # let the model go soon after the last call
        try:
            return self.client.chat(self.model, messages, on_token=on_token, cancel=cancel, **extra)
        except OllamaError as exc:
            raise GenerationError(str(exc)) from exc

    def _game(self, messages: list[dict], on_token, cancel) -> Generated:
        generated = parse_response(self._chat(messages, on_token, cancel))
        if generated is None:
            raise GenerationError("Modelin cevabında tam bir oyun yok (boş ya da yarıda kesilmiş)")
        return generated

    def create(self, description: str, textures: list[Texture], on_token: Callable | None = None,
               cancel: Callable[[], bool] | None = None, *, memory: str = "", modules=()) -> Generated:
        return self._game(build_create_messages(description, textures, memory=memory, modules=modules), on_token, cancel)

    def edit(self, html: str, request: str, textures: list[Texture], checklist: list[str],
             resolved: list[str] = (), on_token: Callable | None = None, cancel: Callable[[], bool] | None = None,
             *, memory: str = "", modules=()) -> Generated:
        if modules and len(html) >= PATCH_MIN_CHARS:   # library games are edited with patches, whole file as a fallback
            answer = self._chat(build_patch_messages(html, request, textures, checklist, resolved, memory=memory,
                                                     modules=modules), None, cancel)
            patched = patching.apply_patches(html, patching.parse_patches(answer))
            if patched is not None:
                return Generated(patched, _checklist_of(answer))
        return self._game(build_edit_messages(html, request, textures, checklist, resolved, memory=memory,
                                              modules=modules), on_token, cancel)

    def fix(self, html: str, problems: list[str], on_token: Callable | None = None,
            cancel: Callable[[], bool] | None = None, *, memory: str = "", modules=()) -> Generated:
        return self._game(build_fix_messages(html, problems, memory=memory, modules=modules), on_token, cancel)

    # --- spec mode: the model writes the game's spec (JSON, kept in shape by the kit's schema), never its code ---

    def _spec(self, kit: str, messages: list[dict], cancel) -> dict:
        # The k-ai models are fine-tuned to write the spec in its own order; the schema constraint forces another order and fields
        # on them and makes them lose what the user asked for (measured: features, campaign, music all gone), so they get none.
        schema = None if self.model.startswith(TUNED_PREFIX) else kits.schema(kit)
        answer = self._chat_schema(messages, schema, cancel)
        try:
            spec = kits.parse_spec(answer, kit)
        except kits.SpecError as exc:
            raise GenerationError(str(exc)) from exc
        return kits.repair_spec(spec, kit)

    def _chat_schema(self, messages: list[dict], schema, cancel) -> str:
        extra = {"keep_alive": self.keep_alive} if self.keep_alive else {}
        if schema is not None:
            extra["schema"] = schema
        extra["max_tokens"] = SPEC_MAX_TOKENS
        try:
            return self.client.chat(self.model, messages, cancel=cancel, **extra)
        except OllamaError as exc:
            raise GenerationError(str(exc)) from exc

    def create_spec(self, description: str, kit: str, cancel: Callable[[], bool] | None = None, *,
                    memory: str = "") -> dict:
        user = f"Oyun tarifi:\n{description}\n\nÖzeti (tek JSON nesnesi) ver."
        spec = self._spec(kit, [_system(kits.system_prompt(kit), memory), {"role": "user", "content": user}], cancel)
        # the small model's gaps are closed by rules that read the description (specrules)
        if not self.model.startswith(TUNED_PREFIX):
            return spec
        return {"platformer": specrules.apply, "shooter": specrules.apply_shooter, "sandbox": specrules.apply_sandbox, "fps": specrules.apply_fps, "race": specrules.apply_race, "football": specrules.apply_football, "puzzle": specrules.apply_puzzle, "adventure": specrules.apply_adventure, "tower": specrules.apply_tower, "fighter": specrules.apply_fighter, "blast": specrules.apply_blast}.get(kit, lambda sp, text: sp)(spec, description)

    def edit_spec(self, spec: dict, request: str, kit: str, cancel: Callable[[], bool] | None = None, *,
                  memory: str = "") -> dict:
        user = (f"Oyunun şimdiki özeti:\n```json\n{json.dumps(spec, ensure_ascii=False, indent=1)}\n```\n\n"
                f"Kullanıcının isteği:\n{request}\n\nİsteği uygulayıp özetin TAMAMINI yeniden ver (tek JSON nesnesi).")
        new = self._spec(kit, [_system(kits.system_prompt(kit), memory), {"role": "user", "content": user}], cancel)
        return kits.keep_seeds(spec, new)   # an edit does not rebuild the levels

    def fix_spec(self, spec: dict, problems: list[str], kit: str, cancel: Callable[[], bool] | None = None, *,
                 memory: str = "") -> dict:
        user = (f"Oyunun özeti:\n```json\n{json.dumps(spec, ensure_ascii=False, indent=1)}\n```\n\nOyunda şu sorunlar bulundu:\n"
                + "\n".join(f"- {p}" for p in problems) + "\n\nÖzeti düzeltip TAMAMINI yeniden ver (tek JSON nesnesi).")
        new = self._spec(kit, [_system(kits.system_prompt(kit), memory), {"role": "user", "content": user}], cancel)
        return kits.keep_seeds(spec, new)

    def write_tests(self, html: str, checklist: list[str], cancel: Callable[[], bool] | None = None,
                    *, memory: str = "", modules=()) -> list[str | None]:
        answer = self._chat(build_test_messages(html, checklist, memory=memory, modules=modules), None, cancel)
        return parse_tests(answer, len(checklist))
