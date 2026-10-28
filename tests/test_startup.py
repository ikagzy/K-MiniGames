import pytest

from k_minigames.ollama_client import OllamaError
from k_minigames.startup import SetupButtons, setup_buttons, startup_state

ADVISOR = "qwen2.5:3b"
CODER = "qwen2.5-coder:7b"


class FakeClient:
    def __init__(self, running=True, models=(), error=False):
        self.running, self._models, self.error = running, list(models), error

    def is_running(self):
        return self.running

    def models(self):
        if self.error:
            raise OllamaError("kapalı")
        return self._models


@pytest.mark.parametrize("client, game_model, expected", [
    (FakeClient(running=False), CODER, "setup"),
    (FakeClient(models=[], error=True), CODER, "setup"),
    (FakeClient(models=[CODER]), CODER, "setup"),                    # no advisor installed
    (FakeClient(models=[ADVISOR]), None, "advisor"),                 # nothing chosen yet
    (FakeClient(models=[ADVISOR]), "", "advisor"),
    (FakeClient(models=[ADVISOR]), CODER, "advisor"),                # chosen but not installed (any more)
    (FakeClient(models=[ADVISOR, CODER]), CODER, "library"),
])
def test_startup_state(client, game_model, expected):
    assert startup_state(client, ADVISOR, game_model) == expected


@pytest.mark.parametrize("installed, running, advisor, expected", [
    (False, False, False, SetupButtons("download", "disabled")),
    (False, False, True, SetupButtons("download", "disabled")),
    (True, False, False, SetupButtons("start", "disabled")),
    (True, True, False, SetupButtons("done", "download")),
    (True, True, True, SetupButtons("done", "done")),
    (False, True, False, SetupButtons("done", "download")),    # running from somewhere we did not look
])
def test_setup_buttons(installed, running, advisor, expected):
    assert setup_buttons(installed, running, advisor) == expected


# --- asking before using or installing a model ----------------------------------------------------

from k_minigames import catalog  # noqa: E402
from k_minigames.ollama_client import InstalledModel  # noqa: E402
from k_minigames.startup import CANCEL_MESSAGE, Offer, build_offers, first_accepted  # noqa: E402

NEED = catalog.advisor()
HAVE = InstalledModel("llama3.1:8b", 4.58, "llama")


def test_offers_are_use_the_installed_model_then_install_the_recommended_one():
    offers = build_offers(HAVE, NEED)
    assert offers == [Offer("use_installed", "llama3.1:8b", 4.58), Offer("install_new", NEED.id, NEED.size_gb)]


def test_without_a_usable_installed_model_there_is_only_the_install_offer():
    assert build_offers(None, NEED) == [Offer("install_new", NEED.id, NEED.size_gb)]


def test_a_recommended_model_that_is_already_installed_needs_no_question():
    same = InstalledModel(NEED.id, NEED.size_gb, "qwen")
    assert build_offers(same, NEED) == [Offer("already_installed", NEED.id, NEED.size_gb)]


def test_the_first_yes_wins_and_later_questions_are_not_asked():
    asked = []
    chosen = first_accepted(build_offers(HAVE, NEED), lambda offer: asked.append(offer.kind) or True)
    assert chosen.kind == "use_installed" and asked == ["use_installed"]


def test_a_no_to_the_installed_model_leads_to_the_install_question():
    asked = []
    chosen = first_accepted(build_offers(HAVE, NEED), lambda offer: asked.append(offer.kind) or offer.kind == "install_new")
    assert chosen.kind == "install_new" and asked == ["use_installed", "install_new"]


def test_two_noes_mean_cancel():
    assert first_accepted(build_offers(HAVE, NEED), lambda offer: False) is None
    assert "Model kurulmadığı için devam edemiyorum" in CANCEL_MESSAGE


def test_an_already_installed_model_is_used_without_asking():
    same = InstalledModel(NEED.id, NEED.size_gb, "qwen")
    chosen = first_accepted(build_offers(same, NEED), lambda offer: (_ for _ in ()).throw(AssertionError("asked")))
    assert chosen.kind == "already_installed"
