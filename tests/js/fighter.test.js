const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const FILES = ['kgame.js', 'kgame.audio2.js', 'kgame.kits.js', 'kgame.fighter.js'];
const fresh = () => { const K = load(...FILES); K.fighter.menuAtStart = false; return K; };
function run(state, seconds, each) { for (let i = 0; i < Math.round(seconds * 60); i++) { if (each) each(i); state.g.step(1 / 60); } }
const spec = (o = {}) => ({ kit: 'fighter', world: { seed: 5 }, ...o });
const tapKey = (K, s, key) => { K.press(key); run(s, 0.05); K.press(key, false); run(s, 0.05); };
const ready = (K, o) => { const s = K.kit.run(spec(o)); s.start(); run(s, 1.8); assert.strictEqual(s.phase, 'fight'); return s; };
const still = (s, hold) => { s.f[1].ai.off = true; s.f[1].ai.hold = hold || ''; };   // the opponent only stands there (or holds its block)

test('the registry has the fighter kit, its features, and checks a spec', () => {
  const K = fresh();
  assert.ok(K.kit.list().includes('fighter')); for (const f of ['special', 'versus', 'rage']) assert.ok(K.feature.list('fighter').includes(f), f);
  assert.deepStrictEqual(K.kit.check({ kit: 'fighter' }), []);
  assert.ok(K.kit.check({ kit: 'fighter', theme: 'moon' })[0].includes('bilinmeyen tema'));
  assert.ok(K.kit.check({ kit: 'fighter', hero: 'dragon' })[0].includes('bilinmeyen dövüşçü'));
  assert.ok(K.kit.check({ kit: 'fighter', rival: 'dragon' })[0].includes('bilinmeyen rakip'));
  assert.ok(K.kit.check({ kit: 'fighter', color: 'pink' })[0].includes('bilinmeyen renk'));
  assert.ok(K.kit.check({ kit: 'fighter', rounds: 9 })[0].includes('rounds'));
  assert.ok(K.kit.check({ kit: 'fighter', time: 5 })[0].includes('time'));
});

test('a match begins with an intro, then the fighters move, jump, face each other and stay inside the stage', () => {
  const K = fresh(); const s = K.kit.run(spec()); s.start(); assert.strictEqual(s.phase, 'intro'); K.press('d'); run(s, 0.5); assert.strictEqual(s.f[0].vx, 0, 'no moving in the intro'); K.press('d', false);
  run(s, 1.5); assert.strictEqual(s.phase, 'fight'); still(s); const a = s.f[0], x0 = a.x;
  K.press('a'); run(s, 0.4); K.press('a', false); assert.ok(a.x < x0 - 10, 'walks left'); K.press('d'); run(s, 0.6); K.press('d', false); assert.ok(a.x > x0 - 10, 'walks right');
  assert.strictEqual(a.face, s.f[1].x > a.x ? 1 : -1, 'looks at the opponent'); tapKey(K, s, 'w'); run(s, 0.1); assert.ok(a.y < 168 && !a.grounded, 'jumps'); run(s, 1.2); assert.ok(a.grounded && a.y === 168, 'and lands');
  K.press('a'); run(s, 6); K.press('a', false); assert.ok(a.x >= 18, 'stays in the stage');
});

test('attacks: a punch hits when close and misses from far, the kick is slower and hurts more, a block takes most of it, and the fighter behind the hit is pushed away', () => {
  const K = fresh(); const s = ready(K, { difficulty: 1 }); still(s); const a = s.f[0], b = s.f[1];
  a.x = 140; b.x = 140 + 22; b.vx = 0; const hp0 = b.hp; assert.strictEqual(s.attack(a, 'punch'), true); run(s, 0.4); assert.ok(b.hp < hp0, 'the punch hits'); const punch = hp0 - b.hp; assert.strictEqual(b.st === 'hit' || b.st === 'idle', true);
  run(s, 1); b.x = 140 + 24; b.hp = b.maxHp; b.vx = 0; s.attack(a, 'kick'); run(s, 0.5); const kick = b.maxHp - b.hp; assert.ok(kick > punch, 'the kick hurts more: ' + kick + ' against ' + punch);
  run(s, 1); a.x = 100; b.x = 260; b.hp = b.maxHp; s.attack(a, 'punch'); run(s, 0.5); assert.strictEqual(b.hp, b.maxHp, 'a punch from far hits nothing');
  run(s, 1); a.x = 140; b.x = 162; b.hp = b.maxHp; still(s, 'block'); run(s, 0.1); s.attack(a, 'kick'); run(s, 0.4); const blocked = b.maxHp - b.hp; assert.ok(blocked < kick * 0.5, 'a block takes most of it: ' + blocked);
  run(s, 1); still(s); b.hp = b.maxHp; b.x = 170; b.st = 'idle'; b.block = false; a.x = 148; const bx = b.x; s.attack(a, 'kick'); run(s, 0.3); assert.ok(b.x > bx + 8, 'pushed away');
  run(s, 0.8); assert.strictEqual(s.attack(a, 'punch'), true); assert.strictEqual(s.attack(a, 'kick'), false, 'cannot start a second move in the middle of one');
});

