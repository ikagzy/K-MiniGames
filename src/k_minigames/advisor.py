"""The advisor: talks with the user about the game they want, then proposes a model to write it.

The proposal is a JSON line at the end of its answer; the app never trusts it as it is (see model_check)."""
import json
import re
from collections.abc import Callable
from dataclasses import dataclass

from k_minigames import advisor_rules, catalog, kgamelib
from k_minigames import memory as memory_notes
from k_minigames.ollama_client import OllamaError

HISTORY_WITH_MEMORY = 6   # with a memory summary only the latest messages are sent
CHAT_TOKENS = 400         # the most the advisor may write in one answer
LONG_HISTORY = 10         # a history longer than this is cut when there is a memory

_JSON_OBJECT = re.compile(r"\{[^{}]*\}")
_EMPTY_FENCE = re.compile(r"```[a-zA-Z]*\s*```")


def system_prompt() -> str:
    models = "\n".join(f"- {m.id} (yaklaşık {m.size_gb:g} GB)" for m in catalog.coders())
    return (
        "Sen K-MiniGames'in danışmanısın. Kullanıcıyla kısa ve sıcak konuş; "
        "kullanıcı hangi dilde yazdıysa (Türkçe ya da İngilizce) o dilde cevap ver.\n"
        "Kullanıcı bilgisayarında kendi oyununu yaptırmak istiyor. Önce oyunu anlamak için tek seferde en fazla "
        "iki kısa soru sor (oyunun türü, kontroller, görsel stil, zorluk).\n"
        "Oyunu anlayınca, oyunu yazacak bir model öner. Önerini yalnızca şu listeden seç:\n"
        f"{models}\n"
        "Önerinin nedenini bir iki cümleyle yaz, sonra cevabının SON satırına yalnızca şu JSON'u yaz: "
        '{"model": "<listedeki kimlik>"}\n'
        "Oyunu anlamadan model önerme."
    )


@dataclass(frozen=True)
class AdvisorReply:
    text: str               # what is shown to the user (the JSON line is taken out)
    proposal: str | None    # the proposed model name, as the model wrote it


def _proposals(text: str):
    for match in _JSON_OBJECT.finditer(text or ""):
        try:
            data = json.loads(match.group(0))
        except ValueError:
            continue
        if isinstance(data, dict) and isinstance(data.get("model"), str) and data["model"].strip():
            yield match, data["model"].strip()


def extract_proposal(text: str) -> str | None:
    """The last well-formed {"model": "..."} in the text, or None."""
    found = list(_proposals(text))
    return found[-1][1] if found else None


def _without_proposals(text: str) -> str:
    for match, _ in reversed(list(_proposals(text))):
        text = text[:match.start()] + text[match.end():]
    text = _EMPTY_FENCE.sub("", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


MODULE_SCHEMA = {"type": "object", "required": ["modules"],
                 "properties": {"modules": {"type": "array", "items": {"type": "string", "enum": list(kgamelib.MODULES)}}}}
def module_prompt() -> str:
    """The advisor's instruction for picking modules: one line per module of the library."""
    lines = "\n".join(f"- {m.name}: {m.summary}" for m in kgamelib.MODULES.values())
    return ("Kullanıcının anlattığı oyun için oyun kütüphanesinden hangi modüllerin gerektiğini seç (core her zaman; "
            "yalnızca gerçekten gereken en az modülü seç, bir tür kiti varsa onu seç). Modüller:\n" + lines +
            '\nYalnızca şu biçimde JSON ver: {"modules": ["core", "..."]}')


class Advisor:
    def __init__(self, client, model: str):
        self.client, self.model = client, model

    def choose_modules(self, history: list[dict]) -> list[str]:
        """The library modules the game needs, as the model picks them (a JSON schema keeps the answer in shape);
        anything unusable means just the core."""
        messages = [{"role": "system", "content": module_prompt()}, *history[-HISTORY_WITH_MEMORY:],
                    {"role": "user", "content": "Hangi modüller gerekli?"}]
        try:
            data = json.loads(self.client.chat(self.model, messages, schema=MODULE_SCHEMA))
        except (OllamaError, ValueError, TypeError):
            return ["core"]
        names = data.get("modules") if isinstance(data, dict) else None
        return kgamelib.normalize(advisor_rules.fix_modules(history, names if isinstance(names, list) else []))

    def ask(self, history: list[dict], user_text: str, memory: str = "", on_token: Callable | None = None,
            cancel: Callable[[], bool] | None = None) -> AdvisorReply:
        head = memory_notes.block(memory)
        system = f"{head}\n\n{system_prompt()}" if head else system_prompt()
        if head and len(history) > LONG_HISTORY:
            history = history[-HISTORY_WITH_MEMORY:]
        messages = [{"role": "system", "content": system}, *history, {"role": "user", "content": user_text}]
        answer = self.client.chat(self.model, messages, on_token=on_token, cancel=cancel, max_tokens=CHAT_TOKENS)   # a small model that rambles stops here
        reply = AdvisorReply(_without_proposals(answer), extract_proposal(answer))
        if reply.proposal and not advisor_rules.understood(history, user_text):   # a short wish gets questions first
            return AdvisorReply(advisor_rules.question_for(history, user_text), None)
        return reply
