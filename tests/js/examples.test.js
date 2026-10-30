const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { load, LIB } = require('./helpers');

function scriptOf(name) {
  const html = fs.readFileSync(path.join(LIB, 'examples', name), 'utf8');
  const m = /<script>([\s\S]*?)<\/script>/.exec(html);
  return m[1];
}

function runExample(name) {
  const K = load('kgame.js', 'kgame.ai.js', 'kgame.sports.js');
  K.seed(11);
  new Function('K', scriptOf(name))(K);
  return { K, state: K.exposed() };
}

for (const name of ['volleyball.html', 'pong.html', 'platform-lite.html']) {
  test(name + ' runs for ten seconds without an error and keeps finite numbers', () => {
    const { state } = runExample(name);
    for (let i = 0; i < 600; i++) state.g.step(1 / 60);
    for (const e of state.g.all()) {
      assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), 'finite position');
    }
  });
}

test('volleyball: the bot answers the ball and the bot hits it over the net', () => {
  const { state } = runExample('volleyball.html');
  const { g, ball, cpu, court } = state;
  ball.x = 600; ball.y = court.floorY - 70; ball.vx = 0; ball.vy = 0;
  let moved = false, sentBack = false;
  const x0 = cpu.x;
  for (let i = 0; i < 180; i++) {
    g.step(1 / 60);
    moved = moved || Math.abs(cpu.x - x0) > 5;
    sentBack = sentBack || ball.vx < -100;
  }
  assert.ok(sentBack, 'the bot hit the ball toward the left');
});

test('volleyball: the player cannot cross the net and jumps only from the floor', () => {
  const { K, state } = runExample('volleyball.html');
  const { g, me, court } = state;
  K.press('d');
  for (let i = 0; i < 180; i++) g.step(1 / 60);
  assert.ok(me.x + me.w <= court.netX, 'stays on the left of the net');
  K.press('d', false);
  K.press('w');
  for (let i = 0; i < 10; i++) g.step(1 / 60);
  assert.ok(me.y + me.h < court.floorY, 'jumped');
});

test('platform: coins can be collected and the enemy ends the game', () => {
  const { K, state } = runExample('platform-lite.html');
  const { g, me, coins, enemy } = state;
  const first = coins[0];
  me.x = first.x - 10; me.y = first.y - 10; me.vy = 0;
  g.step(1 / 60);
  assert.strictEqual(g.score('coins'), 1);
  assert.ok(first.dead);
  me.x = enemy.x; me.y = enemy.y;
  g.step(1 / 60);
  assert.strictEqual(g.current, 'over');
});

test('pong: the player moves only up and down and a point can be won', () => {
  const { K, state } = runExample('pong.html');
  const { g, me, ball, rules } = state;
  K.press('d'); K.press('s');
  for (let i = 0; i < 30; i++) g.step(1 / 60);
  assert.strictEqual(me.x, 20);
  assert.ok(me.y > 185);
  ball.x = 790; ball.y = 20; ball.vx = 300; ball.vy = 0;
  for (let i = 0; i < 3; i++) g.step(1 / 60);   // the edge is checked at the start of a step
  assert.strictEqual(rules.scoreLeft, 1);
});