test('combos, meter and the special move: hits fill the meter, the special needs half of it and flies as a ball that hurts or is blocked, only with the feature', () => {
  const K = fresh(); const s = ready(K, { features: ['special'], difficulty: 1 }); still(s); const a = s.f[0], b = s.f[1];
  assert.strictEqual(s.special(a), false, 'no meter yet'); a.x = 140; b.x = 162; for (let i = 0; i < 6; i++) { b.st = 'idle'; b.x = 162; b.stun = 0; a.st = 'idle'; a.move = null; a.x = 140; s.attack(a, 'punch'); run(s, 0.24); }
  assert.ok(a.meter >= 36 && a.combo >= 2, 'hits fill the meter and count a combo: ' + a.meter + ' ' + a.combo); a.meter = 100; a.st = 'idle'; a.x = 80; b.x = 240; b.hp = b.maxHp; b.st = 'idle'; b.stun = 0;
  assert.strictEqual(s.special(a), true); assert.strictEqual(a.meter, 50); assert.strictEqual(s.fire.length, 1); run(s, 1.4); assert.ok(b.hp < b.maxHp, 'the ball hurts'); assert.strictEqual(s.fire.length, 0);
  run(s, 1); b.hp = b.maxHp; still(s, 'block'); run(s, 0.1); a.st = 'idle'; a.meter = 100; s.special(a); run(s, 1.4); assert.ok(b.maxHp - b.hp <= 4, 'a block stops most of the ball');
  const plain = ready(K, { features: [] }); plain.f[0].meter = 100; assert.strictEqual(plain.special(plain.f[0]), false, 'no special without the feature');
});

test('rounds: a knockout wins the round, time over gives it to who has more life, the match is won at the round count, and R starts again', () => {
  const K = fresh(); const s = ready(K, { rounds: 2, difficulty: 1 }); still(s); const a = s.f[0], b = s.f[1];
  a.x = 140; b.x = 162; b.hp = 3; s.attack(a, 'punch'); run(s, 0.4); assert.strictEqual(b.st, 'ko'); assert.strictEqual(s.wins[0], 1); assert.strictEqual(s.phase, 'ko'); run(s, 4); assert.strictEqual(s.round, 2); assert.strictEqual(s.phase, 'intro'); assert.strictEqual(b.hp, b.maxHp, 'a new round, new life');
  run(s, 1.8); still(s); b.hp = 10; s.clock = 0.2; run(s, 0.6); assert.strictEqual(s.wins[0], 2, 'time over: the one with more life wins the round'); run(s, 4); assert.strictEqual(s.over, true); assert.strictEqual(s.won, true);
  K.press('r'); run(s, 0.1); K.press('r', false); run(s, 0.1); assert.strictEqual(s.over, false); assert.deepStrictEqual(s.wins, [0, 0]); assert.strictEqual(s.round, 1);
  const t = ready(K, { rounds: 1 }); t.f[0].hp = 2; t.f[0].x = 140; t.f[1].x = 160; t.f[1].ai.cd = 0; t.f[1].ai.plan = 'attack'; run(t, 20); assert.ok(t.over || t.wins[1] > 0 || t.f[0].hp < 2 || t.f[0].st === 'ko', 'the opponent finishes a weak player');
});

test('the opponent: it comes to you and fights, a harder one hits more often, and a one-life player can lose the match', () => {
  const K = fresh(); const damageIn = (difficulty, seed) => { const s = K.kit.run(spec({ difficulty, world: { seed }, rival: 'brawler', rounds: 5 })); s.start(); run(s, 1.8); s.f[0].hp = s.f[0].maxHp = 100000; s.f[0].meter = 0; run(s, 25); return 100000 - s.f[0].hp; };
  const easy = [1, 2, 3].reduce((q, seed) => q + damageIn(1, seed), 0), hard = [1, 2, 3].reduce((q, seed) => q + damageIn(5, seed), 0);
  assert.ok(hard > 0, 'it fights: ' + hard); assert.ok(hard > easy, 'harder means more: ' + easy + ' against ' + hard);
  const s = ready(K, { difficulty: 5 }); const dx0 = Math.abs(s.f[1].x - s.f[0].x); s.f[0].st = 'idle'; run(s, 3); assert.ok(Math.abs(s.f[1].x - s.f[0].x) <= dx0 + 2, 'it closes the distance');
  const fire = ready(K, { features: ['special'], difficulty: 5 }); fire.f[1].meter = 100; fire.f[1].ai.cd = 0; fire.f[0].x = 40; fire.f[1].x = 280; let shot = false; run(fire, 6, () => { if (fire.fire.length) shot = true; }); assert.ok(shot, 'the opponent throws the ball from afar');
});

