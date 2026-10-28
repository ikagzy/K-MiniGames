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


# --- install_ollama / ensure_running --------------------------------------------------------

class Steps:
    """Records what install_ollama did, with scripted answers for each step."""
    def __init__(self, download=True, run=True, waits=(True,), exe=None, start=True):
        self.log, self._download, self._run, self._waits, self._exe, self._start = [], download, run, list(waits), exe, start

    def download(self, url, dest, on_progress, cancel=None):
        self.log.append(("download", url, dest.name))
        return self._download

    def run(self, setup):
        self.log.append(("run", setup.name))
        return self._run

    def wait(self, client, timeout_s=60):
        self.log.append(("wait", timeout_s))
        return self._waits.pop(0) if self._waits else False

    def find_exe(self):
        return self._exe

    def start(self, exe):
        self.log.append(("start", exe.name))
        return self._start


def install(steps, tmp_path):
    return installer.install_ollama(object(), lambda d, t: None, download=steps.download, run=steps.run,
                                    wait=steps.wait, exe=steps.find_exe, start=steps.start, folder=tmp_path)


def test_install_ollama_downloads_runs_the_setup_and_waits_for_the_server(tmp_path):
    steps = Steps()
    assert install(steps, tmp_path) == "ok"
    assert steps.log[0] == ("download", installer.OLLAMA_URL, "OllamaSetup.exe")
    assert [entry[0] for entry in steps.log] == ["download", "run", "wait"]


def test_install_ollama_stops_when_the_download_fails(tmp_path):
    steps = Steps(download=False)
    assert install(steps, tmp_path) == "download_failed"
    assert [entry[0] for entry in steps.log] == ["download"]


def test_install_ollama_reports_a_setup_that_could_not_start(tmp_path):
    assert install(Steps(run=False), tmp_path) == "setup_failed"


def test_install_ollama_starts_the_server_itself_when_the_setup_did_not(tmp_path):
    exe = tmp_path / "ollama.exe"
    steps = Steps(waits=(False, True), exe=exe)
    assert install(steps, tmp_path) == "ok"
    assert ("start", "ollama.exe") in steps.log


def test_install_ollama_says_not_running_when_the_server_never_comes_up(tmp_path):
    assert install(Steps(waits=(False, False), exe=tmp_path / "ollama.exe"), tmp_path) == "not_running"
    assert install(Steps(waits=(False,), exe=None), tmp_path) == "not_running"


def test_ensure_running_does_nothing_when_ollama_already_answers():
    class Up:
        def is_running(self):
            return True

    assert installer.ensure_running(Up(), exe=lambda: (_ for _ in ()).throw(AssertionError("no lookup"))) is True


def test_ensure_running_starts_an_installed_ollama_and_waits(tmp_path):
    class Down:
        def is_running(self):
            return False

    started = []
    exe = tmp_path / "ollama.exe"
    ok = installer.ensure_running(Down(), exe=lambda: exe, start=lambda e: started.append(e) or True,
                                  wait=lambda client, timeout_s=60: True)
    assert ok is True and started == [exe]
    assert installer.ensure_running(Down(), exe=lambda: None) is False
