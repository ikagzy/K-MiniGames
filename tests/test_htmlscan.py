from k_minigames.htmlscan import Problem, scan

OK = "<html><body><script>window.__game = {score: 0};</script></body></html>"


def kinds(problems):
    return [(p.kind, p.detail) for p in problems]


def test_a_clean_game_has_no_problems():
    assert scan(OK, []) == []


def test_a_reference_to_a_missing_texture_is_an_error():
    html = OK + '<img src="assets/zemin.png">'
    problems = scan(html, ["dusman.png"])
    assert kinds(problems) == [("missing_asset", "zemin.png")]
    assert problems[0].severity == "error"
    assert "zemin.png" in problems[0].as_text() and "dusman.png" in problems[0].as_text()


def test_texture_references_are_found_in_every_quoting_style():
    html = OK + """
    <img src='assets/a.png'> <div style="background: url(assets/b.png)"></div>
    <script>const i = new Image(); i.src = "assets/c.png"; fetch(`assets/d.png`);</script>"""
    assert sorted(d for _, d in kinds(scan(html, []))) == ["a.png", "b.png", "c.png", "d.png"]


def test_names_match_ignoring_case_and_percent_encoding():
    html = OK + '<img src="assets/Zemin%20Bir.PNG">'
    assert scan(html, ["zemin bir.png"]) == []


def test_the_same_missing_texture_is_reported_once():
    html = OK + '<img src="assets/x.png"><img src="assets/x.png">'
    assert len(scan(html, [])) == 1


def test_an_external_address_is_a_warning():
    html = OK + '<script src="https://cdn.example.com/lib.js"></script>'
    problems = scan(html, [])
    assert kinds(problems) == [("external_url", "https://cdn.example.com/lib.js")]
    assert problems[0].severity == "warning"
    assert "https://cdn.example.com/lib.js" in problems[0].as_text()


def test_the_w3_namespace_in_svg_is_not_an_external_address():
    html = OK + '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
    assert scan(html, []) == []


def test_a_game_without_the_state_object_is_an_error():
    problems = scan("<html><body></body></html>", [])
    assert kinds(problems) == [("no_game_state", "")]
    assert problems[0].severity == "error" and "window.__game" in problems[0].as_text()


def test_problems_keep_a_stable_order_errors_and_warnings_mixed():
    html = '<html><img src="assets/a.png"><script src="http://x.y/z.js"></script></html>'
    assert [p.kind for p in scan(html, [])] == ["missing_asset", "external_url", "no_game_state"]


def test_problem_is_a_plain_value():
    assert Problem("missing_asset", "a.png", "error") == Problem("missing_asset", "a.png", "error")
