const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const fresh = () => load('kgame.js');
function run(g, seconds) { for (let i = 0; i < Math.round(seconds * 60); i++) g.step(1 / 60); }

test('seed makes the random numbers repeatable', () => {
  const K = fresh();
  K.seed(7);
  const a = [K.rand(0, 100), K.rand(0, 100), K.rand(5)];
  K.seed(7);
  const b = [K.rand(0, 100), K.rand(0, 100), K.rand(5)];
  assert.deepStrictEqual(a, b);
  assert.ok(a.every((v) => v >= 0 && v < 100));
  assert.ok(['x', 'y'].includes(K.pick(['x', 'y'])));
});

test('timers fire after their time, repeat, and can be cleared', () => {
  const K = fresh();
  let once = 0, many = 0, cleared = 0;
  K.timer.after(100, () => { once++; });
  K.timer.every(50, () => { many++; });
  const id = K.timer.after(100, () => { cleared++; });
  K.timer.clear(id);
  K.timer.tick(0.099);
  assert.strictEqual(once, 0);
  K.timer.tick(0.011);
  assert.strictEqual(once, 1);
  assert.ok(many >= 2);
  K.timer.tick(1);
  assert.strictEqual(once, 1);
  assert.strictEqual(cleared, 0);
});

test('a tween ends exactly on the target', () => {
  const K = fresh();
  const o = { x: 0, y: 10 };
  K.tween(o, { x: 100, y: 0 }, 200);
  K.timer.tick(0.1);
  assert.ok(o.x > 0 && o.x < 100);
  K.timer.tick(0.2);
  assert.strictEqual(o.x, 100);
  assert.strictEqual(o.y, 0);
});

test('scenes: go() runs enter, the world only runs in the play scene', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  let entered = 0, updates = 0;
  g.scene('over', { enter: () => { entered++; }, update: () => { updates++; } });
  const e = g.add({ shape: 'rect', x: 0, y: 0, vx: 60 });
  run(g, 0.5);
  const x = e.x;
  assert.ok(x > 0);
  g.go('over');
  assert.strictEqual(entered, 1);
  run(g, 0.5);
  assert.strictEqual(e.x, x, 'the world is paused in another scene');
  assert.ok(updates > 20);
  g.go('play');
  run(g, 0.1);
  assert.ok(e.x > x);
});

test('scores, ui texts and bars', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  assert.strictEqual(g.score('p'), 0);
  g.addScore('p', 2);
  g.addScore('p');
  assert.strictEqual(g.score('p'), 3);
  g.ui.text('s', 'Skor: 3', 10, 10);
  g.ui.bar('hp', 5, 10, 10, 30, 100);
  assert.strictEqual(g.ui.items.s.text, 'Skor: 3');
  assert.strictEqual(g.ui.items.hp.value, 5);
});

test('the camera follows an entity and can shake', () => {
  const K = fresh();
  const g = K.game({ headless: true, width: 200, height: 100 });
  const e = g.add({ shape: 'rect', x: 1000, y: 0, w: 10, h: 10 });
  g.follow(e, 0.5);
  run(g, 0.5);
  assert.ok(g.camera.x > 500);
  g.shake(8, 100);
  g.step(1 / 60);
  assert.ok(g.shakeOffset().x !== 0 || g.shakeOffset().y !== 0);
  run(g, 0.3);
  assert.deepStrictEqual(g.shakeOffset(), { x: 0, y: 0 });
});

test('expose puts the state where tests and the checker look for it', () => {
  const K = load('kgame.js');
  const state = K.expose({ a: 1 });
  assert.strictEqual(state.a, 1);
  assert.ok(K.exposed() === state);
});

test('save falls back to memory without localStorage', () => {
  const K = fresh();
  K.save.set('best', 12);
  assert.strictEqual(K.save.get('best', 0), 12);
  assert.strictEqual(K.save.get('nothing', 'x'), 'x');
});

test('sfx, textures and particles work (or stay silent) without a browser', () => {
  const K = fresh();
  assert.doesNotThrow(() => K.sfx('hit'));
  assert.strictEqual(K.texture.make('brick', 16).size, 16);
  assert.ok(['brick', 'grass', 'stone', 'wood', 'water', 'sky'].every((n) => K.texture.make(n).name === n));
  const g = K.game({ headless: true });
  K.particles.burst(g, 50, 50, { count: 7, life: 100 });
  assert.strictEqual(g.all('particle').length, 7);
  run(g, 0.3);
  assert.strictEqual(g.all('particle').length, 0);
});