test('two players: with versus the second fighter answers the arrows and N M , . keys and the computer stays out of it; rage hurts more at low life', () => {
  const K = fresh(); const s = ready(K, { features: ['versus', 'special'] }); const b = s.f[1], a = s.f[0]; a.x = 140; b.x = 190; const x0 = b.x;
  K.press('ArrowLeft'); run(s, 0.4); K.press('ArrowLeft', false); assert.ok(b.x < x0 - 8, 'the second player moves'); run(s, 0.3); b.x = a.x + 22; a.hp = a.maxHp; tapKey(K, s, 'n'); run(s, 0.4); assert.ok(a.hp < a.maxHp, 'the second player punches');
  const idle = b.x; run(s, 2); assert.ok(Math.abs(b.x - idle) < 12, 'the computer does not move it');
  const r = ready(K, { features: ['rage'], difficulty: 1 }); still(r); const q = r.f[0], t = r.f[1]; q.x = 140; t.x = 160; t.hp = t.maxHp; r.attack(q, 'punch'); run(r, 0.4); const normal = t.maxHp - t.hp;
  run(r, 1); q.hp = 10; t.hp = t.maxHp; t.st = 'idle'; t.x = 160; q.st = 'idle'; r.attack(q, 'punch'); run(r, 0.4); assert.ok(t.maxHp - t.hp > normal, 'rage hurts more');
});

test('the kinds of fighter differ: the ninja is quick and light, the big one slow with more life and heavier blows', () => {
  const K = fresh(); const mk = (hero) => { const s = K.kit.run(spec({ hero, rival: 'brawler' })); s.start(); return s.f[0]; };
  const ninja = mk('ninja'), brawler = mk('brawler'), sumo = mk('sumo'); assert.ok(ninja.def.spd > brawler.def.spd && brawler.def.spd > sumo.def.spd, 'speed'); assert.ok(sumo.maxHp > brawler.maxHp && brawler.maxHp > ninja.maxHp, 'life'); assert.ok(sumo.def.dmg > brawler.def.dmg && brawler.def.dmg > ninja.def.dmg, 'strength');
});

test('the fighter tune: written for the kit, hard and fast, a lead and a bass of the same length, played by default', () => {
  const K = fresh(); const t = K.music.tracks.fighter; assert.ok(t, 'the fighter tune exists'); assert.ok(t.bpm >= 140 && t.bass && t.loop);
  const beats = (notes) => notes.reduce((a, n) => a + n.beats, 0); assert.strictEqual(beats(t.notes), beats(t.bass), 'lead and bass stay together');
  assert.ok(t.notes.every((n) => n.freq === 0 || n.freq > 100), 'every note was understood'); assert.strictEqual(K.kit.run(spec()).spec.music, 'fighter');
});

test('the fighter menus: a main menu first (the fight waits), Esc pauses, the pause menu restarts or goes back, and the controls page shows', () => {
  const K = fresh(); K.fighter.menuAtStart = true; const s = K.kit.run(spec()); s.start();
  assert.strictEqual(s.menu.open, true); const t0 = s.time; run(s, 2); assert.strictEqual(s.time, t0, 'waits behind the menu');
  K.press('Enter'); run(s, 0.1); K.press('Enter', false); run(s, 0.1); assert.strictEqual(s.menu.open, false);
  K.press('Escape'); run(s, 0.1); K.press('Escape', false); run(s, 0.1); assert.strictEqual(s.menu.kind, 'pause');
  assert.deepStrictEqual(s.menuItems().map((i) => i.label), ['Devam et', 'Kontroller', 'Müzik: açık', 'Baştan başla', 'Ana menü']);
  s.menuItems()[1].act(); assert.strictEqual(s.menu.kind, 'controls'); K.press('Escape'); run(s, 0.1); K.press('Escape', false); run(s, 0.1); assert.strictEqual(s.menu.kind, 'pause');
  s.menuItems()[4].act(); assert.strictEqual(s.menu.kind, 'main'); assert.strictEqual(s.menuItems()[0].label, 'Devam et');
});
