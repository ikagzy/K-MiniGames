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
var LISTENERS = {};
var rawAdd = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function (type) {
  LISTENERS[type] = (LISTENERS[type] || 0) + 1;
  return rawAdd.apply(this, arguments);
};
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
// --- probes: checks that need no test written by the model (is the screen blank, do the keys and the mouse do anything) ---
function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
function flatten(value, out, path, depth) {
  if (out.count > 3000 || depth > 5) return;
  var type = typeof value;
  if (type === 'number' || type === 'boolean' || type === 'string') { out.map[path] = value; out.count++; return; }
  if (value && type === 'object') {
    if (Array.isArray(value)) out.lengths[path] = value.length;
    var names = Object.keys(value).slice(0, 60);
    for (var i = 0; i < names.length; i++) {
      var inner;
      try { inner = value[names[i]]; } catch (e) { continue; }
      flatten(inner, out, path + '.' + names[i], depth + 1);
    }
  }
}
function state() {
  var out = {map: {}, lengths: {}, count: 0};
  try { flatten(window.__game, out, 'game', 0); } catch (e) {}
  return out;
}
function canvasInfo(c) {
  try {
    var ctx = c.getContext('2d');
    if (!ctx || !c.width || !c.height) return null;
    var d = ctx.getImageData(0, 0, c.width, c.height).data, sum = 0, seen = {}, colors = 0;
    for (var i = 0; i < d.length; i += 148) {
      var key = d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ',' + d[i + 3];
      sum = (sum * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3]) % 1000000007;
      if (!seen[key]) { seen[key] = 1; colors++; }
    }
    return {sum: sum, colors: colors};
  } catch (e) { return null; }
}
function canvases() { return Array.prototype.slice.call(document.getElementsByTagName('canvas')); }
function picture() { return canvases().map(function (c) { var i = canvasInfo(c); return i ? i.sum : -1; }).join(','); }
function delta(before, after) {
  var d = {};
  for (var k in after.map) {
    var x = before.map[k], y = after.map[k];
    d[k] = (typeof x === 'number' && typeof y === 'number') ? Math.abs(y - x) : (x !== y ? 1 : 0);
  }
  return d;
}
function moved(idle, active) {
  for (var k in active) { if (active[k] > (idle[k] || 0) * 1.5 + 0.001) return true; }
  return false;
}
async function observe(ms, act) {
  var s0 = state(), p0 = picture();
  if (act) act(true);
  await sleep(ms);
  if (act) { act(false); await sleep(40); }   // a click happens when the button goes up: look after that
  var s1 = state(), p1 = picture();
  return {delta: delta(s0, s1), changed: p0 !== p1};
}
function keyEvent(type, key, code, kc) {
  var e = new KeyboardEvent(type, {key: key, code: code, bubbles: true, cancelable: true});
  try {
    Object.defineProperty(e, 'keyCode', {get: function () { return kc; }});
    Object.defineProperty(e, 'which', {get: function () { return kc; }});
  } catch (x) {}
  return e;
}
var KEYS = [['w', 'KeyW', 87], ['a', 'KeyA', 65], ['s', 'KeyS', 83], ['d', 'KeyD', 68], ['ArrowLeft', 'ArrowLeft', 37],
            ['ArrowRight', 'ArrowRight', 39], ['ArrowUp', 'ArrowUp', 38], ['ArrowDown', 'ArrowDown', 40], [' ', 'Space', 32]];
function heard(types) { return types.some(function (t) { return LISTENERS[t] > 0; }); }
async function probeKeys() {
  if (!heard(['keydown', 'keyup', 'keypress'])) return;
  var idle = await observe(300, null), good = 0;
  for (var i = 0; i < KEYS.length; i++) {
    var k = KEYS[i];
    var act = function (on) { document.body.dispatchEvent(keyEvent(on ? 'keydown' : 'keyup', k[0], k[1], k[2])); };
    var active = await observe(300, act);
    if (moved(idle.delta, active.delta) || (active.changed && !idle.changed)) good++;
    await sleep(50);
  }
  if (!good) await send({type: 'probe', name: 'keys'});
}
async function probeMouse() {
  if (!heard(['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'mousemove', 'pointermove'])) return;
  var target = canvases()[0] || document.body, box = target.getBoundingClientRect();
  var spots = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.75]], idle = await observe(300, null), good = false;
  for (var i = 0; i < spots.length && !good; i++) {
    var x = box.left + box.width * spots[i][0], y = box.top + box.height * spots[i][1];
    var act = function (on) {
      var init = {clientX: x, clientY: y, bubbles: true, cancelable: true, view: window};
      if (on) { ['mousemove', 'pointermove', 'mousedown', 'pointerdown'].forEach(function (t) { target.dispatchEvent(new MouseEvent(t, init)); }); }
      else { ['mouseup', 'pointerup', 'click'].forEach(function (t) { target.dispatchEvent(new MouseEvent(t, init)); }); }
    };
    var active = await observe(300, act);
    good = moved(idle.delta, active.delta) || (active.changed && !idle.changed);
  }
  if (!good) await send({type: 'probe', name: 'mouse'});
}
async function runProbes() {
  try {
    if (document.visibilityState !== 'visible') return;
    var first = state(), bad = [];
    for (var k in first.map) { if (typeof first.map[k] === 'number' && !isFinite(first.map[k])) bad.push(k); }
    if (bad.length) await send({type: 'probe', name: 'state', paths: bad.slice(0, 3)});
    var cs = canvases(), blank;
    if (cs.length) { var info = canvasInfo(cs[0]); blank = !!info && info.colors <= 1; }
    else { blank = !document.body || ((document.body.innerText || '').trim() === '' && document.body.getElementsByTagName('*').length < 3); }
    if (blank) await send({type: 'probe', name: 'blank'});
    await probeKeys();
    await probeMouse();
    var last = state(), grown = [];
    for (var p in last.lengths) { if (last.lengths[p] > 300 && last.lengths[p] > (first.lengths[p] || 1) * 5) grown.push(p); }
    if (grown.length) await send({type: 'probe', name: 'growth', paths: grown.slice(0, 3)});
  } catch (e) {}
}
async function runAll() {
  for (var i = 0; i < TESTS.length; i++) {
    var t = TESTS[i], vacuous = false, passed = false, error = '';
    try { vacuous = !!(await withTimeout(run(t.code, {}), 3000)); } catch (e) { vacuous = false; }
    try { passed = !!(await withTimeout(run(t.code, window.__game), 5000)); } catch (e) { error = String(e); }
    await send({type: 'test', id: t.id, passed: passed, vacuous: vacuous, error: error});
  }
  await runProbes();
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
