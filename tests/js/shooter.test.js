const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const FILES = ['kgame.js', 'kgame.sprites.js', 'kgame.animation.js', 'kgame.hud.js', 'kgame.audio2.js', 'kgame.kits.js', 'kgame.shooter.js'];
const fresh = () => load(...FILES);
function run(state, seconds, each) { for (let i = 0; i < Math.round(seconds * 60); i++) { if (each) each(i); state.g.step(1 / 60); } }

// A bot that plays like a careful person: it moves under the nearest enemy, fires all the time and steps out of the way of bullets and diving enemies.
function bot(K, s) {
  return () => {
    const me = s.me;
    if (!me || s.g.current !== 'play') return;
    const x = me.cx, y = me.cy;
    let danger = 0;
    for (const b of s.g.all('ebullet')) {
      if (b.dead || b.y > y + 12 || b.y < y - 190) continue;
      const dx = b.x - x, ahead = (y - b.y) / Math.max(1, b.vy);
      if (Math.abs(dx + b.vx * ahead) < 34) danger += dx + b.vx * ahead >= 0 ? -1 : 1;
    }
    for (const e of s.g.all('enemy')) {
      if (e.dead || e.cy > y + 10 || e.cy < y - 150) continue;
      if (e.kind === 'kamikaze' || e.kind === 'drifter' || e.kind === 'zigzag') { const dx = e.cx - x; if (Math.abs(dx) < 46) danger += dx >= 0 ? -1.5 : 1.5; }
    }
    let move = 0;
    if (danger !== 0) move = danger > 0 ? 1 : -1;
    else {
      const targets = s.g.all('enemy').filter((e) => !e.dead && e.cy < y - 20).sort((a, b) => b.cy - a.cy);
      if (targets.length) { const dx = targets[0].cx - x; move = Math.abs(dx) < 8 ? 0 : dx > 0 ? 1 : -1; }
    }
    if (x < 40 && move < 0) move = 1;
    if (x > 440 && move > 0) move = -1;
    K.press('ArrowLeft', move < 0); K.press('ArrowRight', move > 0); K.press(' ', true);
  };
}
const play = (K, spec, seconds) => { const s = K.kit.run(spec); run(s, seconds, bot(K, s)); return s; };

test('the registry has the shooter kit and its features, and checks a spec', () => {
  const K = fresh();
  assert.ok(K.kit.list().includes('shooter'));
  for (const f of ['shield', 'bomb', 'spread', 'rapid']) assert.ok(K.feature.list('shooter').includes(f), f);
  assert.deepStrictEqual(K.kit.check({ kit: 'shooter' }), []);
  assert.ok(K.kit.check({ kit: 'shooter', theme: 'lava' })[0].includes('bilinmeyen tema'));
  assert.ok(K.kit.check({ kit: 'shooter', enemies: ['ejderha'] })[0].includes('bilinmeyen düşman'));
  assert.ok(K.kit.check({ kit: 'shooter', enemies: [] }).length > 0);
  assert.ok(K.kit.check({ kit: 'shooter', waves: { count: 99 } })[0].includes('waves.count'));
  assert.ok(K.kit.check({ kit: 'shooter', ship: { fire: 'laser' } })[0].includes('ateş türü'));
  assert.ok(K.kit.check({ kit: 'shooter', features: ['uçmak'] })[0].includes('bilinmeyen özellik'));
  assert.throws(() => K.kit.run({ kit: 'shooter', difficulty: 9 }), /geçersiz/);
});

test('the waves are the same for the same spec, grow with the game and the difficulty, and unlock the enemy kinds slowly', () => {
  const K = fresh();
  const spec = { difficulty: 3, waves: { count: 10, seed: 4 }, enemies: ['drifter', 'zigzag', 'shooter', 'kamikaze', 'tank'] };
  const a = K.shooter.waves(spec), b = K.shooter.waves(spec), c = K.shooter.waves({ ...spec, waves: { count: 10, seed: 5 } });
  assert.strictEqual(a.length, 10);
  assert.deepStrictEqual(a, b);
  assert.notDeepStrictEqual(a, c);
  assert.ok(a[9].spawns.length > a[0].spawns.length, 'later waves have more enemies');
  assert.ok(a[9].speed > a[0].speed && a[9].interval < a[0].interval);
  assert.deepStrictEqual([...new Set(a[0].spawns.map((s) => s.kind))], ['drifter'], 'the first wave only has the first kind');
  assert.ok(new Set(a.flatMap((w) => w.spawns.map((s) => s.kind))).size >= 4, 'the later waves use the other kinds');
  const hard = K.shooter.waves({ ...spec, difficulty: 5 }), easy = K.shooter.waves({ ...spec, difficulty: 1 });
  assert.ok(hard[5].spawns.length > easy[5].spawns.length);
  assert.ok(a.every((w) => w.spawns.every((s) => s.x >= 30 && s.x <= 450)), 'every enemy comes in over the screen');
  assert.strictEqual(K.shooter.waves({ waves: { count: 1 } }).length, 3, 'a nonsense count is held in range');
});

test('the ship moves with the arrow keys, stays on the screen and fires with space', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'shooter', waves: { count: 3, seed: 1 } });
  const x0 = s.me.x;
  K.press('ArrowRight'); run(s, 0.5); K.press('ArrowRight', false);
  assert.ok(s.me.x > x0 + 80);
  K.press('ArrowLeft'); run(s, 5); K.press('ArrowLeft', false);
  assert.strictEqual(s.me.x, 0, 'it stops at the edge');
  K.press(' '); run(s, 0.3);
  assert.ok(s.g.all('pbullet').length >= 1, 'bullets fly');
  K.press(' ', false);
});

