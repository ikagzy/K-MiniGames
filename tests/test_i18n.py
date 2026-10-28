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
