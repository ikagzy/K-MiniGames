import time

from k_minigames.ui.worker import CancelToken, Worker


class FakeRoot:
    """Collects the callbacks a Tk `after` would run, so the test can run them itself."""
    def __init__(self):
        self.pending = []

    def after(self, ms, fn):
        self.pending.append(fn)

    def pump(self, until, seconds=3.0):
        deadline = time.monotonic() + seconds
        while not until() and time.monotonic() < deadline:
            batch, self.pending = self.pending, []
            for fn in batch:
                fn()
            time.sleep(0.005)
        return until()


def test_the_result_is_handed_back_through_the_scheduler_not_the_worker_thread():
    root, got = FakeRoot(), []
    Worker(root.after).run(lambda: 21 * 2, got.append)
    assert got == []                       # nothing is delivered until the scheduler runs
    assert root.pump(lambda: bool(got)) and got == [42]


def test_an_exception_goes_to_on_error_and_not_on_done():
    root, done, errors = FakeRoot(), [], []

    def boom():
        raise ValueError("bozuk")

    Worker(root.after).run(boom, done.append, errors.append)
    assert root.pump(lambda: bool(errors))
    assert done == [] and isinstance(errors[0], ValueError)


def test_an_exception_without_an_on_error_handler_is_not_lost_silently():
    root, done = FakeRoot(), []

    def boom():
        raise ValueError("bozuk")

    Worker(root.after).run(boom, done.append)
    assert root.pump(lambda: False, seconds=0.2) is False
    assert done == []


def test_two_jobs_each_deliver_their_own_result():
    root, got = FakeRoot(), []
    worker = Worker(root.after)
    worker.run(lambda: "a", got.append)
    worker.run(lambda: "b", got.append)
    assert root.pump(lambda: len(got) == 2) and sorted(got) == ["a", "b"]


def test_a_cancel_token_starts_clear_and_stays_cancelled():
    token = CancelToken()
    assert token() is False
    token.cancel()
    assert token() is True and token() is True
