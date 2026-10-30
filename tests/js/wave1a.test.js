const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const fresh = () => load('kgame.js', 'kgame.sprites.js', 'kgame.animation.js', 'kgame.themes.js', 'kgame.levels.js');
function run(g, seconds) { for (let i = 0; i < Math.round(seconds * 60); i++) g.step(1 / 60); }

// ---- sprites ----
test('the built-in sprites exist and every one has equal rows', () => {
  const K = fresh();
  const names = K.sprites.names();
  for (const n of ['hero.idle', 'hero.run1', 'hero.run2', 'hero.jump', 'hero.die', 'walker.1', 'walker.2', 'walker.flat', 'coin.1',
    'coin.2', 'coin.3', 'coin.4', 'mushroom', 'brick', 'qblock', 'qblock.used', 'ground', 'grass', 'pipe.top', 'pipe.body', 'cloud',
    'flag', 'pole', 'star', 'heart', 'spike']) assert.ok(names.includes(n), n);
  for (const n of names) {
    const s = K.sprites.get(n);
    assert.ok(s.w > 0 && s.h > 0, n + ' has a size');
    assert.strictEqual(s.rows.every((r) => r.length === s.w), true, n + ' rows are equal');
  }
});

test('a sprite can be defined by the user with its own palette, and drawing it without a canvas is harmless', () => {
  const K = fresh();
  K.sprites.define('dot', ['xx', 'xx'], { x: '#ff0' });
  const s = K.sprites.get('dot');
  assert.deepStrictEqual([s.w, s.h], [2, 2]);
  assert.doesNotThrow(() => s.draw({ drawImage() {}, save() {}, restore() {}, translate() {}, scale() {} }, 0, 0, 10, 10, true));
  assert.throws(() => K.sprites.get('yok-yok'), /yok-yok/);
  assert.strictEqual(K.sprites.has('dot'), true);
});

test('sprite frames are shared: the same name gives the same object', () => {
  const K = fresh();
  assert.strictEqual(K.sprites.get('coin.1'), K.sprites.get('coin.1'));
});

// ---- animation ----
test('an animated hero picks idle, run, jump from its movement and faces where it goes', () => {
  const K = fresh();
  const g = K.game({ headless: true, gravity: 900, height: 300 });
  const e = g.add({ shape: 'rect', x: 10, y: 0, w: 20, h: 30, gravity: true, floor: 200 });
  const a = K.anim.attach(e, { sprites: { idle: ['hero.idle'], run: ['hero.run1', 'hero.run2'], jump: ['hero.jump'], die: ['hero.die'] }, fps: { run: 10 } });
  run(g, 0.2);
  assert.strictEqual(a.state, 'jump', 'in the air');
  run(g, 1);
  assert.strictEqual(a.state, 'idle');
  e.vx = 100;
  g.step(1 / 60);
  assert.strictEqual(a.state, 'run');
  assert.strictEqual(e.flip, false);
  const seen = new Set();
  for (let i = 0; i < 30; i++) { g.step(1 / 60); seen.add(e.texture.name); }
  assert.ok(seen.has('hero.run1') && seen.has('hero.run2'), 'the run frames alternate');
  e.vx = -100;
  g.step(1 / 60);
  assert.strictEqual(e.flip, true);
  e.dead = false; a.play('die');
  g.step(1 / 60);
  assert.strictEqual(a.state, 'die');
});

test('squash and stretch makes the entity bigger one way for a moment and then restores it', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const e = g.add({ shape: 'rect', x: 0, y: 0, w: 20, h: 20 });
  K.anim.attach(e, { sprites: { idle: ['hero.idle'] } });
  K.anim.squash(e, 0.4, 100);
  g.step(1 / 60);
  assert.ok(e.h < 20 && e.w > 20, 'squashed');
  run(g, 0.3);
  assert.strictEqual(e.w, 20);
  assert.strictEqual(e.h, 20);
});

// ---- themes ----
test('a theme sets the colours and puts parallax layers behind the world', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const t = K.themes.apply(g, 'sky');
  assert.ok(g.layers.length >= 2);
  assert.notStrictEqual(g.background, '#111');
  assert.ok(t.tiles.ground);
  for (const name of ['sky', 'cave', 'castle', 'night', 'underwater', 'space', 'forest']) assert.ok(K.themes.names().includes(name), name);
  const g2 = K.game({ headless: true });
  K.themes.apply(g2, 'bilinmeyen');
  assert.ok(g2.layers.length >= 1, 'an unknown theme falls back to the first one');
});

test('theme layers draw something without throwing on a recording canvas', () => {
  const K = fresh();
  const calls = [];
  const ctx = new Proxy({}, { get: (t, n) => (n in t ? t[n] : (...a) => calls.push(String(n))), set: (t, n, v) => { t[n] = v; return true; } });
  const g = K.game({ headless: true, width: 400, height: 200 });
  for (const name of K.themes.names()) {
    g.layers.length = 0;
    K.themes.apply(g, name);
    g.layers.forEach((l) => l.draw(ctx, g, 40, 0));
  }
  assert.ok(calls.length > 20);
});

// ---- levels ----
const LEVEL = [
  '..........',
  '......o...',
  '....BB?...',
  'P.........',
  '###..###.F',
  '###..#####',
];

test('a level is parsed into cells, a start, a goal and a solid map', () => {
  const K = fresh();
  const lv = K.levels.parse(LEVEL);
  assert.deepStrictEqual([lv.cols, lv.rowsCount, lv.tile], [10, 6, 32]);
  assert.deepStrictEqual(lv.start, { x: 0, y: 96 });
  assert.deepStrictEqual(lv.goal, { x: 288, y: 128 });
  assert.strictEqual(lv.count('coin'), 1);
  assert.strictEqual(lv.count('brick'), 2);
  assert.ok(lv.map.solidAt(5, 130));
  assert.ok(!lv.map.solidAt(100, 130), 'the gap is empty');
  assert.strictEqual(lv.width, 320);
});

test('rows of different lengths are padded, and unknown characters are empty with a warning', () => {
  const K = fresh();
  const lv = K.levels.parse(['P..', '....', '#####', 'a'], undefined);
  assert.strictEqual(lv.cols, 5);
  assert.ok(lv.warnings.some((w) => w.includes('a')));
});

test('validate: a level whose gap is too wide to jump cannot be finished, a small gap can', () => {
  const K = fresh();
  const ok = K.levels.validate(K.levels.parse(LEVEL), { jump: 4, gap: 3 });
  assert.strictEqual(ok.ok, true, ok.reason);
  const wide = K.levels.parse(['P.........F', '###......###', '###......###']);
  const bad = K.levels.validate(wide, { jump: 4, gap: 3 });
  assert.strictEqual(bad.ok, false);
  assert.ok(/boşluk|gap|ulaş/i.test(bad.reason));
  const none = K.levels.validate(K.levels.parse(['....', '####']), {});
  assert.strictEqual(none.ok, false);   // no start, no flag
});

test('levels can be listed, and the next one is built when the current one ends', () => {
  const K = fresh();
  const set = K.levels.set([LEVEL, LEVEL.map((r) => r)]);
  assert.strictEqual(set.count, 2);
  assert.strictEqual(set.current().index, 0);
  assert.strictEqual(set.next().index, 1);
  assert.strictEqual(set.next(), null);
});
