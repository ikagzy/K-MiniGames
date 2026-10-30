const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const fresh = () => load('kgame.js', 'kgame.sprites.js', 'kgame.animation.js', 'kgame.themes.js', 'kgame.levels.js',
  'kgame.hud.js', 'kgame.audio2.js', 'kgame.items.js', 'kgame.enemies.js');
function run(g, seconds) { for (let i = 0; i < Math.round(seconds * 60); i++) g.step(1 / 60); }

// ---- hud ----
test('the hud keeps score, coins, lives and time, and shows them as texts', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const hud = K.hud.stats(g, { lives: 3, time: 100, world: '1-1' });
  hud.addScore(250);
  hud.addCoin();
  run(g, 1);
  assert.strictEqual(hud.score, 350, 'a coin is worth 100');
  assert.strictEqual(hud.coins, 1);
  assert.ok(hud.time <= 99.1 && hud.time >= 98.9);
  assert.ok(g.ui.items['hud.score'].text.includes('350'));
  assert.ok(g.ui.items['hud.world'].text.includes('1-1'));
  assert.ok(g.ui.items['hud.lives'].text.includes('3'));
});

test('a hundred coins give an extra life; losing the last life says game over once', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  let over = 0;
  const hud = K.hud.stats(g, { lives: 1, onGameOver: () => { over++; } });
  for (let i = 0; i < 100; i++) hud.addCoin();
  assert.strictEqual(hud.lives, 2);
  assert.strictEqual(hud.coins, 0);
  assert.strictEqual(hud.loseLife(), 1);
  assert.strictEqual(over, 0);
  assert.strictEqual(hud.loseLife(), 0);
  assert.strictEqual(over, 1);
});

test('running out of time calls onTimeUp once; toasts disappear by themselves', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  let up = 0;
  const hud = K.hud.stats(g, { time: 2, onTimeUp: () => { up++; } });
  hud.toast('Hazır!', 300);
  assert.ok(g.ui.items['hud.toast']);
  run(g, 0.5);
  assert.ok(!g.ui.items['hud.toast'], 'the toast went away');
  run(g, 2);
  assert.strictEqual(up, 1);
});

test('a screen waits for a key and then calls back once', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  let started = 0;
  K.hud.screen(g, 'title', { lines: ['KAGZY', 'Enter ile başla'], keys: { Enter: () => { started++; g.go('play'); } } });
  g.go('title');
  run(g, 0.2);
  assert.strictEqual(started, 0);
  K.press('Enter');
  run(g, 0.2);
  assert.strictEqual(started, 1);
  assert.strictEqual(g.current, 'play');
});

// ---- audio2 ----
test('music notes are parsed into frequencies and beats', () => {
  const K = fresh();
  const notes = K.music.parse('A4:1 R:0.5 C5:2');
  assert.strictEqual(notes.length, 3);
  assert.ok(Math.abs(notes[0].freq - 440) < 0.01 && notes[0].beats === 1);
  assert.strictEqual(notes[1].freq, 0);
  assert.ok(Math.abs(notes[2].freq - 523.25) < 0.1);
});

test('tracks can be defined, played and stopped, and the built-in ones exist', () => {
  const K = fresh();
  for (const n of ['overworld', 'underground', 'castle', 'boss', 'victory', 'gameover']) assert.ok(K.music.tracks[n], n);
  assert.strictEqual(K.music.play('yok'), false);
  K.music.define('mine', { bpm: 120, wave: 'square', notes: 'C4:1 E4:1 G4:2' });
  assert.strictEqual(K.music.play('mine'), true);
  assert.strictEqual(K.music.current, 'mine');
  K.music.stop();
  assert.strictEqual(K.music.current, null);
});

test('the sound pack adds the game sounds', () => {
  const K = fresh();
  for (const n of ['stomp', 'powerup', 'death', 'oneup', 'kick', 'break', 'fire', 'flag', 'bump']) assert.ok(K.sfxTable[n], n);
  assert.doesNotThrow(() => K.sfx('stomp'));
});

// ---- items ----
test('a coin is an animated pickup with the coin tag', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const c = K.items.coin(g, 100, 50);
  assert.strictEqual(c.tag, 'coin');
  run(g, 0.3);
  assert.ok(c.texture.name.startsWith('coin.'));
});

