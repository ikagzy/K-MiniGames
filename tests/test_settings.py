from k_minigames import settings


def test_load_of_corrupt_json_is_empty():
    settings.app_dir().mkdir(parents=True, exist_ok=True)
    (settings.app_dir() / "settings.json").write_text("{bozuk", encoding="utf-8")
    assert settings.load() == {}


def test_save_and_load_round_trip_keeps_turkish_text():
    assert settings.save({"ad": "Çöl Koşusu"}) is True
    assert settings.load() == {"ad": "Çöl Koşusu"}


def test_put_and_get_a_value():
    assert settings.get("game_model", "yok") == "yok"
    assert settings.put("game_model", "qwen2.5-coder:7b") is True
    assert settings.get("game_model") == "qwen2.5-coder:7b"


def test_games_dir_is_none_when_unset_or_when_the_folder_was_removed(tmp_path):
    assert settings.games_dir() is None
    folder = tmp_path / "Oyunlar"
    folder.mkdir()
    assert settings.set_games_dir(folder) is True
    assert settings.games_dir() == folder
    folder.rmdir()
    assert settings.games_dir() is None


def test_register_exe_stores_the_path(tmp_path):
    exe = tmp_path / "K-MiniGames.exe"
    assert settings.register_exe(exe) is True
    assert settings.get("exe_path") == str(exe)
