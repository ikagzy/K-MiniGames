"""Turkish and English for K-MiniGames. The source text is Turkish; `t()` swaps known phrases for English when the
interface language is English. Phrases are replaced longest first, so a long sentence wins over the words in it.
The language is chosen in K-Series' settings (%APPDATA%/K-Series/settings.json); K-MiniGames follows it."""
import json
import locale
import os
import re
from pathlib import Path

LANGUAGES = (("tr", "Türkçe"), ("en", "English"))

_PAIRS = {
    "Oyun klasörü": "Games folder",
    "DANIŞMAN": "ADVISOR", "SEN": "YOU", "Gönder": "Send",
    # setup screen
    "Merhaba! Başlamak için Ollama'nın ve bir danışman modelin hazır olması lazım. Sormadan hiçbir şey indirmem.":
        "Hello! To start, Ollama and an advisor model must be ready. I will not download anything without asking.",
    "Ollama'yı indir": "Download Ollama", " (yaklaşık ": " (about ", "Ollama'yı başlat": "Start Ollama",
    "Ollama hazır ✓": "Ollama ready ✓", "Danışmanı indir": "Download the advisor",
    "Danışman modelini seç": "Choose the advisor model", "Danışman hazır ✓": "Advisor ready ✓",
    "Klasör seç": "Choose folder", "seçilmedi": "not chosen", "Devam →": "Continue →",
    "İptal edildi": "Cancelled", "İptal ediliyor…": "Cancelling…", "İptal": "Cancel",
    "İndiriliyor…": "Downloading…", "Ollama başlatılıyor…": "Starting Ollama…",
    "Ollama başlatılamadı.": "Could not start Ollama.",
    "Model indirilemedi ya da iptal edildi.": "The model could not be downloaded or was cancelled.",
    "Durum okunamadı": "Could not read the state", "Klasör kullanılamıyor": "Folder cannot be used",
    "Bu klasöre yazılamıyor ya da diskte yeterli yer yok.":
        "Cannot write to this folder, or there is not enough disk space.",
    "Kurulu model bulundu": "Installed model found", "Danışman modeli indirilsin mi?": "Download the advisor model?",
    "Ollama indirilsin mi?": "Download Ollama?", "bilinmiyor": "unknown",
    "Bilgisayarında ": "On your computer, ", " modeli zaten kurulu (yaklaşık ": " model is already installed (about ",
    ") ve bu iş için yeterli.\n\nBunu danışman olarak kullanayım mı?":
        ") and is enough for this job.\n\nShall I use it as the advisor?",
    " modeli Ollama üzerinden indirilecek (yaklaşık ": " model will be downloaded through Ollama (about ",
    ").\n\nİndirilsin mi?": ").\n\nShould I download it?",
    "Ollama'nın kurulum dosyası şu adresten indirilecek:\n": "Ollama's setup file will be downloaded from:\n",
    "\nBoyut: ": "\nSize: ", "\n\nİndirilsin ve kurulsun mu?": "\n\nDownload and install it?",
    "Model kurulmadığı için devam edemiyorum. İstediğin zaman yeniden deneyebilirsin.":
        "I cannot go on without a model. You can try again whenever you like.",
    "İndirme olmadı. İnternet bağlantını kontrol edip tekrar dene.":
        "The download failed. Check your internet connection and try again.",
    # advisor screen
    "Merhaba! Nasıl bir oyun yapmak istiyorsun?": "Hello! What kind of game do you want to make?",
    "Ollama'ya ulaşamadım. Çalışıp çalışmadığını kontrol edip tekrar yazar mısın?":
        "I could not reach Ollama. Could you check that it is running and write again?",
    "Model indirilemedi. İstersen tekrar deneyelim.": "The model could not be downloaded. We can try again if you like.",
    "Oyun modeli indirilsin mi?": "Download the game model?",
    ") ve bu iş için yeterli.\n\nBunu oyunları yazmak için kullanayım mı?":
        ") and is enough for this job.\n\nShall I use it to write your games?",
    "Tamam! Oyunlarını ": "Okay! We will write your games with ", " modeliyle yazacağız. Hadi başlayalım!": " model. Let's start!",
    " katalogda yok": " is not in the catalog", " bu bilgisayara sığmıyor": " does not fit this computer",
    "danışman model önermedi": "the advisor proposed no model",
    "; bilgisayar zayıf, en küçük model denenebilir": "; this computer is weak, the smallest model can be tried",
    "Kurulum dosyası başlatılamadı.": "The setup file could not be started.",
    "Ollama kuruldu ama çalışmadı. Birazdan 'Ollama'yı başlat' düğmesini dene.":
        "Ollama was installed but did not start. Try the 'Start Ollama' button in a moment.",
}


def _alt(key: str) -> str:
    return re.escape(key)


_PATTERN = re.compile("|".join(_alt(k) for k in sorted(_PAIRS, key=len, reverse=True)))

_lang = "tr"


def system_default() -> str:
    try:
        code = locale.getlocale()[0] or ""
    except (ValueError, AttributeError):
        code = ""
    return "tr" if code.lower().startswith(("tr", "turkish")) else "en"


def settings_path() -> Path:
    return Path(os.environ.get("APPDATA") or Path.home()) / "K-Series" / "settings.json"


def saved_language() -> str:
    """The language K-Series saved, else the system's."""
    try:
        code = json.loads(settings_path().read_text(encoding="utf-8")).get("language")
    except (OSError, ValueError, AttributeError):
        code = None
    return code if code in dict(LANGUAGES) else system_default()


def set_language(code: str) -> None:
    global _lang
    _lang = code if code in dict(LANGUAGES) else "tr"


def follow() -> bool:
    """Pick up a language change made in K-Series. True when the language changed."""
    before = _lang
    set_language(saved_language())
    return _lang != before


def current() -> str:
    return _lang


def t(text: str) -> str:
    """The text in the interface language (unknown text is returned as it is)."""
    if _lang == "tr" or not text:
        return text
    return _PATTERN.sub(lambda m: _PAIRS[m.group(0)], text)
