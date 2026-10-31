from k_minigames import specrules


def spec(**extra):
    return {"kit": "platformer", "generate": [{"seed": 1, "coins": 2}], **extra}


def test_a_theme_word_sets_the_theme_but_two_themes_leave_the_models_choice():
    assert specrules.apply(spec(), "Ormanda geçen bir oyun")["theme"] == "forest"
    assert specrules.apply(spec(theme="sky"), "Gece vakti, uzayda")["theme"] == "sky"


def test_features_and_the_fox_are_added_unless_the_text_says_it_does_not_want_them():
    out = specrules.apply(spec(), "Turuncu tilkiyle oynadığım, yaylar ve buz olan bir oyun")
    assert out["hero"]["character"] == "runner" and set(out["features"]) == {"spring", "ice"}
    assert "features" not in specrules.apply(spec(), "buz olmasın")


def test_amounts_need_the_thing_they_count_and_flying_enemies_are_not_enemies():
    out = specrules.apply(spec(), "Bol altın, az çukur, çok uçan düşman, düşman olmasın")
    level = out["generate"][0]
    assert level["coins"] == 4 and level["pits"] == 1 and level["flyers"] == 4 and level["enemies"] == 0


def test_campaign_numbers_can_be_spelled_out_and_lives_are_read():
    assert specrules.apply(spec(), "On iki bölümlük bir macera")["campaign"]["count"] == 12
    assert "campaign" not in specrules.apply(spec(), "üç bölümlük macera")
    assert specrules.apply(spec(), "Beş canlı bir kahraman")["hero"]["lives"] == 5
    assert specrules.apply(spec(), "tek canlı")["hero"]["lives"] == 1


def test_mood_needs_the_word_music_and_difficulty_a_clear_word():
    assert specrules.apply(spec(), "gizemli müzikli bir oyun")["musicStyle"]["mood"] == "mystery"
    assert "musicStyle" not in specrules.apply(spec(), "gizemli bir orman")
    assert specrules.apply(spec(), "çok zor bir oyun")["generate"][0]["difficulty"] == 5
    assert "difficulty" not in specrules.apply(spec(), "kolaydan zora giden")["generate"][0]
