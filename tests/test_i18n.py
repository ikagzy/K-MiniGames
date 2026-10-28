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
