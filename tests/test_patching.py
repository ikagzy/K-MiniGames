from k_minigames.generator import Generator
from k_minigames.patching import Patch, apply_patches, parse_patches

PAGE = ("<!doctype html><html><head></head><body><canvas></canvas><script>\n"
        "const CONFIG = {\"speed\": 200, \"color\": \"#4af\"};\n"
        "const g = K.game({ width: 800 });\n"
        "const me = g.add({ x: 10, y: 10, color: CONFIG.color });\n"
        "g.run();\n" + "// doldurma satırı\n" * 80 + "</script></body></html>")


def block(find, replace):
    return f"<<<<<<< BUL\n{find}\n=======\n{replace}\n>>>>>>> DEĞİŞTİR"


def test_two_blocks_are_read_and_text_around_them_is_ignored():
    text = "İşte değişiklik:\n" + block('"speed": 200', '"speed": 300') + "\nve\n" + block("g.run();", "g.run();\ng.shake(1, 1);")
    assert parse_patches(text) == [Patch('"speed": 200', '"speed": 300'), Patch("g.run();", "g.run();\ng.shake(1, 1);")]


def test_an_empty_replacement_deletes_and_text_without_blocks_has_none():
    assert parse_patches(block("silinecek", "")) == [Patch("silinecek", "")]
    assert parse_patches("hiçbir şey yok") == []


def test_apply_changes_exactly_the_found_text():
    out = apply_patches(PAGE, [Patch('"speed": 200', '"speed": 300')])
    assert '"speed": 300' in out and '"speed": 200' not in out
    assert out.count("// doldurma satırı") == 80   # everything else is untouched


def test_apply_refuses_text_that_is_missing_or_appears_twice():
    assert apply_patches(PAGE, [Patch("hiç yok", "x")]) is None
    assert apply_patches(PAGE, [Patch("// doldurma satırı", "x")]) is None
    assert apply_patches(PAGE, [Patch('"speed": 200', "a"), Patch("hiç yok", "b")]) is None   # all or nothing
    assert apply_patches(PAGE, []) is None


def test_the_second_patch_sees_the_result_of_the_first():
    out = apply_patches(PAGE, [Patch('"speed": 200', '"speed": 300'), Patch('"speed": 300', '"speed": 400')])
    assert '"speed": 400' in out


class ScriptedClient:
    def __init__(self, *answers):
        self.answers, self.messages = list(answers), []

    def chat(self, model, messages, on_token=None, cancel=None, **kwargs):
        self.messages.append(messages)
        return self.answers.pop(0)


FULL = "```html\n<!doctype html><html><body>tam yeni oyun</body></html>\n```"


def test_with_modules_a_long_game_is_edited_by_patches_and_the_rest_is_kept():
    client = ScriptedClient(block('"speed": 200', '"speed": 300') + '\n```json\n{"checklist": ["hızlı"]}\n```')
    out = Generator(client, "m").edit(PAGE, "hızlandır", [], ["eski"], modules=["core"])
    assert '"speed": 300' in out.html and out.html.count("// doldurma satırı") == 80
    assert out.checklist == ["hızlı"]
    assert len(client.messages) == 1 and "<<<<<<< BUL" in client.messages[0][0]["content"]


def test_when_a_patch_does_not_apply_it_falls_back_to_the_whole_file():
    client = ScriptedClient(block("bu satır oyunda yok", "x"), FULL)
    out = Generator(client, "m").edit(PAGE, "hızlandır", [], [], modules=["core"])
    assert "tam yeni oyun" in out.html
    assert len(client.messages) == 2 and "<<<<<<< BUL" not in client.messages[1][0]["content"]


def test_an_answer_without_blocks_also_falls_back_and_a_short_or_old_game_skips_patches():
    client = ScriptedClient("Tamam, hızlandırdım.", FULL)
    assert "tam yeni oyun" in Generator(client, "m").edit(PAGE, "x", [], [], modules=["core"]).html
    short = ScriptedClient(FULL)
    Generator(short, "m").edit("<html><body>kısa</body></html>", "x", [], [], modules=["core"])
    assert len(short.messages) == 1 and "<<<<<<< BUL" not in short.messages[0][0]["content"]
    old = ScriptedClient(FULL)
    Generator(old, "m").edit(PAGE, "x", [], [])   # no modules: the old way
    assert len(old.messages) == 1 and "<<<<<<< BUL" not in old.messages[0][0]["content"]


def test_a_cut_off_block_means_no_patches_at_all_so_the_edit_is_not_half_applied():
    two_and_a_half = block('"speed": 200', '"speed": 300') + "\n" + block("g.run();", "g.run();\ng.shake(1, 1);") + \
        "\n<<<<<<< BUL\nconst me\n=======\nconst me2"
    assert parse_patches(two_and_a_half) == []
    restarted = "<<<<<<< BUL\nabc\n=======\nxyz\n" + block("silinecek", "")
    assert parse_patches(restarted) == []
