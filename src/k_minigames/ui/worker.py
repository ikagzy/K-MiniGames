"""Runs slow work off the interface thread and hands the result back on it.

`schedule` is Tk's `root.after`: the result is delivered by a poll scheduled on the interface thread, so no widget is
ever touched from the worker thread."""
import queue
import sys
import threading
import traceback
from collections.abc import Callable

POLL_MS = 50


class CancelToken:
    def __init__(self):
        self._event = threading.Event()

    def cancel(self) -> None:
        self._event.set()

    def __call__(self) -> bool:
        return self._event.is_set()


class Worker:
    def __init__(self, schedule: Callable[[int, Callable], object]):
        self._schedule = schedule

    def run(self, fn: Callable[[], object], on_done: Callable[[object], None],
            on_error: Callable[[Exception], None] | None = None) -> None:
        box: queue.Queue = queue.Queue(maxsize=1)

        def work():
            try:
                box.put(("ok", fn()))
            except Exception as exc:  # delivered to on_error, never lost in the thread
                box.put(("error", exc))

        def poll():
            try:
                kind, value = box.get_nowait()
            except queue.Empty:
                self._schedule(POLL_MS, poll)
                return
            if kind == "ok":
                on_done(value)
            elif on_error is not None:
                on_error(value)
            else:
                traceback.print_exception(value, file=sys.stderr)

        threading.Thread(target=work, daemon=True).start()
        self._schedule(POLL_MS, poll)
