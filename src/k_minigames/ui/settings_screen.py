"""Settings: install or start Ollama, install the advisor model, choose the games folder, forget what the advisor
remembers. It is the setup screen with a Back button instead of Continue (the downloads still ask first)."""
from k_minigames import i18n, memory
from k_minigames.ui.setup_screen import STATUS_Y, SetupScreen
from k_minigames.ui.stage import TEXT_X

t = i18n.t

SETTINGS_INTRO = "Ayarlar: Ollama, model ve klasör."


class SettingsScreen(SetupScreen):
    def __init__(self, services):
        super().__init__(services)
        self.intro = SETTINGS_INTRO
        self.reset_button = None

    def _continue_label(self) -> str:
        return "← Geri"

    def _build(self) -> None:
        super()._build()
        self.reset_button = self._button(TEXT_X + 535, STATUS_Y + 6, 140, self._on_reset)
        self.reset_button.configure(text=t("Hafızayı sil"))

    def apply_ready(self, ready: bool) -> None:
        self.continue_button.configure(state="disabled" if self._busy else "normal")

    def _on_continue(self) -> None:
        self.s.navigate("title")

    def _on_reset(self) -> None:
        if self._busy:
            return
        if not self.s.confirm(t("Hafıza silinsin mi?"), t("Don'un senin hakkında hatırladıkları silinecek.")):
            return
        memory.save(memory.advisor_path(), "")
        self.s.info(t("Hafıza silindi"), t("Don artık seni yeniden tanıyacak."))
