"""Adds the monitor script to a game page: it reports errors and runs the tests inside the real browser.

Events sent to the report server (see report_server): error, console_error, asset_error, test, done."""
import json
import re
from dataclasses import dataclass

MARK = "<!--kmg-harness-->"


@dataclass(frozen=True)
class TestSpec:
    __test__ = False  # not a pytest test class

    id: str
    code: str  # the body of `async function (game)`; returns true when the checklist item holds


_SCRIPT = """<script>
(function () {
var REPORT = __URL__;
var TESTS = __TESTS__;
function send(o) {
  try { return fetch(REPORT, {method: 'POST', body: JSON.stringify(o), keepalive: true}).catch(function () {}); } catch (e) {}
}
function banner(text) {
  var d = document.getElementById('kmg-banner');
  if (!d) {
    d = document.createElement('div');
    d.id = 'kmg-banner';
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#222;color:#fff;font:14px sans-serif;padding:6px 10px;text-align:center;';
    (document.body || document.documentElement).appendChild(d);
  }
  d.textContent = text;
}
document.addEventListener('DOMContentLoaded', function () { banner('Oyun deneniyor, sekmeyi kapatma'); });
window.addEventListener('error', function (e) {
  var t = e.target;
  if (t && t !== window && (t.src || t.href)) { send({type: 'asset_error', url: String(t.src || t.href)}); return; }
  send({type: 'error', message: String(e.message), source: String(e.filename || ''), line: e.lineno || 0});
}, true);
window.addEventListener('unhandledrejection', function (e) { send({type: 'error', message: 'Promise hatası: ' + String(e.reason)}); });
var originalError = console.error;
console.error = function () {
  send({type: 'console_error', message: Array.prototype.slice.call(arguments).map(String).join(' ')});
  return originalError.apply(console, arguments);
};
var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise(function (_, reject) { setTimeout(function () { reject(new Error('zaman aşımı')); }, ms); })]);
}
function run(code, game) { return Promise.resolve().then(function () { return new AsyncFunction('game', code)(game); }); }
async function runAll() {
  for (var i = 0; i < TESTS.length; i++) {
    var t = TESTS[i], vacuous = false, passed = false, error = '';
    try { vacuous = !!(await withTimeout(run(t.code, {}), 3000)); } catch (e) { vacuous = false; }
    try { passed = !!(await withTimeout(run(t.code, window.__game), 5000)); } catch (e) { error = String(e); }
    await send({type: 'test', id: t.id, passed: passed, vacuous: vacuous, error: error});
  }
  await send({type: 'done'});
  banner('Test bitti, kapatabilirsin');
}
window.addEventListener('load', function () { setTimeout(runAll, 1500); });
})();
</script>
"""


def _as_script_data(value) -> str:
    """JSON that is safe inside a <script> block: a literal `</` could close the block early."""
    return json.dumps(value).replace("</", "<\\/")


def inject(html: str, report_url: str, tests: list[TestSpec]) -> str:
    if MARK in html:
        return html
    script = MARK + _SCRIPT.replace("__URL__", _as_script_data(report_url)).replace(
        "__TESTS__", _as_script_data([{"id": t.id, "code": t.code} for t in tests]))
    for pattern in (r"<head[^>]*>", r"<html[^>]*>"):
        match = re.search(pattern, html, re.I)
        if match:
            return html[:match.end()] + script + html[match.end():]
    return script + html
