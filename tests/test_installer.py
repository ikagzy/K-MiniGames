import io
import shutil
import subprocess
from urllib.error import URLError

from k_minigames import installer
from k_minigames.installer import CHUNK


class Resp(io.BytesIO):
    def __init__(self, data: bytes, length=None):
        super().__init__(data)
        self.headers = {"Content-Length": str(len(data) if length is None else length)}


class DiskFull(Resp):
    """Delivers one chunk, then fails the way a full disk or a dropped line would."""
    def read(self, n=-1):
        if self.tell() >= CHUNK:
            raise OSError("disk dolu")
        return super().read(n)


def opener_for(resp):
    return lambda request, timeout=None: resp


def leftovers(folder):
    return sorted(p.name for p in folder.iterdir())


def test_download_writes_the_file_and_reports_progress(tmp_path):
    data = b"x" * (CHUNK * 2 + 10)
    dest = tmp_path / "OllamaSetup.exe"
    seen = []
    assert installer.download("http://x/setup.exe", dest, lambda d, t: seen.append((d, t)),
                              opener=opener_for(Resp(data))) is True
    assert dest.read_bytes() == data
    assert len(seen) == 3 and seen[-1] == (len(data), len(data))
    assert leftovers(tmp_path) == ["OllamaSetup.exe"]


def test_a_cancelled_download_leaves_no_file_behind(tmp_path):
    dest = tmp_path / "OllamaSetup.exe"
    seen = []
    ok = installer.download("http://x/setup.exe", dest, lambda d, t: seen.append(d),
                            cancel=lambda: len(seen) >= 1,
                            opener=opener_for(Resp(b"x" * (CHUNK * 3))))
    assert ok is False and leftovers(tmp_path) == []


def test_a_write_error_half_way_leaves_no_file_behind(tmp_path):
    dest = tmp_path / "OllamaSetup.exe"
    ok = installer.download("http://x/setup.exe", dest, lambda d, t: None,
                            opener=opener_for(DiskFull(b"x" * (CHUNK * 3))))
    assert ok is False and leftovers(tmp_path) == []


def test_an_unwritable_destination_is_false_not_a_crash(tmp_path):
    blocker = tmp_path / "dosya"
    blocker.write_bytes(b"")
    ok = installer.download("http://x/setup.exe", blocker / "setup.exe", lambda d, t: None,
                            opener=opener_for(Resp(b"abc")))
    assert ok is False


def test_a_download_that_ends_before_the_announced_size_is_incomplete(tmp_path):
    dest = tmp_path / "OllamaSetup.exe"
    ok = installer.download("http://x/setup.exe", dest, lambda d, t: None,
                            opener=opener_for(Resp(b"x" * 100, length=5000)))
    assert ok is False and leftovers(tmp_path) == []


def test_a_network_error_is_false(tmp_path):
    def broken(request, timeout=None):
        raise URLError("kapalı")

    assert installer.download("http://x/setup.exe", tmp_path / "s.exe", lambda d, t: None, opener=broken) is False
    assert leftovers(tmp_path) == []


def test_download_size_reads_content_length_and_is_none_on_errors():
    assert installer.download_size("http://x", opener=opener_for(Resp(b"", length=1234))) == 1234

    def broken(request, timeout=None):
        raise URLError("kapalı")

    assert installer.download_size("http://x", opener=broken) is None


def test_ollama_exe_is_found_in_the_programs_folder(tmp_path, monkeypatch):
    monkeypatch.setattr(shutil, "which", lambda name: None)
    assert installer.ollama_exe() is None
    exe = tmp_path / "_local" / "Programs" / "Ollama" / "ollama.exe"
    exe.parent.mkdir(parents=True)
    exe.write_bytes(b"MZ")
    assert installer.ollama_exe() == exe


def test_start_server_runs_ollama_serve_without_a_window(tmp_path):
    calls = []
    exe = tmp_path / "ollama.exe"
    exe.write_bytes(b"MZ")
    assert installer.start_server(exe, popen=lambda *a, **k: calls.append((a, k))) is True
    args, kwargs = calls[0]
    assert args[0] == [str(exe), "serve"]
    assert kwargs["creationflags"] & subprocess.CREATE_NO_WINDOW


def test_start_server_and_run_setup_are_false_on_os_errors(tmp_path):
    exe = tmp_path / "ollama.exe"
    exe.write_bytes(b"MZ")

    def boom(*a, **k):
        raise OSError("açılamadı")

    assert installer.start_server(exe, popen=boom) is False
    assert installer.run_setup(exe, popen=boom) is False
    assert installer.run_setup(tmp_path / "yok.exe", popen=lambda *a, **k: None) is False


def test_run_setup_starts_the_setup_file(tmp_path):
    calls = []
    setup = tmp_path / "OllamaSetup.exe"
    setup.write_bytes(b"MZ")
    assert installer.run_setup(setup, popen=lambda *a, **k: calls.append(a)) is True
    assert calls[0][0] == [str(setup)]


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


class Client:
    def __init__(self, answers):
        self.answers = list(answers)

    def is_running(self):
        return self.answers.pop(0) if self.answers else False


def test_wait_until_running_returns_true_as_soon_as_ollama_answers():
    clock = Clock()
    assert installer.wait_until_running(Client([False, False, True]), timeout_s=60,
                                        sleep=clock.sleep, clock=clock) is True
    assert clock.now == 2.0


def test_wait_until_running_gives_up_after_the_timeout():
    clock = Clock()
    assert installer.wait_until_running(Client([]), timeout_s=5, sleep=clock.sleep, clock=clock) is False
    assert clock.now >= 5