test('a question block gives its content once and then turns used', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const b = K.items.qblock(g, 64, 64, { contains: 'mushroom' });
  assert.strictEqual(b.tag, 'qblock');
  assert.strictEqual(K.items.bump(g, b), 'mushroom');
  assert.strictEqual(b.used, true);
  assert.strictEqual(b.texture.name, 'qblock.used');
  assert.strictEqual(K.items.bump(g, b), null, 'nothing the second time');
  assert.strictEqual(g.all('powerup').length, 1);
  const coinBlock = K.items.qblock(g, 96, 64, {});
  const hits = [];
  assert.strictEqual(K.items.bump(g, coinBlock, { onCoin: () => hits.push('coin') }), 'coin');
  assert.deepStrictEqual(hits, ['coin']);
});

test('a brick bounces when a small hero hits it and breaks into pieces when a big one does', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const a = K.items.brick(g, 0, 0), b = K.items.brick(g, 32, 0);
  assert.strictEqual(K.items.bump(g, a, { big: false }), 'bounce');
  assert.ok(!a.dead);
  assert.strictEqual(K.items.bump(g, b, { big: true }), 'break');
  assert.ok(b.dead);
  assert.ok(g.all('particle').length > 0);
});

test('a power-up mushroom walks and falls; a star bounces', () => {
  const K = fresh();
  const g = K.game({ headless: true, gravity: 900 });
  const m = K.items.powerup(g, 'mushroom', 10, 10);
  const s = K.items.powerup(g, 'star', 10, 10);
  run(g, 0.5);
  assert.ok(m.vy > 0 && m.vx !== 0);
  assert.strictEqual(m.tag, 'powerup');
  assert.strictEqual(m.kind, 'mushroom');
  assert.strictEqual(s.kind, 'star');
});

// ---- enemies ----
test('a walker turns round when it meets a wall and stops being a threat when stomped', () => {
  const K = fresh();
  const g = K.game({ headless: true, gravity: 900 });
  const map = K.tilemap(['......', '......', '######'], { '#': 'wall' }, 32);
  const e = K.enemies.walker(g, 64, 20, { speed: 60, map });
  const dirs = new Set();
  for (let i = 0; i < 400; i++) { g.step(1 / 60); g.collideTiles(e, map); dirs.add(Math.sign(e.vx)); }
  assert.ok(dirs.has(1) && dirs.has(-1), 'it walked both ways');
  assert.ok(e.x >= -1 && e.x <= 192, 'it stayed on its platform');
  K.enemies.stomp(g, e);
  assert.strictEqual(e.tag, 'squashed');
  assert.strictEqual(e.texture.name, 'walker.flat');
  run(g, 1);
  assert.ok(e.dead, 'removed after a moment');
});

test('a walker turns at the end of a platform instead of falling off', () => {
  const K = fresh();
  const g = K.game({ headless: true, gravity: 900 });
  const map = K.tilemap(['..........', '..........', '..####....', '..........'], { '#': 'wall' }, 32);
  const e = K.enemies.walker(g, 80, 20, { speed: 60, map });
  for (let i = 0; i < 600; i++) { g.step(1 / 60); g.collideTiles(e, map); }
  assert.ok(e.y < 60, 'still on the platform (y = ' + e.y + ')');
});

test('a flyer sways up and down and a piranha rises and sinks', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const f = K.enemies.flyer(g, 100, 100, { amp: 40, speed: 1 });
  const p = K.enemies.piranha(g, 200, 100, { rise: 32, period: 2 });
  let fmin = 1e9, fmax = -1e9, pmin = 1e9, pmax = -1e9;
  for (let i = 0; i < 300; i++) { g.step(1 / 60); fmin = Math.min(fmin, f.y); fmax = Math.max(fmax, f.y); pmin = Math.min(pmin, p.y); pmax = Math.max(pmax, p.y); }
  assert.ok(fmax - fmin > 30);
  assert.ok(pmax - pmin > 20);
  assert.strictEqual(p.stompable, false);
  assert.strictEqual(f.tag, 'enemy');
});
