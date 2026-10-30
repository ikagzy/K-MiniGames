import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def test_the_js_tests_pass():
    node = shutil.which("node")
    if node is None:
        pytest.skip("node is not installed")
    done = subprocess.run([node, "--test", "tests/js/*.test.js"], cwd=ROOT, capture_output=True, text=True, timeout=300,
                          encoding="utf-8", errors="replace")
    assert done.returncode == 0, done.stdout[-3000:] + done.stderr[-1000:]
