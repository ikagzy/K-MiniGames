"""Asks the model to write, change and fix the game, and to write the tests that check it.

The model answers in free text, so the answer is parsed strictly: only a complete HTML document counts as a game.
A cut-off or empty answer is an error, never a half game that could overwrite a working one."""
import json
import re
from collections.abc import Callable
from dataclasses import dataclass

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
    "- Oyun durumunu (skor, konum, can gibi) window.__game nesnesinde tut; uygulama testleri bu nesneyi okuyarak yapar.\n"
    "- Dokuları yalnızca assets/<dosya adı> yoluyla kullan; listedekilerden başka dosya uydurma. Canvas'ta drawImage ile "
    "çiz; getImageData kullanma.\n"
    "- Dış ağ adresi kullanma: kodda http:// ya da https:// geçmesin, kütüphane ya da yazı tipi indirme.\n"
    "- Oyun klavye (ok tuşları, boşluk) ve fare ile oynansın; sayfa açılır açılmaz çalışmaya hazır olsun."
)
_TESTER_RULES = (
    "Sen bir test yazarısın. Verilen oyun için, kontrol listesindeki her madde adına bir JavaScript işlev GÖVDESİ yaz. "
    "Gövde `game` parametresini (= window.__game) alır ve maddenin doğru olup olmadığını true/false döndürür; gerekirse "
    "`await` kullanabilir, oyuna document.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'})) ile tuş "
    "gönderip kısa bekleyebilir (await new Promise(r => setTimeout(r, 300))).\n"
    'Cevap yalnızca şu biçimde bir ```json bloğu olsun: {"tests": [{"index": 0, "code": "return true;"}]}'
)


def _system(rules: str, memory: str) -> dict:
    head = memory_notes.block(memory)
    return {"role": "system", "content": f"{head}\n\n{rules}" if head else rules}


def _texture_lines(textures: list[Texture]) -> str:
    if not textures:
        return "Doku yok; her şeyi kodla çiz."
    lines = []
    for t in textures:
        size = f"{t.width}x{t.height} piksel" if t.width and t.height else "boyutu bilinmiyor"
        lines.append(f"- assets/{t.file} ({size}): {t.description}")
    return "Kullanabileceğin dokular:\n" + "\n".join(lines)


def build_create_messages(description: str, textures: list[Texture], *, memory: str = "") -> list[dict]:
    user = f"Oyun tarifi:\n{description}\n\n{_texture_lines(textures)}"
    return [_system(_RULES, memory), {"role": "user", "content": user}]


def build_edit_messages(html: str, request: str, textures: list[Texture], checklist: list[str],
                        resolved: list[str] = (), *, memory: str = "") -> list[dict]:
    parts = [f"Mevcut oyun:\n```html\n{html}\n```", f"Kullanıcının isteği:\n{request}", _texture_lines(textures)]
    if checklist:
        parts.append("Oyunun kontrol listesi (bozma):\n" + "\n".join(f"- {c}" for c in checklist))
    if resolved:
        parts.append("Daha önce çözülen hatalar (bunları tekrarlama):\n" + "\n".join(f"- {r}" for r in resolved))
    parts.append("İsteği uygula ve oyunun tamamını yeniden ver; yeni ya da değişen kontrol listesini de yaz.")
    return [_system(_RULES, memory), {"role": "user", "content": "\n\n".join(parts)}]


def build_fix_messages(html: str, problems: list[str], *, memory: str = "") -> list[dict]:
    user = ("Oyunda şu sorunlar bulundu. Hepsini düzelt, oyunun geri kalanını bozma ve oyunun tamamını yeniden ver:\n"
            + "\n".join(f"- {p}" for p in problems) + f"\n\nOyun:\n```html\n{html}\n```")
    return [_system(_RULES, memory), {"role": "user", "content": user}]


def build_test_messages(html: str, checklist: list[str], *, memory: str = "") -> list[dict]:
    items = "\n".join(f"{i}: {text}" for i, text in enumerate(checklist))
    user = f"Oyun:\n```html\n{html}\n```\n\nKontrol listesi:\n{items}"
    return [_system(_TESTER_RULES, memory), {"role": "user", "content": user}]


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
            break
    return result


class Generator:
    def __init__(self, client, model: str):
        self.client, self.model = client, model

    def _chat(self, messages: list[dict], on_token=None, cancel=None) -> str:
        try:
            return self.client.chat(self.model, messages, on_token=on_token, cancel=cancel)
        except OllamaError as exc:
            raise GenerationError(str(exc)) from exc

    def _game(self, messages: list[dict], on_token, cancel) -> Generated:
        generated = parse_response(self._chat(messages, on_token, cancel))
        if generated is None:
            raise GenerationError("Modelin cevabında tam bir oyun yok (boş ya da yarıda kesilmiş)")
        return generated

    def create(self, description: str, textures: list[Texture], on_token: Callable | None = None,
               cancel: Callable[[], bool] | None = None, *, memory: str = "") -> Generated:
        return self._game(build_create_messages(description, textures, memory=memory), on_token, cancel)

    def edit(self, html: str, request: str, textures: list[Texture], checklist: list[str],
             resolved: list[str] = (), on_token: Callable | None = None, cancel: Callable[[], bool] | None = None,
             *, memory: str = "") -> Generated:
        return self._game(build_edit_messages(html, request, textures, checklist, resolved, memory=memory),
                          on_token, cancel)

    def fix(self, html: str, problems: list[str], on_token: Callable | None = None,
            cancel: Callable[[], bool] | None = None, *, memory: str = "") -> Generated:
        return self._game(build_fix_messages(html, problems, memory=memory), on_token, cancel)

    def write_tests(self, html: str, checklist: list[str], cancel: Callable[[], bool] | None = None,
                    *, memory: str = "") -> list[str | None]:
        answer = self._chat(build_test_messages(html, checklist, memory=memory), None, cancel)
        return parse_tests(answer, len(checklist))
