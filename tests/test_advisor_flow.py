import pytest

from k_minigames import model_check, settings
from k_minigames.advisor import AdvisorReply
from k_minigames.ollama_client import InstalledModel
from k_minigames.startup import CANCEL_MESSAGE
from k_minigames.ui.advisor_flow import AdvisorFlow

LLAMA8 = InstalledModel("llama3.1:8b", 4.58, "llama")
CODER7 = InstalledModel("qwen2.5-coder:7b", 4.7, "qwen2")


class FakeAdvisor:
    def __init__(self, *replies):
        self.replies, self.calls = list(replies), []

    def ask(self, history, user_text, memory="", on_token=None, cancel=None):
        self.calls.append({"history": list(history), "text": user_text, "memory": memory})
        return self.replies.pop(0)


class FakeClient:
    def __init__(self, pull_ok=True):
        self.pull_ok, self.pulled = pull_ok, []

    def pull(self, model, on_progress, cancel=None):
        self.pulled.append(model)
        on_progress("downloading", 5, 10)
        return self.pull_ok


def make_flow(*replies, installed=(), pull_ok=True, ram=32, vram=None):
    client = FakeClient(pull_ok)
    advisor = FakeAdvisor(*replies)
    return AdvisorFlow(advisor, client, ram_gb=ram, vram_gb=vram, installed=lambda: list(installed)), advisor, client


def proposal(model="qwen2.5-coder:7b", text="Şunu öneririm."):
    return AdvisorReply(text, model)


def test_chatting_without_a_proposal_keeps_the_conversation_going():
    flow, advisor, _ = make_flow(AdvisorReply("Hangi türde?", None), AdvisorReply("Tamam.", None))
    flow.user_says("uzay oyunu")
    flow.user_says("zıplasın")
    assert flow.state == "chatting" and flow.recommendation is None
    assert [m["role"] for m in flow.history] == ["user", "assistant", "user", "assistant"]
    assert advisor.calls[1]["history"][0] == {"role": "user", "content": "uzay oyunu"}


def test_the_memory_is_passed_on_to_the_advisor():
    flow, advisor, _ = make_flow(AdvisorReply("x", None))
    flow.user_says("merhaba", memory="Oyun: uzay")
    assert advisor.calls[0]["memory"] == "Oyun: uzay"


def test_a_proposal_with_nothing_installed_asks_whether_to_install_and_a_no_cancels():
    flow, _, client = make_flow(proposal())
    flow.user_says("hazırım")
    assert flow.state == "awaiting_install"
    assert flow.recommendation == model_check.recommend("qwen2.5-coder:7b", 32, None)
    assert flow.current_offer.kind == "install_new" and flow.current_offer.model == "qwen2.5-coder:7b"
    flow.answer(False)
    assert flow.state == "cancelled" and flow.cancel_message == CANCEL_MESSAGE
    assert client.pulled == [] and settings.get("game_model") is None


def test_a_yes_to_the_install_downloads_and_remembers_the_model():
    flow, _, client = make_flow(proposal())
    flow.user_says("hazırım")
    flow.answer(True)
    assert flow.state == "installing"
    seen = []
    assert flow.install(lambda status, done, total: seen.append((done, total))) is True
    assert flow.state == "done" and client.pulled == ["qwen2.5-coder:7b"] and seen == [(5, 10)]
    assert settings.get("game_model") == "qwen2.5-coder:7b"


def test_a_failed_download_is_an_error_and_the_model_is_not_remembered():
    flow, _, _ = make_flow(proposal(), pull_ok=False)
    flow.user_says("hazırım")
    flow.answer(True)
    assert flow.install(lambda *a: None) is False
    assert flow.state == "error" and settings.get("game_model") is None


def test_an_installed_model_that_is_enough_is_offered_first_and_a_yes_uses_it_without_downloading():
    flow, _, client = make_flow(proposal(), installed=[LLAMA8])
    flow.user_says("hazırım")
    assert flow.state == "awaiting_use_installed" and flow.current_offer.model == "llama3.1:8b"
    flow.answer(True)
    assert flow.state == "done" and client.pulled == []
    assert settings.get("game_model") == "llama3.1:8b"


