import pytest

from k_minigames import library, memory, settings
from k_minigames.ollama_client import OllamaError


class Chat:
    """Stands in for the Ollama client: answers with a scripted text or fails, and remembers what it was asked."""
    def __init__(self, answer="", error=None):
        self.answer, self.error, self.calls = answer, error, []

    def chat(self, model, messages, on_token=None, cancel=None):
        self.calls.append((model, messages))
        if self.error:
            raise self.error
        return self.answer


def test_block_is_empty_for_no_memory_and_titled_otherwise():
    assert memory.block("") == "" and memory.block("   ") == ""
    assert memory.block("x") == "HAFIZA (bunu unutma):\nx"


def test_the_two_memory_files_live_where_the_spec_says(tmp_path):
    game = library.create_game(tmp_path, "Uzay")
    assert memory.game_path(game) == game.folder / "hafiza.md"
    assert memory.advisor_path() == settings.app_dir() / "danisman_hafiza.md"


def test_a_missing_memory_file_is_an_empty_memory():
    assert memory.load(settings.app_dir() / "yok.md") == ""


def test_save_and_load_keep_turkish_text_and_survive_a_restart(tmp_path):
    path = tmp_path / "klasör" / "hafiza.md"
    assert memory.save(path, "Amaç: zıplayan çöl şövalyesi\n- ok tuşlarıyla") is True
    assert memory.load(path) == "Amaç: zıplayan çöl şövalyesi\n- ok tuşlarıyla"


def test_update_returns_the_summary_the_model_wrote():
    chat = Chat("  Amaç: uzay oyunu\n- zıplasın  ")
    assert memory.update(chat, "m", "", "uzay oyunu istiyorum", "Hangi tür?") == "Amaç: uzay oyunu\n- zıplasın"


def test_the_summary_request_contains_the_old_memory_and_the_new_exchange():
    chat = Chat("yeni özet")
    memory.update(chat, "qwen", "Amaç: kare", "topu hızlandır", "Tamam, hızlandırdım.")
    model, messages = chat.calls[0]
    text = "\n".join(m["content"] for m in messages)
    assert model == "qwen" and "Amaç: kare" in text and "topu hızlandır" in text and "Tamam, hızlandırdım." in text
    assert "HAFIZA (bunu unutma)" not in text


def test_when_the_model_fails_the_old_memory_is_kept_and_the_request_is_added_as_a_line():
    result = memory.update(Chat(error=OllamaError("kapalı")), "m", "Amaç: uzay oyunu", "renkler mor olsun", "ok")
    assert result == "Amaç: uzay oyunu\n- renkler mor olsun"


def test_a_client_that_cannot_chat_at_all_never_crashes_the_update():
    assert memory.update(object(), "m", "", "merhaba", "selam") == "- merhaba"


def test_an_empty_or_absurdly_long_summary_is_replaced_by_the_fallback():
    assert memory.update(Chat("   "), "m", "Amaç: x", "istek", "cevap") == "Amaç: x\n- istek"
    assert memory.update(Chat("a" * 5000), "m", "Amaç: x", "istek", "cevap") == "Amaç: x\n- istek"


def test_a_slightly_long_summary_is_cut_to_the_limit_keeping_the_first_line_and_the_newest_lines():
    lines = ["Amaç: uzay oyunu"] + [f"- madde {i:03d} " + "x" * 40 for i in range(30)]
    result = memory.update(Chat("\n".join(lines)), "m", "", "u", "r")
    assert len(result) <= memory.MAX_CHARS
    assert result.splitlines()[0] == "Amaç: uzay oyunu" and result.splitlines()[-1].startswith("- madde 029")
    assert "madde 000" not in result


def test_the_fallback_never_grows_past_the_limit_and_keeps_the_first_line():
    previous = ""
    for i in range(60):
        previous = memory.update(Chat(error=OllamaError("kapalı")), "m", previous or "Amaç: uzay oyunu",
                                 f"istek numara {i} " + "y" * 150, "cevap")
        assert len(previous) <= memory.MAX_CHARS
    assert previous.splitlines()[0] == "Amaç: uzay oyunu" and previous.splitlines()[-1].startswith("- istek numara 59")


def test_a_long_request_is_cut_to_two_hundred_characters_in_the_fallback():
    result = memory.update(Chat(error=OllamaError("x")), "m", "A", "q" * 500, "r")
    assert result == "A\n- " + "q" * 200


def test_a_multi_line_request_stays_on_one_line_in_the_fallback():
    assert memory.update(Chat(error=OllamaError("x")), "m", "A", "satır bir\nsatır iki", "r") == "A\n- satır bir satır iki"
