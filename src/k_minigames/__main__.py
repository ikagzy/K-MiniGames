import sys
from pathlib import Path

from k_minigames import settings


def main(argv: list[str]) -> None:
    if getattr(sys, "frozen", False):
        settings.register_exe(Path(sys.executable))  # K-Series finds the app through this path
    screen = argv[argv.index("--screen") + 1] if "--screen" in argv and argv.index("--screen") + 1 < len(argv) else None
    from k_minigames.ui.app import run
    run(screen)


if __name__ == "__main__":
    main(sys.argv[1:])
