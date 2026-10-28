import subprocess

from k_minigames import hardware


def test_ram_is_a_positive_number_of_gigabytes():
    assert hardware.ram_gb() > 0


def test_vram_is_none_when_nvidia_smi_is_missing(monkeypatch):
    def missing(*args, **kwargs):
        raise FileNotFoundError("nvidia-smi")

    monkeypatch.setattr(subprocess, "run", missing)
    assert hardware.vram_gb() is None


def test_vram_takes_the_biggest_card_in_gigabytes(monkeypatch):
    done = subprocess.CompletedProcess([], 0, stdout="4096\n12288\n", stderr="")
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: done)
    assert hardware.vram_gb() == 12.0


def test_vram_is_none_when_nvidia_smi_fails(monkeypatch):
    failed = subprocess.CompletedProcess([], 9, stdout="", stderr="no driver")
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: failed)
    assert hardware.vram_gb() is None