def test_a_no_to_the_installed_model_asks_about_the_recommended_one_and_two_noes_cancel():
    flow, _, _ = make_flow(proposal(), installed=[LLAMA8])
    flow.user_says("hazırım")
    flow.answer(False)
    assert flow.state == "awaiting_install" and flow.current_offer.model == "qwen2.5-coder:7b"
    flow.answer(False)
    assert flow.state == "cancelled" and settings.get("game_model") is None


def test_a_recommended_model_that_is_already_installed_is_used_without_any_question():
    flow, _, client = make_flow(proposal(), installed=[CODER7])
    flow.user_says("hazırım")
    assert flow.state == "done" and client.pulled == []
    assert settings.get("game_model") == "qwen2.5-coder:7b"


def test_a_made_up_model_name_is_replaced_and_the_reason_is_kept():
    flow, _, _ = make_flow(proposal("uydurma-model:9b"))
    flow.user_says("hazırım")
    assert flow.recommendation.substituted is True and "katalogda yok" in flow.recommendation.reason
    assert flow.current_offer.model == flow.recommendation.model.id


def test_after_a_cancel_the_user_can_talk_again():
    flow, _, _ = make_flow(proposal(), AdvisorReply("Tabii, devam edelim.", None))
    flow.user_says("hazırım")
    flow.answer(False)
    flow.user_says("fikrimi değiştirdim")
    assert flow.state == "chatting" and flow.recommendation is None and flow.current_offer is None


def test_an_unreachable_ollama_when_listing_models_just_means_nothing_is_installed():
    from k_minigames.ollama_client import OllamaError

    def broken():
        raise OllamaError("kapalı")

    flow = AdvisorFlow(FakeAdvisor(proposal()), FakeClient(), ram_gb=32, vram_gb=None, installed=broken)
    flow.user_says("hazırım")
    assert flow.state == "awaiting_install"


def test_an_unexpected_download_error_puts_the_flow_into_the_error_state():
    flow, _, _ = make_flow(proposal())
    flow.user_says("hazırım")
    flow.answer(True)
    flow.fail()
    assert flow.state == "error" and settings.get("game_model") is None


def test_for_game_writing_the_flow_offers_the_best_installed_model_not_the_smallest():
    llama3 = InstalledModel("llama3:latest", 4.3, "llama")
    flow, _, _ = make_flow(proposal(), installed=[llama3, LLAMA8])
    flow.user_says("hazırım")
    assert flow.state == "awaiting_use_installed" and flow.current_offer.model == "llama3.1:8b"


# --- the advisor's own memory ---------------------------------------------------------------------------

from k_minigames import memory  # noqa: E402


class ChatStub:
    def __init__(self, answer):
        self.answer, self.calls = answer, []

    def chat(self, model, messages, on_token=None, cancel=None, **kwargs):
        self.calls.append(messages)
        return self.answer


def test_remember_writes_the_advisor_memory_and_the_next_message_is_given_it():
    flow, advisor, _ = make_flow(AdvisorReply("Hangi tür?", None), AdvisorReply("Tamam.", None))
    advisor.client, advisor.model = ChatStub("Amaç: uzay oyunu"), "qwen3.5:4b"
    flow.user_says("uzay oyunu istiyorum")
    flow.remember("uzay oyunu istiyorum", "Hangi tür?")
    assert memory.load(memory.advisor_path()) == "Amaç: uzay oyunu"
    flow.user_says("zıplasın")
    assert advisor.calls[1]["memory"] == "Amaç: uzay oyunu"


def test_without_a_working_summariser_the_request_is_kept_as_a_line():
    flow, advisor, _ = make_flow(AdvisorReply("Hangi tür?", None))
    flow.user_says("uzay oyunu istiyorum")
    flow.remember("uzay oyunu istiyorum", "Hangi tür?")
    assert memory.load(memory.advisor_path()) == "- uzay oyunu istiyorum"


def test_an_explicit_memory_still_wins_over_the_file():
    memory.save(memory.advisor_path(), "dosyadaki hafıza")
    flow, advisor, _ = make_flow(AdvisorReply("x", None))
    flow.user_says("merhaba", memory="verilen hafıza")
    assert advisor.calls[0]["memory"] == "verilen hafıza"


def test_a_chosen_model_installed_as_name_latest_is_used_without_asking_again():
    from k_minigames.startup import startup_state
    class Client:
        def is_running(self): return True
        def models(self): return ["qwen3.5:4b", "k-ai-v3:latest"]
    assert startup_state(Client(), "qwen3.5:4b", "k-ai-v3") == "library"
