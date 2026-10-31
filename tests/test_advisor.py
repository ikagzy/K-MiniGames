from k_minigames import advisor, catalog, memory
from k_minigames.advisor import Advisor, AdvisorReply, extract_proposal


class FakeClient:
    def __init__(self, answer: str):
        self.answer, self.calls = answer, []

    def chat(self, model, messages, on_token=None, cancel=None, **kwargs):
        self.calls.append((model, messages))
        if on_token:
            on_token(self.answer)
        return self.answer


def test_a_plain_json_line_is_the_proposal():
    assert extract_proposal('Bunu öneririm.\n{"model": "qwen2.5-coder:7b"}') == "qwen2.5-coder:7b"


def test_a_json_line_inside_a_code_fence_is_found():
    assert extract_proposal('Öneri:\n```json\n{"model": "qwen2.5-coder:3b"}\n```') == "qwen2.5-coder:3b"


def test_the_last_proposal_wins_when_there_are_several():
    text = '{"model": "a:1"} sonra fikir değiştirdim {"model": "b:2"}'
    assert extract_proposal(text) == "b:2"


def test_broken_or_incomplete_json_is_no_proposal():
    assert extract_proposal('{"model": "a:1"') is None
    assert extract_proposal('{"baska": "a:1"}') is None
    assert extract_proposal("") is None


def test_the_system_prompt_lists_every_coder_model():
    prompt = advisor.system_prompt()
    for model in catalog.coders():
        assert model.id in prompt


def test_ask_sends_system_history_and_the_new_message_in_order():
    client = FakeClient("Hangi türde bir oyun?")
    history = [{"role": "user", "content": "selam"}, {"role": "assistant", "content": "merhaba"}]
    reply = Advisor(client, "qwen2.5:3b").ask(history, "uzay oyunu istiyorum")
    model, messages = client.calls[0]
    assert model == "qwen2.5:3b"
    assert messages[0] == {"role": "system", "content": advisor.system_prompt()}
    assert messages[1:3] == history
    assert messages[3] == {"role": "user", "content": "uzay oyunu istiyorum"}
    assert reply == AdvisorReply("Hangi türde bir oyun?", None)


def test_the_json_line_is_a_proposal_and_not_part_of_the_shown_text():
    client = FakeClient('Harika, şunu öneririm.\n{"model": "qwen2.5-coder:7b"}')
    reply = Advisor(client, "m").ask([], "ormanlı, büyük, mağaralı ve göllü bir küp dünya yap, geceleri zombi çıksın")
    assert reply.proposal == "qwen2.5-coder:7b" and reply.text == "Harika, şunu öneririm."


def test_a_fenced_json_line_leaves_no_empty_fence_in_the_text():
    client = FakeClient('Öneri:\n```json\n{"model": "a:1"}\n```')
    assert Advisor(client, "m").ask([], "ormanlı, büyük, mağaralı ve göllü bir küp dünya yap, geceleri zombi çıksın").text == "Öneri:"


def test_memory_comes_first_in_the_system_message():
    client = FakeClient("Tamam.")
    Advisor(client, "m").ask([], "devam", memory="Oyun: uzay")
    first = client.calls[0][1][0]
    assert first["role"] == "system"
    assert first["content"].startswith("HAFIZA (bunu unutma):\nOyun: uzay")
    assert advisor.system_prompt() in first["content"]


def test_with_memory_only_the_last_six_messages_of_a_long_history_are_sent():
    client = FakeClient("Tamam.")
    history = [{"role": "user", "content": f"m{i}"} for i in range(12)]
    Advisor(client, "m").ask(history, "yeni", memory="Oyun: uzay")
    messages = client.calls[0][1]
    assert [m["content"] for m in messages[1:-1]] == [f"m{i}" for i in range(6, 12)]


def test_without_memory_the_whole_history_is_sent_and_no_memory_block_appears():
    client = FakeClient("Tamam.")
    history = [{"role": "user", "content": f"m{i}"} for i in range(12)]
    Advisor(client, "m").ask(history, "yeni")
    messages = client.calls[0][1]
    assert messages[0]["content"] == advisor.system_prompt()
    assert len(messages) == 14


def test_memory_block_is_empty_for_no_memory_and_titled_otherwise():
    assert memory.block("") == "" and memory.block("   ") == ""
    assert memory.block("x") == "HAFIZA (bunu unutma):\nx"


class SchemaClient(FakeClient):
    def chat(self, model, messages, on_token=None, cancel=None, **kwargs):
        self.calls.append((model, messages, kwargs))
        return self.answer


def test_choose_modules_asks_with_a_schema_and_cleans_the_answer():
    client = SchemaClient('{"modules": ["SPORTS", "yok", "ai"]}')
    modules = Advisor(client, "m").choose_modules([{"role": "user", "content": "voleybol"}])
    assert modules == ["core", "ai", "sports"]
    assert client.calls[0][2]["schema"]["properties"]["modules"]["type"] == "array"


def test_choose_modules_falls_back_to_core_on_garbage_or_errors():
    assert Advisor(SchemaClient("saçma"), "m").choose_modules([]) == ["core"]
    assert Advisor(SchemaClient('{"modules": "sports"}'), "m").choose_modules([]) == ["core"]

    class Broken:
        def chat(self, *a, **k):
            from k_minigames.ollama_client import OllamaError
            raise OllamaError("kapalı")

    assert Advisor(Broken(), "m").choose_modules([]) == ["core"]


def test_a_short_wish_gets_questions_instead_of_a_rushed_proposal():
    client = FakeClient('Harika! Küçük model yeter.\n{"model": "qwen2.5-coder:3b"}')
    reply = Advisor(client, "m").ask([], "minecraft tarzı bi oyun")
    assert reply.proposal is None and "?" in reply.text and "bölge" in reply.text
    assert reply.text.count("?") <= 2


def test_the_question_follows_the_kind_of_game_and_the_language():
    client = FakeClient('{"model": "qwen2.5-coder:3b"}')
    assert "düşman" in Advisor(client, "m").ask([], "uzay oyunu yap").text
    assert "kaç canla" in Advisor(client, "m").ask([], "mario tarzı bi oyun").text.lower() or "Karakter" in Advisor(client, "m").ask([], "mario tarzı bi oyun").text
    assert "Which" in Advisor(client, "m").ask([], "I want a space shooter").text
    assert "platform" in Advisor(client, "m").ask([], "bi oyun yapalım").text


def test_a_proposal_after_an_answer_a_decision_or_a_detailed_wish_goes_through():
    client = FakeClient('Tamam.\n{"model": "qwen2.5-coder:7b"}')
    history = [{"role": "user", "content": "minecraft tarzı bi oyun"}, {"role": "assistant", "content": "Hangi bölge?"}]
    assert Advisor(client, "m").ask(history, "orman olsun, büyük").proposal == "qwen2.5-coder:7b"
    assert Advisor(client, "m").ask([], "sen karar ver").proposal == "qwen2.5-coder:7b"
    assert Advisor(client, "m").ask([], "ormanlı büyük bir küp dünya yap, mağaralı, göllü, geceleri zombi çıksın").proposal == "qwen2.5-coder:7b"


def test_an_answer_without_a_proposal_is_left_alone():
    client = FakeClient("Hangi türde bir oyun istersin?")
    assert Advisor(client, "m").ask([], "bi oyun").text == "Hangi türde bir oyun istersin?"
