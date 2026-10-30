import io
import json
from urllib.error import URLError

import pytest

from k_minigames.ollama_client import NUM_CTX, OllamaClient, OllamaError


def ndjson(*objs) -> bytes:
    return b"".join(json.dumps(o).encode("utf-8") + b"\n" for o in objs)


class FakeOpener:
    def __init__(self, body: bytes = b"", error: Exception | None = None):
        self.body, self.error, self.requests = body, error, []

    def __call__(self, request, timeout=None):
        self.requests.append(request)
        if self.error:
            raise self.error
        return io.BytesIO(self.body)


class CutStream(io.BytesIO):
    """A stream that dies half way through, as a closed Ollama would."""
    def __iter__(self):
        yield ndjson({"message": {"content": "Mer"}, "done": False})
        raise ConnectionResetError("kapandı")


def client(body: bytes = b"", error: Exception | None = None):
    opener = FakeOpener(body, error)
    return OllamaClient(opener=opener), opener


def test_is_running_is_false_when_ollama_is_unreachable():
    c, _ = client(error=URLError("kapalı"))
    assert c.is_running() is False


def test_is_running_is_true_when_ollama_answers():
    c, _ = client(body=b"Ollama is running")
    assert c.is_running() is True


def test_models_lists_the_installed_model_names():
    c, _ = client(body=json.dumps({"models": [{"name": "a:1"}, {"name": "b:2"}]}).encode())
    assert c.models() == ["a:1", "b:2"]


def test_models_raises_when_ollama_is_unreachable():
    c, _ = client(error=URLError("kapalı"))
    with pytest.raises(OllamaError):
        c.models()


def test_chat_joins_the_streamed_tokens_and_reports_each_one():
    c, _ = client(ndjson({"message": {"content": "Mer"}, "done": False},
                         {"message": {"content": "haba"}, "done": False},
                         {"message": {"content": ""}, "done": True}))
    tokens = []
    assert c.chat("m", [{"role": "user", "content": "selam"}], on_token=tokens.append) == "Merhaba"
    assert tokens == ["Mer", "haba"]


def test_chat_request_carries_the_model_messages_stream_and_a_larger_context():
    c, opener = client(ndjson({"message": {"content": "x"}, "done": True}))
    msgs = [{"role": "user", "content": "selam"}]
    c.chat("qwen2.5-coder:7b", msgs)
    req = opener.requests[0]
    body = json.loads(req.data)
    assert req.full_url.endswith("/api/chat") and req.get_method() == "POST"
    assert body["model"] == "qwen2.5-coder:7b" and body["messages"] == msgs and body["stream"] is True
    assert body["options"]["num_ctx"] == NUM_CTX == 8192


def test_chat_stream_that_ends_without_done_is_an_error_not_a_partial_answer():
    c, _ = client(ndjson({"message": {"content": "yarım"}, "done": False}))
    with pytest.raises(OllamaError):
        c.chat("m", [])


def test_chat_connection_cut_mid_stream_raises_ollama_error():
    c = OllamaClient(opener=lambda request, timeout=None: CutStream())
    with pytest.raises(OllamaError):
        c.chat("m", [])


def test_chat_with_an_empty_answer_is_an_error():
    c, _ = client(ndjson({"message": {"content": ""}, "done": True}))
    with pytest.raises(OllamaError):
        c.chat("m", [])


def test_chat_reports_the_error_ollama_sends():
    c, _ = client(ndjson({"error": "model not found"}))
    with pytest.raises(OllamaError, match="model not found"):
        c.chat("m", [])


def test_chat_connection_error_raises_ollama_error():
    c, _ = client(error=URLError("kapalı"))
    with pytest.raises(OllamaError):
        c.chat("m", [])


