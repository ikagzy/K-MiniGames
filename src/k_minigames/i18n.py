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
    "SEN": "YOU", "Gönder": "Send",   # DON and BOB are names: they stay the same in every language
    # setup screen
    "Merhaba! Önce Ollama ve bir danışman model lazım.": "Hello! First we need Ollama and an advisor model.",
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
    # library and studio (the bellhop)
    "Oyunların burada. Birini seç ya da yeni oyun yap!": "Your games are here. Pick one or make a new one!",
    "Henüz oyunun yok. Hadi ilkini yapalım!": "You have no games yet. Let's make your first one!",
    "Oyna": "Play", "Düzenle": "Edit", "Klasörü aç": "Open folder", "Yeni oyun": "New game",
    "Kütüphane": "Library", "Tekrar dene": "Try again", "Doku ekle": "Add texture",
    "Eski sürüme dön": "Go back to an older version",
    "Oyununa ne ad verelim?": "What should we call your game?",
    "Nasıl bir oyun istiyorsun? Anlat bakalım. İstersen önce sağ üstteki 'Doku ekle' ile resimlerini ekleyebilirsin.":
        "What kind of game do you want? Tell me. If you like, add your pictures first with 'Add texture' at the top right.",
    "Ne değiştirmek istiyorsun?": "What do you want to change?",
    "Ollama çalışmıyor. Açıp tekrar dener misin?": "Ollama is not running. Could you start it and try again?",
    "Oyunu üretemedim": "I could not make the game", "Hazır!": "Ready!",
    "Oyun üretiliyor…": "Making the game…", "Değişiklik yapılıyor…": "Making the change…",
    "Oyun deneniyor, sekmeyi kapatma": "Trying the game, do not close the tab",
    "Hata buldum, düzeltiyorum (": "I found a bug, fixing it (",
    " madde geçti": " items passed", " madde doğrulanamadı": " items could not be verified",
    " madde kaldı": " items failed", " kez otomatik düzelttim": " automatic fixes made",
    "Hata kaldı: ": "Error left: ", "Sorun kaldı: ": "Problem left: ", "… ve ": "… and ", " hata daha": " more errors",
    "Dikkat: oyun konsola ": "Warning: the game writes ", " hata mesajı yazıyor": " error messages to the console",
    "İndirme iptal edildi.": "The download was cancelled.",
    "Ollama hata verdi (HTTP ": "Ollama reported an error (HTTP ",
    "Oyun tarayıcıda denenemedi; çalıştığını doğrulayamadım.":
        "The game could not be tried in the browser; I could not confirm that it works.",
    "Dikkat: oyun bir dış ağ adresi kullanıyor": "Warning: the game uses an external web address",
    "Bu düzenleme çalışmadı; oyunun önceki hâli korundu.": "This change did not work; the earlier version of the game was kept.",
    "Doku açıklaması": "Texture description",
    " ne için kullanılsın? (örn. zemin, düşman)": " - what should it be used for? (e.g. ground, enemy)",
    " bir resim değil.": " is not a picture.", "Önce oyunun adını yaz.": "Type the game's name first.",
    "Henüz eski bir sürüm yok.": "There is no older version yet.",
    "Hangi sürüme dönelim? Var olanlar: ": "Which version should we go back to? Available: ",
    "Tamam, ": "Okay, I went back to version ", ". sürüme döndüm.": ".",
    "Kurulum dosyası başlatılamadı.": "The setup file could not be started.",
    "Ollama kuruldu ama çalışmadı. Birazdan 'Ollama'yı başlat' düğmesini dene.":
        "Ollama was installed but did not start. Try the 'Start Ollama' button in a moment.",
    # introductions: the characters say their names
    "Ben Don! Önce Ollama ve bir model lazım.": "I'm Don! First we need Ollama and a model.",
    "Ben Don. Ayarlar: Ollama, model, klasör.": "I'm Don. Settings: Ollama, model, folder.",
    "Ben Don, danışmanın! ": "I'm Don, your advisor! ", "Nasıl bir oyun yapmak istiyorsun?": "What kind of game do you want to make?",
    "Ben Bob! Oyunların burada, birini seç.": "I'm Bob! Your games are here, pick one.",
    "Ben Bob! Henüz oyunun yok, ilkini yapalım!": "I'm Bob! You have no games yet, let's make the first!",
    "Ben Bob! ": "I'm Bob! ",
    "Don bana şunları anlattı:\n": "Don told me this:\n",
    "\nBunu yapayım mı? 'evet' yaz ya da eklemek istediklerini yaz.":
        "\nShall I make it? Type 'yes' or write what you want to add.",
    # title and settings
    "Başla": "Start", "Ayarlar": "Settings", "Çıkış": "Quit", "← Geri": "← Back", "Hafızayı sil": "Forget memory",
    "Ayarlar: Ollama, model ve klasör.": "Settings: Ollama, model and folder.",
    "Hafıza silinsin mi?": "Delete the memory?",
    "Don'un senin hakkında hatırladıkları silinecek.": "What Don remembers about you will be deleted.",
    "Hafıza silindi": "Memory deleted", "Don artık seni yeniden tanıyacak.": "Don will get to know you again.",
}


def _alt(key: str) -> str:
    """The phrase as a regex; a phrase that starts or ends with a letter does not match inside a longer word
    (so `SEN` is not found in `SENSOR.png`)."""
    left = r"(?<!\w)" if key[0].isalnum() else ""
    right = r"(?!\w)" if key[-1].isalnum() else ""
    return left + re.escape(key) + right


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
