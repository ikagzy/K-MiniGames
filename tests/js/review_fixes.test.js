const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const fresh = () => load('kgame.js', 'kgame.ai.js', 'kgame.sports.js');
function run(g, seconds) { for (let i = 0; i < Math.round(seconds * 60); i++) g.step(1 / 60); }

test('a collision rule does not fire again when an earlier entity dies during the contact', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const coin = g.add({ shape: 'rect', x: 500, y: 500, w: 5, h: 5, tag: 'coin' });
  const a = g.add({ shape: 'rect', x: 0, y: 0, w: 10, h: 10, tag: 'a' });
  g.add({ shape: 'rect', x: 5, y: 5, w: 10, h: 10, tag: 'b' });
  let count = 0;
  g.onCollide('a', 'b', () => { count++; });
  g.step(1 / 60);
  assert.strictEqual(count, 1);
  g.remove(coin);
  run(g, 0.2);
  assert.strictEqual(count, 1, 'still the same contact');
});

test('timers stop in a scene other than play, and a new game starts with no old timers', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  let spawned = 0;
  K.timer.every(100, () => { spawned++; });
  run(g, 0.5);
  const before = spawned;
  assert.ok(before >= 4);
  g.go('over');
  run(g, 1);
  assert.strictEqual(spawned, before, 'no spawning on the game over screen');
  const g2 = K.game({ headless: true });
  run(g2, 1);
  assert.strictEqual(spawned, before, 'the old game\'s timers are gone');
});

test('a scene can ask for timers to keep running', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  let n = 0;
  g.scene('menu', { timers: true });
  g.go('menu');
  K.timer.every(100, () => { n++; });
  run(g, 0.5);
  assert.ok(n >= 4);
});

test('a timer that clears itself runs once, and a zero interval cannot freeze the page', () => {
  const K = fresh();
  let n = 0;
  const id = K.timer.every(10, () => { n++; K.timer.clear(id); });
  K.timer.tick(0.1);
  assert.strictEqual(n, 1);
  let m = 0;
  K.timer.every(-5, () => { m++; });
  K.timer.tick(0.05);
  assert.ok(m > 0 && m < 100);
});

test('a click that goes down and up inside one frame still counts as a hit', () => {
  const K = fresh();
  const g = K.game({ headless: true, gravity: 700 });
  const court = K.sports.court(g, { type: 'volleyball' });
  const ball = K.sports.ball(g, court, {});
  const me = g.add({ shape: 'rect', x: 280, y: 340, w: 30, h: 50 });
  K.sports.hitOnClick(g, ball, me, { power: 600 });
  ball.x = 300; ball.y = 330; ball.vx = 0; ball.vy = 0; ball.gravity = false;
  K.setMouse(600, 100, true);
  K.setMouse(600, 100, false);   // down and up before the step ran
  g.step(1 / 60);
  assert.ok(ball.vx > 0, 'the hit happened');
  ball.vx = 0; ball.vy = 0; ball.x = 300; ball.y = 330;
  g.step(1 / 60);
  assert.strictEqual(ball.vx, 0, 'one click, one hit');
});

test('hit does not lift the ball in a top-down game, and lifts it in a side view', () => {
  const K = fresh();
  const g = K.game({ headless: true, width: 800, height: 450 });
  const court = K.sports.court(g, { type: 'football' });
  const ball = K.sports.ball(g, court, {});
  const me = g.add({ shape: 'rect', x: 380, y: 200, w: 30, h: 30 });
  ball.x = 400; ball.y = 220;
  K.sports.hit(g, ball, me, { x: 400, y: 440 }, { power: 500 });
  assert.ok(ball.vy > 100, 'goes down toward the target');
  const g2 = K.game({ headless: true, width: 800, height: 450, gravity: 700 });
  const court2 = K.sports.court(g2, { type: 'volleyball' });
  const ball2 = K.sports.ball(g2, court2, {});
  const me2 = g2.add({ shape: 'rect', x: 280, y: 340, w: 30, h: 50 });
  ball2.x = 300; ball2.y = 330;
  K.sports.hit(g2, ball2, me2, { x: 600, y: 440 }, { power: 500 });
  assert.ok(ball2.vy < 0, 'a volleyball is always lifted');
});
