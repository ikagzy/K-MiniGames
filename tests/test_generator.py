import pytest

from k_minigames import generator
from k_minigames.generator import (GenerationError, Generated, Generator, build_create_messages,
                                   build_edit_messages, build_fix_messages, build_test_messages,
                                   parse_response, parse_tests)
from k_minigames.library import Texture
from k_minigames.ollama_client import OllamaError

DOC = "<!doctype html>\n<html><body><script>window.__game = {};</script></body></html>"
TEXTURES = [Texture("zemin.png", "zemin karosu", 64, 32), Texture("dusman.png", "kırmızı düşman", 0, 0)]


def text_of(messages) -> str:
    return "\n".join(m["content"] for m in messages)


class FakeClient:
    def __init__(self, *answers):
        self.answers, self.calls = list(answers), []

    def chat(self, model, messages, on_token=None, cancel=None):
        self.calls.append((model, messages))
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer


# --- prompts ---------------------------------------------------------------------------------

def test_the_create_prompt_names_the_texture_files_sizes_and_descriptions():
    text = text_of(build_create_messages("uzay oyunu", TEXTURES))
    assert "uzay oyunu" in text
    assert "assets/zemin.png" in text and "64x32" in text and "zemin karosu" in text
    assert "assets/dusman.png" in text and "kırmızı düşman" in text and "boyutu bilinmiyor" in text


def test_the_system_prompt_pins_the_rules_the_checker_relies_on():
    system = build_create_messages("x", [])[0]["content"]
    for phrase in ("window.__game", "getImageData", "http://", "https://", "oyun.html", "assets/"):
        assert phrase in system


def test_the_edit_prompt_carries_the_current_html_and_the_request():
    text = text_of(build_edit_messages(DOC, "topu hızlandır", TEXTURES, ["oyun açılıyor"]))
    assert DOC in text and "topu hızlandır" in text and "oyun açılıyor" in text


def test_resolved_errors_are_listed_only_when_there_are_some():
    with_resolved = text_of(build_edit_messages(DOC, "x", [], [], resolved=["resim yüklenemedi"]))
    assert "Daha önce çözülen hatalar (bunları tekrarlama)" in with_resolved and "resim yüklenemedi" in with_resolved
    assert "Daha önce çözülen hatalar" not in text_of(build_edit_messages(DOC, "x", [], []))


def test_the_fix_prompt_lists_the_problems_and_the_html():
    text = text_of(build_fix_messages(DOC, ["assets/yok.png bulunamadı", "ReferenceError: x"]))
    assert "assets/yok.png bulunamadı" in text and "ReferenceError: x" in text and DOC in text


def test_the_test_prompt_lists_the_checklist_items_by_index():
    text = text_of(build_test_messages(DOC, ["oyun açılıyor", "skor artıyor"]))
    assert "0: oyun açılıyor" in text and "1: skor artıyor" in text


def test_memory_leads_the_first_message_of_every_prompt_and_is_absent_when_empty():
    builders = [
        lambda m: build_create_messages("x", [], memory=m),
        lambda m: build_edit_messages(DOC, "x", [], [], memory=m),
        lambda m: build_fix_messages(DOC, ["p"], memory=m),
        lambda m: build_test_messages(DOC, ["a"], memory=m),
    ]
    for build in builders:
        assert build("Amaç: zıplayan kare")[0]["content"].startswith("HAFIZA (bunu unutma):\nAmaç: zıplayan kare")
        assert "HAFIZA" not in text_of(build(""))


# --- parsing (Review Focus 2) -----------------------------------------------------------------

def test_a_fenced_html_block_and_a_checklist_are_parsed():
    reply = f"İşte oyun:\n```html\n{DOC}\n```\n```json\n{{\"checklist\": [\"oyun açılıyor\", \"skor artıyor\"]}}\n```"
    assert parse_response(reply) == Generated(DOC, ["oyun açılıyor", "skor artıyor"])


def test_an_unfenced_document_is_found_inside_chatter():
    reply = f"Tamamdır!\n{DOC}\nİyi eğlenceler."
    assert parse_response(reply).html == DOC


def test_with_several_blocks_the_last_complete_one_wins():
    reply = f"```html\n<html><body>eski</body></html>\n```\ndüzelttim:\n```html\n{DOC}\n```"
    assert parse_response(reply).html == DOC


