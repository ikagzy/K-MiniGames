const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const K = load('kgame.js');
const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, a + ' is not within ' + eps + ' of ' + b);
function run(g, seconds) { for (let i = 0; i < Math.round(seconds * 60); i++) g.step(1 / 60); }

test('gravity speeds an entity up and moves it down', () => {
  const g = K.game({ headless: true, gravity: 900, width: 400, height: 1000 });
  const e = g.add({ shape: 'rect', x: 10, y: 0, w: 10, h: 10, gravity: true });
  run(g, 1);
  near(e.vy, 900, 1);
  assert.ok(e.y > 400);
});

test('an entity without gravity does not fall, and gravity:false opts out of the game gravity', () => {
  const g = K.game({ headless: true, gravity: 900 });
  const e = g.add({ shape: 'rect', x: 10, y: 10, w: 10, h: 10 });
  const f = g.add({ shape: 'rect', x: 10, y: 10, w: 10, h: 10, gravity: false });
  run(g, 0.5);
  assert.strictEqual(e.y, 10);
  assert.strictEqual(f.y, 10);
});

test('a bouncing circle turns round at the floor and loses speed', () => {
  const g = K.game({ headless: true, gravity: 900, width: 400, height: 300 });
  const ball = g.add({ shape: 'circle', x: 200, y: 200, r: 10, gravity: true, bounce: 0.5, bounds: true });
  let before = 0, after = 0;
  for (let i = 0; i < 240 && !after; i++) {
    before = ball.vy;
    g.step(1 / 60);
    if (before > 0 && ball.vy < 0) after = ball.vy;
  }
  assert.ok(before > 0 && after < 0, 'it bounced');
  near(Math.abs(after), (before + 900 / 60) * 0.5, 1);   // it hits the floor after the speed-up of this step
});

test('bounds keep an entity inside the world', () => {
  const g = K.game({ headless: true, width: 200, height: 100 });
  const e = g.add({ shape: 'rect', x: 150, y: 50, w: 20, h: 20, vx: 500, vy: -500, bounds: true });
  run(g, 1);
  assert.ok(e.x >= 0 && e.x + e.w <= 200 && e.y >= 0 && e.y + e.h <= 100);
});

test('friction slows an entity down', () => {
  const g = K.game({ headless: true });
  const e = g.add({ shape: 'rect', x: 0, y: 0, w: 5, h: 5, vx: 100, friction: 4 });
  run(g, 1);
  assert.ok(e.vx > 0 && e.vx < 10);
});

test('remove takes an entity out; all() filters by tag', () => {
  const g = K.game({ headless: true });
  const a = g.add({ shape: 'rect', x: 0, y: 0, tag: 'enemy' });
  const b = g.add({ shape: 'rect', x: 0, y: 0, tag: 'coin' });
  assert.deepStrictEqual(g.all('enemy'), [a]);
  g.remove(a);
  g.step(1 / 60);
  assert.deepStrictEqual(g.all(), [b]);
});

test('onUpdate runs every step with the step length', () => {
  const g = K.game({ headless: true });
  let total = 0;
  g.add({ shape: 'rect', x: 0, y: 0, onUpdate: (e, dt) => { total += dt; } });
  run(g, 1);
  near(total, 1, 0.001);
});

test('an entity with life disappears when it has run out', () => {
  const g = K.game({ headless: true });
  g.add({ shape: 'rect', x: 0, y: 0, life: 100 });
  run(g, 0.05);
  assert.strictEqual(g.all().length, 1);
  run(g, 0.2);
  assert.strictEqual(g.all().length, 0);
});

test('an entity with a floor line stands on it, and jump only works from the floor', () => {
  const K2 = load('kgame.js');
  const g = K2.game({ headless: true, gravity: 900, height: 450 });
  const e = g.add({ shape: 'rect', x: 10, y: 0, w: 20, h: 40, gravity: true, floor: 400, controls: 'wasd', jump: 420 });
  run(g, 1);
  assert.strictEqual(e.y + e.h, 400);
  assert.ok(e.onFloor);
  K2.press('w');
  run(g, 0.1);
  assert.ok(e.y + e.h < 400 && e.vy < 0, 'jumped');
  const high = e.y;
  run(g, 0.05);
  assert.ok(e.y <= high + 0.001 || e.vy > -420, 'no second jump in the air');
  K2.press('w', false);
  run(g, 2);
  assert.strictEqual(e.y + e.h, 400);
});

test('xmin and xmax keep an entity in its half of the court', () => {
  const K2 = load('kgame.js');
  const g = K2.game({ headless: true });
  const e = g.add({ shape: 'rect', x: 100, y: 10, w: 20, h: 20, vx: 500, xmin: 50, xmax: 200 });
  run(g, 1);
  assert.strictEqual(e.x, 200);
  e.vx = -500;
  run(g, 1);
  assert.strictEqual(e.x, 50);
});

test('controls with axis y move only up and down', () => {
  const K2 = load('kgame.js');
  const g = K2.game({ headless: true });
  const e = g.add({ shape: 'rect', x: 100, y: 100, w: 10, h: 40, controls: 'wasd', axis: 'y', speed: 100 });
  K2.press('d'); K2.press('s');
  run(g, 0.5);
  assert.strictEqual(e.x, 100);
  assert.ok(e.y > 130);
});