def test_chat_stops_when_cancelled():
    c, _ = client(ndjson({"message": {"content": "a"}, "done": False},
                         {"message": {"content": "b"}, "done": False},
                         {"message": {"content": ""}, "done": True}))
    tokens = []
    with pytest.raises(OllamaError, match="cancelled"):
        c.chat("m", [], on_token=tokens.append, cancel=lambda: len(tokens) >= 1)
    assert tokens == ["a"]


def test_pull_reports_progress_and_succeeds():
    c, opener = client(ndjson({"status": "pulling manifest"},
                              {"status": "downloading", "completed": 50, "total": 100},
                              {"status": "success"}))
    seen = []
    assert c.pull("qwen2.5:3b", lambda s, done, total: seen.append((s, done, total))) is True
    assert seen == [("pulling manifest", 0, 0), ("downloading", 50, 100), ("success", 0, 0)]
    assert json.loads(opener.requests[0].data)["model"] == "qwen2.5:3b"
    assert opener.requests[0].full_url.endswith("/api/pull")


def test_pull_is_false_when_ollama_reports_an_error():
    c, _ = client(ndjson({"error": "pull model manifest: file does not exist"}))
    assert c.pull("uydurma:9b", lambda *a: None) is False


def test_pull_is_false_when_cancelled_or_unreachable():
    c, _ = client(ndjson({"status": "downloading", "completed": 1, "total": 2},
                         {"status": "success"}))
    assert c.pull("m", lambda *a: None, cancel=lambda: True) is False
    c, _ = client(error=URLError("kapalı"))
    assert c.pull("m", lambda *a: None) is False


def test_pull_without_a_success_line_is_false():
    c, _ = client(ndjson({"status": "downloading", "completed": 1, "total": 2}))
    assert c.pull("m", lambda *a: None) is False


def test_installed_lists_names_sizes_in_gigabytes_and_families():
    from k_minigames.ollama_client import InstalledModel

    body = {"models": [
        {"name": "llama3.1:8b", "size": 4920000000, "details": {"family": "llama", "parameter_size": "8.0B"}},
        {"name": "eski:1b", "size": 1073741824},
    ]}
    c, opener = client(body=json.dumps(body).encode())
    models = c.installed()
    assert [m.name for m in models] == ["llama3.1:8b", "eski:1b"]
    assert models[0].size_gb == pytest.approx(4.58, abs=0.01) and models[0].family == "llama"
    assert models[1] == InstalledModel("eski:1b", 1.0, "")
    assert opener.requests[0].full_url.endswith("/api/tags")


def test_installed_raises_when_ollama_is_unreachable():
    c, _ = client(error=URLError("kapalı"))
    with pytest.raises(OllamaError):
        c.installed()


def test_a_server_error_shows_what_ollama_said_and_is_not_called_unreachable():
    import urllib.error

    def failing(request, timeout=None):
        raise urllib.error.HTTPError(request.full_url, 500, "Internal Server Error", {},
                                     io.BytesIO(b'{"error": "model requires more system memory"}'))

    c = OllamaClient(opener=failing)
    with pytest.raises(OllamaError) as caught:
        c.chat("m", [])
    assert "500" in str(caught.value) and "model requires more system memory" in str(caught.value)
    assert "ulaşılamadı" not in str(caught.value)


def test_chat_can_ask_for_a_json_schema_and_a_keep_alive_time():
    body = ndjson({"message": {"content": "{}"}, "done": True})
    c, opener = client(body)
    schema = {"type": "object", "properties": {"modules": {"type": "array"}}}
    c.chat("m", [{"role": "user", "content": "x"}], schema=schema, keep_alive="2m")
    payload = json.loads(opener.requests[0].data)
    assert payload["format"] == schema and payload["keep_alive"] == "2m"


def test_chat_sends_neither_format_nor_keep_alive_by_default():
    c, opener = client(ndjson({"message": {"content": "x"}, "done": True}))
    c.chat("m", [{"role": "user", "content": "x"}])
    payload = json.loads(opener.requests[0].data)
    assert "format" not in payload and "keep_alive" not in payload
