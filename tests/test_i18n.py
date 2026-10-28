import json

from k_minigames import i18n


def test_english_swaps_a_known_phrase():
    i18n.set_language("en")
    assert i18n.t("Oyun klasörü") == "Games folder"


def test_turkish_keeps_the_text():
    i18n.set_language("tr")
    assert i18n.t("Oyun klasörü") == "Oyun klasörü"


def test_unknown_language_falls_back_to_turkish():
    i18n.set_language("xx")
    assert i18n.current() == "tr"


def test_follow_picks_up_the_language_chosen_in_k_series():
    path = i18n.settings_path()
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps({"language": "en"}), encoding="utf-8")
    i18n.set_language("tr")
    assert i18n.follow() is True
    assert i18n.current() == "en"
    assert i18n.follow() is False


def test_the_setup_screen_texts_have_english_versions():
    i18n.set_language("en")
    assert i18n.t("Ollama'yı indir (yaklaşık 1.2 GB)") == "Download Ollama (about 1.2 GB)"
    assert i18n.t("Danışmanı indir (yaklaşık 3.4 GB)") == "Download the advisor (about 3.4 GB)"
    assert i18n.t("Ollama hazır ✓") == "Ollama ready ✓" and i18n.t("Devam →") == "Continue →"
    assert i18n.t("İptal edildi") == "Cancelled" and i18n.t("İptal") == "Cancel"


def test_a_confirmation_with_a_model_name_is_translated_around_the_name():
    i18n.set_language("en")
    text = ("Bilgisayarında llama3.1:8b modeli zaten kurulu (yaklaşık 4.6 GB) ve bu iş için yeterli.\n\n"
            "Bunu danışman olarak kullanayım mı?")
    assert i18n.t(text) == ("On your computer, llama3.1:8b model is already installed (about 4.6 GB) and is enough "
                            "for this job.\n\nShall I use it as the advisor?")
    assert i18n.t("qwen3.5:4b modeli Ollama üzerinden indirilecek (yaklaşık 3.4 GB).\n\nİndirilsin mi?") == (
        "qwen3.5:4b model will be downloaded through Ollama (about 3.4 GB).\n\nShould I download it?")


def test_the_cancel_message_has_an_english_version():
    from k_minigames.startup import CANCEL_MESSAGE
    i18n.set_language("en")
    assert i18n.t(CANCEL_MESSAGE) == "I cannot go on without a model. You can try again whenever you like."


def test_the_advisor_screen_texts_have_english_versions():
    i18n.set_language("en")
    assert i18n.t("Merhaba! Nasıl bir oyun yapmak istiyorsun?") == "Hello! What kind of game do you want to make?"
    assert i18n.t("Tamam! Oyunlarını qwen2.5-coder:7b modeliyle yazacağız. Hadi başlayalım!") == (
        "Okay! We will write your games with qwen2.5-coder:7b model. Let's start!")
    assert i18n.t("(uydurma:9b katalogda yok)") == "(uydurma:9b is not in the catalog)"
    assert i18n.t("(qwen2.5-coder:32b bu bilgisayara sığmıyor)") == "(qwen2.5-coder:32b does not fit this computer)"
    assert i18n.t("Bilgisayarında x modeli zaten kurulu (yaklaşık 4.6 GB) ve bu iş için yeterli.\n\n"
                  "Bunu oyunları yazmak için kullanayım mı?").endswith("Shall I use it to write your games?")


def test_the_library_and_studio_texts_have_english_versions():
    i18n.set_language("en")
    assert i18n.t("4 madde geçti\n1 madde doğrulanamadı\n2 kez otomatik düzelttim") == (
        "4 items passed\n1 items could not be verified\n2 automatic fixes made")
    assert i18n.t("Hata buldum, düzeltiyorum (2/3)") == "I found a bug, fixing it (2/3)"
    assert i18n.t("BOB") == "BOB" and i18n.t("DON") == "DON" and i18n.t("Yeni oyun") == "New game"
    assert i18n.t("Tamam, 2. sürüme döndüm.") == "Okay, I went back to version 2."
    assert i18n.t("Dikkat: oyun bir dış ağ adresi kullanıyor (https://x.y)") == (
        "Warning: the game uses an external web address (https://x.y)")


def test_a_phrase_is_not_replaced_inside_a_longer_word_or_file_name():
    i18n.set_language("en")
    assert i18n.t("SENSOR.png") == "SENSOR.png" and i18n.t("Oynanış.png") == "Oynanış.png"
    assert i18n.t("SEN") == "YOU" and i18n.t("Oyna") == "Play"
    assert i18n.t("zemin.png bir resim değil.") == "zemin.png is not a picture."
