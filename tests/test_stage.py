import tkinter as tk

import pytest

from k_minigames import i18n
from k_minigames.ui.stage import Stage


@pytest.fixture
def root():
    try:
        window = tk.Tk()
    except tk.TclError:
        pytest.skip("no display for Tk")
    window.withdraw()
    yield window
    window.destroy()


def texts(stage):
    return [stage.itemcget(i, "text") for i in stage.find_all() if stage.type(i) == "text"]


def test_the_stage_is_1024_by_572(root):
    stage = Stage(root)
    assert (int(stage["width"]), int(stage["height"])) == (1024, 572)


def test_both_scenes_and_all_character_poses_load_as_pictures(root):
    stage = Stage(root)
    for scene in ("danisman", "lobi"):
        stage.set_scene(scene)
        assert len(stage.find_withtag("scene")) == 1
    for character in ("advisor", "bear"):
        for state in ("idle", "talking", "thinking", "success"):
            stage.set_character(character, state, tick=1)
            assert len(stage.find_withtag("character")) == 1


def test_say_shows_the_speaker_label_and_the_message(root):
    stage = Stage(root)
    stage.say("DON", "Merhaba, ne yapalım?")
    assert "DON" in texts(stage) and "Merhaba, ne yapalım?" in texts(stage)


def test_saying_again_replaces_the_previous_text(root):
    stage = Stage(root)
    stage.say("DON", "birinci")
    stage.say("SEN", "ikinci")
    assert "birinci" not in texts(stage) and "ikinci" in texts(stage) and "SEN" in texts(stage)
    assert "DON" not in texts(stage)


def test_the_user_label_follows_the_interface_language_but_the_names_do_not(root):
    stage = Stage(root)
    i18n.set_language("en")
    stage.say("DON", "hello")
    assert "DON" in texts(stage)
    stage.say("SEN", "hi")
    assert "YOU" in texts(stage)


def test_the_text_box_sends_what_was_typed_and_clears_itself(root):
    stage = Stage(root)
    sent = []
    stage.ask(sent.append)
    stage.entry.insert(0, "  uzay oyunu istiyorum  ")
    stage.submit()
    assert sent == ["uzay oyunu istiyorum"] and stage.entry.get() == ""


def test_an_empty_message_is_not_sent(root):
    stage = Stage(root)
    sent = []
    stage.ask(sent.append)
    stage.entry.insert(0, "   ")
    stage.submit()
    assert sent == []


def test_stop_asking_removes_the_text_box(root):
    stage = Stage(root)
    stage.ask(lambda text: None)
    stage.stop_asking()
    assert stage.entry is None and stage.find_withtag("input") == ()


def test_the_window_shows_no_font_attribution_it_lives_in_the_readme(root):
    stage = Stage(root)
    stage.set_scene("danisman")
    stage.say("DON", "merhaba")
    assert not any("Determination" in x or "fontstruct" in x for x in texts(stage))


def test_showing_the_same_picture_again_does_not_redraw_it(root):
    stage = Stage(root)
    stage.set_character("bear", "thinking")
    first = stage.find_withtag("character")
    stage.set_character("bear", "thinking")
    assert stage.find_withtag("character") == first
    stage.set_character("bear", "success")
    assert stage.find_withtag("character") != first


def test_a_long_message_gets_a_smaller_type_and_stays_in_the_box(root):
    from k_minigames.ui.stage import MESSAGE_BOTTOM
    stage = Stage(root)
    stage.say("DON", "kısa")
    short = stage.bbox("message")[3]
    stage.say("DON", "Merhaba! Özel bir oyun yapmak istemene sevindim. Başlamak için hangi türü düşündüğünü söyler misin? "
                     "Ayrıca kontrollerin nasıl çalışmasını hayal ediyorsun? Zorluk ve görsel stil de önemli.")
    assert stage.bbox("message")[3] <= MESSAGE_BOTTOM
    assert len(stage.find_withtag("message")) == 1 and short < MESSAGE_BOTTOM