test('a bullet kills an enemy that has one point of life, gives points, and sometimes drops a power-up', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'shooter', difficulty: 1, waves: { count: 3, seed: 2 } });
  let drops = 0;
  for (let n = 0; n < 60; n++) {
    s.g.all('enemy').forEach((e) => { e.dead = true; });
    const before = s.hud.score;
    run(s, 2.5);
    const e = s.g.all('enemy').find((en) => !en.dead && en.kind === 'drifter');
    if (!e) continue;
    s.me.x = e.cx - s.me.w / 2; s.me.y = 520; e.hp = 1;
    K.press(' ', true); run(s, 1.5); K.press(' ', false);
    if (s.hud.score > before) { assert.ok(s.hud.score - before >= 100); }
    drops += s.g.all('powerup').length;
    if (drops) break;
  }
  assert.ok(s.hud.score >= 100, 'killing gives points');
});

test('being hit costs a life, the ship is safe for a moment, and the last life ends the game', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'shooter', ship: { lives: 2, fire: 'single', speed: 260 }, waves: { count: 3, seed: 1 } });
  const bullet = () => s.g.add({ shape: 'circle', x: s.me.cx, y: s.me.cy, r: 4, vx: 0, vy: 0, tag: 'ebullet', color: '#f00' });
  bullet(); run(s, 0.1);
  assert.strictEqual(s.hud.lives, 1);
  bullet(); run(s, 0.1);
  assert.strictEqual(s.hud.lives, 1, 'a second hit right away does nothing');
  run(s, 2.2);
  bullet(); run(s, 0.1);
  assert.strictEqual(s.hud.lives, 0);
  run(s, 1.5);
  assert.strictEqual(s.g.current, 'over');
  K.press('r'); run(s, 0.1); K.press('r', false);
  assert.strictEqual(s.g.current, 'play');
  assert.strictEqual(s.hud.lives, 2, 'R starts over');
});

test('features: shield absorbs a hit, bomb clears the bullets, spread fires three ways, rapid fires faster', () => {
  const K = fresh();
  let s = K.kit.run({ kit: 'shooter', features: ['shield'], waves: { count: 3, seed: 1 } });
  assert.strictEqual(s.hud.shield, 1);
  s.g.add({ shape: 'circle', x: s.me.cx, y: s.me.cy, r: 4, tag: 'ebullet', color: '#f00' }); run(s, 0.1);
  assert.strictEqual(s.hud.lives, 3, 'the shield took it'); assert.strictEqual(s.hud.shield, 0);

  const KK = fresh(); const t = KK.kit.run({ kit: 'shooter', features: ['bomb'], waves: { count: 3, seed: 1 } });
  assert.strictEqual(t.hud.bombs, 2);
  for (let i = 0; i < 5; i++) t.g.add({ shape: 'circle', x: 100 + i * 50, y: 200, r: 4, vy: 50, tag: 'ebullet', color: '#f00' });
  KK.press('b'); run(t, 0.1); KK.press('b', false);
  assert.strictEqual(t.g.all('ebullet').filter((b) => !b.dead).length, 0);
  assert.strictEqual(t.hud.bombs, 1);

  const sp = fresh(); const u = sp.kit.run({ kit: 'shooter', features: ['spread'], waves: { count: 3, seed: 1 } });
  sp.press(' '); run(u, 0.1); sp.press(' ', false);
  assert.strictEqual(u.g.all('pbullet').length, 3);

  const rp = fresh(), r1 = rp.kit.run({ kit: 'shooter', features: ['rapid'], waves: { count: 3, seed: 1 } });
  assert.ok(r1.fireGap < 0.2);
});

test('with a boss the game is won only after the boss is beaten; without one after the last wave', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'shooter', difficulty: 2, waves: { count: 3, seed: 3 }, boss: true, ship: { lives: 5, fire: 'spread', speed: 260 }, features: ['shield', 'bomb'] });
  let bossSeen = false;
  const drive = bot(K, s);
  run(s, 160, (i) => { drive(); if (s.boss) bossSeen = true; });
  assert.ok(bossSeen, 'a boss came after the last wave');
  assert.strictEqual(s.g.current, 'win', 'and beating it wins the game');
  assert.ok(s.hud.score >= 3000, 'the boss is worth a lot');
  const K2 = fresh();
  const t = play(K2, { kit: 'shooter', difficulty: 1, waves: { count: 3, seed: 3 }, boss: false, ship: { lives: 9, fire: 'spread', speed: 260 } }, 60);
  assert.strictEqual(t.g.current, 'win');
  assert.ok(t.hud.score > 1000);
});

test('a careful bot can win every difficulty (the waves are always beatable)', () => {
  const failures = [];
  for (let difficulty = 1; difficulty <= 5; difficulty++) {
    for (const seed of [1, 2, 3]) {
      const K = fresh();
      const s = play(K, { kit: 'shooter', difficulty, waves: { count: 6, seed }, ship: { lives: 3, fire: 'double', speed: 260 }, enemies: ['drifter', 'zigzag', 'shooter', 'kamikaze', 'tank'] }, 200);
      if (s.g.current !== 'win') failures.push(difficulty + '/' + seed + ': ' + s.g.current + ' wave ' + s.hud.wave + ' lives ' + s.hud.lives);
    }
  }
  assert.deepStrictEqual(failures, []);
});

test('the music, theme and tune can be chosen, and a spec that only names them runs', () => {
  for (const theme of ['space', 'night', 'sky', 'underwater', 'cave', 'castle', 'forest']) {
    const K = fresh();
    const s = K.kit.run({ kit: 'shooter', theme, musicStyle: { mood: 'epic', tempo: 'fast', seed: 5 }, waves: { count: 3, seed: 1 } });
    run(s, 3);
    assert.strictEqual(s.g.background.startsWith('#'), true, theme);
  }
});
