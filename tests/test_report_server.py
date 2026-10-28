import http.client
import json
import threading

import pytest

from k_minigames.report_server import MAX_BODY, ReportServer


@pytest.fixture
def game_dir(tmp_path):
    folder = tmp_path / "Uzay"
    (folder / "assets").mkdir(parents=True)
    (folder / "assets" / "zemin.png").write_bytes(b"\x89PNGresim")
    (tmp_path / "secret.txt").write_text("GIZLI", encoding="utf-8")
    (folder / "gizli-oyun.txt").write_text("GIZLI-OYUN", encoding="utf-8")
    return folder


@pytest.fixture
def server(game_dir):
    srv = ReportServer(game_dir)
    srv.start()
    yield srv
    srv.stop()


def request(server, method, path, body: bytes | None = None, headers=None):
    conn = http.client.HTTPConnection("127.0.0.1", server.port, timeout=5)
    conn.request(method, path, body=body, headers=headers or {})
    response = conn.getresponse()
    data = response.read()
    conn.close()
    return response.status, response.getheader("Content-Type"), data


def test_the_server_listens_only_on_localhost_on_a_random_port(game_dir):
    a, b = ReportServer(game_dir), ReportServer(game_dir)
    a.start()
    b.start()
    try:
        assert a.host == b.host == "127.0.0.1"
        assert a.port != b.port and a.token != b.token
    finally:
        a.stop()
        b.stop()


def test_the_page_is_served_from_memory_with_the_right_token(server):
    server.set_page("<html>merhaba çöl</html>")
    status, ctype, data = request(server, "GET", f"/play/{server.token}/oyun.html")
    assert status == 200 and ctype.startswith("text/html")
    assert data.decode("utf-8") == "<html>merhaba çöl</html>"
    assert server.page_url() == f"http://127.0.0.1:{server.port}/play/{server.token}/oyun.html"


def test_a_texture_is_served_from_the_games_assets_folder(server):
    status, ctype, data = request(server, "GET", f"/play/{server.token}/assets/zemin.png")
    assert status == 200 and ctype == "image/png" and data == b"\x89PNGresim"


def test_a_wrong_token_is_forbidden_for_pages_and_reports(server):
    server.set_page("<html></html>")
    assert request(server, "GET", "/play/yanlis/oyun.html")[0] == 403
    assert request(server, "POST", "/report/yanlis", b'{"type": "done"}')[0] == 403
    assert server.events() == []


@pytest.mark.parametrize("path", [
    "assets/..%2f..%2fsecret.txt",
    "assets/%2e%2e/%2e%2e/secret.txt",
    "assets/../../secret.txt",
    "assets/..%5c..%5csecret.txt",
    "assets/..%2fgizli-oyun.txt",
    "assets/C:%2fWindows%2fwin.ini",
])
def test_a_path_that_leaves_the_assets_folder_is_not_found(server, path):
    status, _, data = request(server, "GET", f"/play/{server.token}/{path}")
    assert status == 404 and b"GIZLI" not in data


def test_a_missing_texture_and_an_unknown_path_are_404(server):
    assert request(server, "GET", f"/play/{server.token}/assets/yok.png")[0] == 404
    assert request(server, "GET", "/baska")[0] == 404


def test_without_a_game_folder_no_texture_is_served(tmp_path):
    srv = ReportServer()
    srv.start()
    try:
        assert request(srv, "GET", f"/play/{srv.token}/assets/zemin.png")[0] == 404
    finally:
        srv.stop()


def test_a_posted_event_is_recorded_and_can_be_waited_for(server):
    body = json.dumps({"type": "error", "message": "x is not defined"}).encode()
    assert request(server, "POST", f"/report/{server.token}", body)[0] == 204
    assert server.events() == [{"type": "error", "message": "x is not defined"}]
    assert server.wait_for("error", 1)["message"] == "x is not defined"
    assert server.wait_for("done", 0.1) is None


def test_wait_for_returns_an_event_that_arrives_later(server):
    threading.Timer(0.2, lambda: request(
        server, "POST", f"/report/{server.token}", b'{"type": "done"}')).start()
    assert server.wait_for("done", 3) == {"type": "done"}


def test_a_body_over_the_limit_is_refused(server):
    big = b"x" * (MAX_BODY + 1000)
    assert request(server, "POST", f"/report/{server.token}", big)[0] == 413
    assert server.events() == []


@pytest.mark.parametrize("body", [b"{bozuk", b"[1, 2]", b'"metin"', b""])
def test_a_body_that_is_not_a_json_object_is_a_bad_request(server, body):
    assert request(server, "POST", f"/report/{server.token}", body)[0] == 400
    assert server.events() == []


def test_report_url_points_at_the_report_route_and_events_can_be_cleared(server):
    assert server.report_url() == f"http://127.0.0.1:{server.port}/report/{server.token}"
    request(server, "POST", f"/report/{server.token}", b'{"type": "done"}')
    assert server.events() != []
    server.clear_events()
    assert server.events() == [] and server.wait_for("done", 0.05) is None