def test_a_cut_off_answer_without_the_closing_tag_is_not_a_game():
    assert parse_response("```html\n<!doctype html><html><body><script>let x = 1;") is None


def test_an_answer_without_any_html_is_not_a_game():
    assert parse_response("Üzgünüm, bunu yapamam.") is None
    assert parse_response("") is None


def test_a_missing_or_broken_checklist_is_just_empty():
    assert parse_response(f"```html\n{DOC}\n```").checklist == []
    assert parse_response(f"```html\n{DOC}\n```\n```json\n{{bozuk\n```").checklist == []


def test_parse_tests_maps_codes_to_their_index_and_leaves_gaps_empty():
    reply = '```json\n{"tests": [{"index": 0, "code": "return true;"}, {"index": 2, "code": "return game.skor > 0;"}]}\n```'
    assert parse_tests(reply, 3) == ["return true;", None, "return game.skor > 0;"]
    assert parse_tests("anlamadım", 2) == [None, None]


# --- Generator --------------------------------------------------------------------------------

def test_create_returns_the_generated_game():
    client = FakeClient(f"```html\n{DOC}\n```\n```json\n{{\"checklist\": [\"a\"]}}\n```")
    result = Generator(client, "qwen2.5-coder:7b").create("uzay oyunu", [])
    assert result == Generated(DOC, ["a"]) and client.calls[0][0] == "qwen2.5-coder:7b"


def test_create_raises_and_never_returns_a_partial_game():
    gen = Generator(FakeClient("<html><body>yarım"), "m")
    with pytest.raises(GenerationError):
        gen.create("x", [])


def test_edit_and_fix_use_their_own_prompts_and_return_the_new_game():
    client = FakeClient(f"```html\n{DOC}\n```", f"```html\n{DOC}\n```")
    gen = Generator(client, "m")
    assert gen.edit("<html></html>", "hızlandır", [], ["a"], resolved=["x"], memory="Amaç: kare").html == DOC
    assert gen.fix("<html></html>", ["hata"]).html == DOC
    assert "hızlandır" in text_of(client.calls[0][1]) and "hata" in text_of(client.calls[1][1])
    assert client.calls[0][1][0]["content"].startswith("HAFIZA (bunu unutma):\nAmaç: kare")


def test_an_ollama_failure_becomes_a_generation_error():
    gen = Generator(FakeClient(OllamaError("bağlantı koptu")), "m")
    with pytest.raises(GenerationError, match="bağlantı koptu"):
        gen.create("x", [])


def test_write_tests_returns_one_code_or_none_per_checklist_item():
    client = FakeClient('```json\n{"tests": [{"index": 1, "code": "return true;"}]}\n```')
    assert Generator(client, "m").write_tests(DOC, ["a", "b"]) == [None, "return true;"]


def test_module_exposes_the_error_type():
    assert issubclass(generator.GenerationError, Exception)


# --- found in a real run with llama3.1:8b ---------------------------------------------------------------

def test_parse_tests_reads_code_written_as_a_template_literal_across_several_lines():
    reply = ("Aşağıdaki JSON bloğu:\n```json\n{\n  \"tests\": [\n    {\n      \"index\": 0,\n      \"code\": `\n"
             "        return game.score === 0;\n      `\n    },\n    {\"index\": 1, \"code\": \"return true;\"}\n  ]\n}\n```")
    out = parse_tests(reply, 3)
    assert out[0].strip() == "return game.score === 0;" and out[1] == "return true;" and out[2] is None


def test_parse_tests_keeps_the_good_entries_of_a_json_with_one_broken_one():
    reply = '{"tests": [{"index": 0, "code": "return 1;"}, {"index": 1, "code": `return 2;`}]}'
    assert parse_tests(reply, 2) == ["return 1;", "return 2;"]


def test_the_rules_ask_for_checklist_items_about_the_users_game_and_not_about_technical_rules():
    system = build_create_messages("x", [])[0]["content"]
    assert "oyunun nasıl oynandığını" in system and "teknik kuralları" in system


def test_the_tester_rules_ask_for_plain_json_strings_without_backticks():
    system = build_test_messages(DOC, ["a"])[0]["content"]
    assert "ters tırnak" in system and "tek satır" in system
