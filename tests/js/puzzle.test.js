const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const FILES = ['kgame.js', 'kgame.audio2.js', 'kgame.kits.js', 'kgame.puzzle.js'];
const fresh = () => { const K = load(...FILES); K.puzzle.menuAtStart = false; return K; };
function run(state, seconds, each) { for (let i = 0; i < Math.round(seconds * 60); i++) { if (each) each(i); state.g.step(1 / 60); } }
const spec = (o = {}) => ({ kit: 'puzzle', world: { seed: 5 }, ...o });
const tapKey = (K, s, key) => { K.press(key); run(s, 0.06); K.press(key, false); run(s, 0.06); };

test('the registry has the puzzle kit, its modes and features, and checks a spec', () => {
  const K = fresh();
  assert.ok(K.kit.list().includes('puzzle')); for (const f of ['ghost', 'hold', 'hint']) assert.ok(K.feature.list('puzzle').includes(f), f);
  assert.deepStrictEqual(K.kit.check({ kit: 'puzzle' }), []);
  assert.ok(K.kit.check({ kit: 'puzzle', mode: 'chess' })[0].includes('bilinmeyen mod'));
  assert.ok(K.kit.check({ kit: 'puzzle', theme: 'moon' })[0].includes('bilinmeyen tema'));
  assert.ok(K.kit.check({ kit: 'puzzle', size: 'huge' })[0].includes('bilinmeyen boyut'));
  assert.ok(K.kit.check({ kit: 'puzzle', difficulty: 9 })[0].includes('difficulty'));
  assert.ok(K.kit.check({ kit: 'puzzle', goal: -5 })[0].includes('goal'));
});

test('blocks: every piece turns back to itself after four turns, a piece falls, moves, drops hard and locks, a full row clears and scores, and a stack to the top ends the game', () => {
  const K = fresh();
  for (const name of Object.keys(K.puzzle.pieces)) {
    const key = (cs) => cs.map((c) => c.join(',')).sort().join(';');
    assert.strictEqual(key(K.puzzle.cellsOf(name, 4)), key(K.puzzle.cellsOf(name, 0)), name + ' four turns'); assert.strictEqual(K.puzzle.cellsOf(name, 1).length, 4);
  }
  const s = K.kit.run(spec({ mode: 'blocks', difficulty: 1 })); s.start(); const B = s.game; const y0 = B.piece.y, x0 = B.piece.x;
  run(s, 2.2); assert.ok(B.piece.y > y0, 'the piece falls');
  tapKey(K, s, 'ArrowLeft'); assert.ok(B.piece.x < x0 + 1, 'moves left');
  const t0 = B.piece.t; tapKey(K, s, ' '); assert.ok(B.board.some((row) => row.some((v) => v > 0)), 'a hard drop locks the piece'); assert.ok(s.score > 0, 'a drop scores');
  // a full row: fill the bottom row except one gap, drop an I piece vertical into the gap
  B.board.forEach((row) => row.fill(0)); B.board[19] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 0]; B.piece = { t: 'I', r: 1, x: 7, y: 0 }; const before = s.score; tapKey(K, s, ' '); run(s, 0.5);
  assert.ok(B.lines >= 1, 'a line cleared: ' + B.lines); assert.ok(s.score > before, 'and scored');
  // game over: fill the board up
  for (let y = 2; y < 20; y++) B.board[y] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 0]; B.board[0] = new Array(10).fill(1); B.board[1] = new Array(10).fill(1); tapKey(K, s, ' '); run(s, 1);
  assert.strictEqual(s.over, true); assert.strictEqual(s.won, false);
  K.press('r'); run(s, 0.1); K.press('r', false); run(s, 0.1); assert.strictEqual(s.over, false); assert.ok(s.game.board.every((row) => row.every((v) => v === 0)), 'R starts again');
});

test('blocks: a goal wins, the ghost and the hold are features, and the next pieces are shown', () => {
  const K = fresh(); const s = K.kit.run(spec({ mode: 'blocks', goal: 100, features: ['ghost', 'hold'] })); s.start(); const B = s.game;
  assert.strictEqual(s.hasGhost, true); assert.strictEqual(s.hasHold, true); assert.strictEqual(B.next.length >= 2, true);
  const first = B.piece.t; tapKey(K, s, 'c'); assert.strictEqual(B.hold, first, 'the piece is held'); assert.notStrictEqual(B.piece, null);
  const second = B.piece.t; tapKey(K, s, 'c'); assert.strictEqual(B.piece.t, second, 'one hold for each piece');
  B.board.forEach((row) => row.fill(0)); B.board[19] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 0]; B.piece = { t: 'I', r: 1, x: 7, y: 0 }; tapKey(K, s, ' '); run(s, 0.6);
  assert.strictEqual(s.over, true); assert.strictEqual(s.won, true, 'the score reached the goal');
});

test('match: the board starts without a ready match and with a move to make, a swap that makes a line scores and costs a move, a useless swap goes back, and chains fill the board again', () => {
  const K = fresh();
  for (let seed = 1; seed <= 15; seed++) for (const size of ['small', 'medium', 'large']) {
    const s = K.kit.run(spec({ mode: 'match', world: { seed }, size })); s.start(); const M = s.game, N = M.grid.length;
    const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? -1 : M.grid[y][x]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { assert.ok(!(at(x, y) === at(x + 1, y) && at(x, y) === at(x + 2, y)), 'no row of three at the start'); assert.ok(!(at(x, y) === at(x, y + 1) && at(x, y) === at(x, y + 2)), 'no column of three'); }
  }
  const s = K.kit.run(spec({ mode: 'match', world: { seed: 6 }, size: 'medium', difficulty: 2 })); s.start(); const M = s.game, N = M.grid.length;
  const lines = (x, y) => { const v = M.grid[y][x]; let h = 1, k = x - 1; while (k >= 0 && M.grid[y][k] === v) { h++; k--; } k = x + 1; while (k < N && M.grid[y][k] === v) { h++; k++; } let w = 1; k = y - 1; while (k >= 0 && M.grid[k][x] === v) { w++; k--; } k = y + 1; while (k < N && M.grid[k][x] === v) { w++; k++; } return h >= 3 || w >= 3; };
  const swap = (a, b, c, d) => { const t = M.grid[b][a]; M.grid[b][a] = M.grid[d][c]; M.grid[d][c] = t; };
  let good = null, bad = null;
  for (let y = 0; y < N && !(good && bad); y++) for (let x = 0; x < N - 1 && !(good && bad); x++) { swap(x, y, x + 1, y); const ok = lines(x, y) || lines(x + 1, y); swap(x, y, x + 1, y); if (ok && !good) good = [x, y, x + 1, y]; if (!ok && !bad) bad = [x, y, x + 1, y]; }
  const go = (m) => { M.cx = m[0]; M.cy = m[1]; tapKey(K, s, ' '); M.cx = m[2]; M.cy = m[3]; tapKey(K, s, ' '); };
  const movesBefore = M.moves; go(bad); run(s, 1); assert.strictEqual(M.moves, movesBefore, 'a useless swap costs nothing'); assert.strictEqual(s.score, 0);
  go(good); run(s, 4); assert.strictEqual(M.moves, movesBefore - 1, 'a good swap costs a move'); assert.ok(s.score >= 30, 'and scores: ' + s.score);
  assert.ok(M.grid.every((row) => row.every((v) => v >= 0)), 'the board is full again'); assert.strictEqual(M.phase, 'idle');
});

function findGood(M) {
  const N = M.grid.length, at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? -1 : M.grid[y][x]);
  const hit = (x, y) => { const v = at(x, y); let h = 1, k = x - 1; while (at(k, y) === v) { h++; k--; } k = x + 1; while (at(k, y) === v) { h++; k++; } let w = 1; k = y - 1; while (at(x, k) === v) { w++; k--; } k = y + 1; while (at(x, k) === v) { w++; k++; } return h >= 3 || w >= 3; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N - 1; x++) { const t = M.grid[y][x]; M.grid[y][x] = M.grid[y][x + 1]; M.grid[y][x + 1] = t; const ok = hit(x, y) || hit(x + 1, y); M.grid[y][x + 1] = M.grid[y][x]; M.grid[y][x] = t; if (ok) return [x, y, x + 1, y]; }
  return null;
}

test('match: reaching the goal wins, running out of moves loses, and the hint shows a move after a wait', () => {
  const K = fresh(); const play = (o, setup) => { const s = K.kit.run(spec({ mode: 'match', world: { seed: 6 }, ...o })); s.start(); const M = s.game, m = findGood(M); setup(M); M.cx = m[0]; M.cy = m[1]; tapKey(K, s, ' '); M.cx = m[2]; M.cy = m[3]; tapKey(K, s, ' '); run(s, 5); return s; };
  const won = play({ goal: 30 }, () => {}); assert.strictEqual(won.over, true); assert.strictEqual(won.won, true, 'the goal is reached with one swap');
  const lost = play({ goal: 50000 }, (M) => { M.moves = 1; }); assert.strictEqual(lost.over, true); assert.strictEqual(lost.won, false, 'no moves left under the goal');
  const h = K.kit.run(spec({ mode: 'match', features: ['hint'] })); h.start(); run(h, 7); assert.ok(h.game.hint && h.game.hint.length === 4, 'the hint after a wait');
  const n = K.kit.run(spec({ mode: 'match' })); n.start(); run(n, 7); assert.strictEqual(n.game.hint, null, 'no hint without the feature');
});

test('memory: pairs are dealt, two flipped cards that match stay open, two that differ turn back, a hand full of pairs wins, and a move limit loses', () => {
  const K = fresh(); const s = K.kit.run(spec({ mode: 'memory', size: 'small', difficulty: 3 })); s.start(); const Mm = s.game;
  assert.strictEqual(Mm.cards.length, 12); const count = {}; Mm.cards.forEach((c) => { count[c.id] = (count[c.id] || 0) + 1; }); assert.ok(Object.values(count).every((n) => n === 2), 'every card has one twin');
  const flip = (i) => { Mm.cx = i % 4; Mm.cy = Math.floor(i / 4); tapKey(K, s, ' '); };
  const a = 0, b = Mm.cards.findIndex((c, i) => i !== 0 && c.id === Mm.cards[0].id), other = Mm.cards.findIndex((c) => c.id !== Mm.cards[0].id);
  flip(a); flip(b); assert.ok(Mm.cards[a].done && Mm.cards[b].done, 'a pair stays open'); assert.strictEqual(Mm.moves, 1); assert.strictEqual(s.score, 100);
  const c = Mm.cards.findIndex((q) => !q.done), dd = Mm.cards.findIndex((q, i) => !q.done && i !== c && q.id !== Mm.cards[c].id);
  flip(c); flip(dd); assert.ok(Mm.cards[c].up && Mm.cards[dd].up, 'two different cards show'); run(s, 1.2); assert.ok(!Mm.cards[c].up && !Mm.cards[dd].up, 'and turn back'); assert.strictEqual(Mm.moves, 2);
  Mm.cards.forEach((q, i) => { if (i !== c && i !== Mm.cards.findIndex((r, j) => j !== c && r.id === Mm.cards[c].id)) q.done = true; });
  const twin = Mm.cards.findIndex((r, j) => j !== c && r.id === Mm.cards[c].id); Mm.cards[twin].done = false; flip(c); flip(twin); assert.strictEqual(s.over, true); assert.strictEqual(s.won, true);
  const lim = K.kit.run(spec({ mode: 'memory', size: 'small', goal: 2, difficulty: 5 })); lim.start(); const L = lim.game; const f2 = (i) => { L.cx = i % 4; L.cy = Math.floor(i / 4); tapKey(K, lim, ' '); };
  for (let round = 0; round < 3 && !lim.over; round++) { const x = L.cards.findIndex((q) => !q.done && !q.up), y = L.cards.findIndex((q, i) => !q.done && !q.up && i !== x && q.id !== L.cards[x].id); f2(x); f2(y); run(lim, 1); }
  assert.strictEqual(lim.over, true); assert.strictEqual(lim.won, false, 'out of moves');
});

test('the puzzle menus: a main menu first (the game waits), Esc pauses, the pause menu restarts or goes back, and the controls page shows for every mode', () => {
  const K = fresh(); K.puzzle.menuAtStart = true;
  for (const mode of ['blocks', 'match', 'memory']) {
    const s = K.kit.run(spec({ mode })); s.start(); assert.strictEqual(s.menu.open, true); const t0 = s.time; run(s, 2); assert.strictEqual(s.time, t0, mode + ': waits behind the menu');
    K.press('Enter'); run(s, 0.1); K.press('Enter', false); run(s, 0.1); assert.strictEqual(s.menu.open, false);
    K.press('Escape'); run(s, 0.1); K.press('Escape', false); run(s, 0.1); assert.strictEqual(s.menu.kind, 'pause');
    assert.deepStrictEqual(s.menuItems().map((i) => i.label), ['Devam et', 'Kontroller', 'Müzik: açık', 'Baştan başla', 'Ana menü']);
    s.menuItems()[1].act(); assert.strictEqual(s.menu.kind, 'controls'); K.press('Escape'); run(s, 0.1); K.press('Escape', false); run(s, 0.1); assert.strictEqual(s.menu.kind, 'pause');
    s.menuItems()[4].act(); assert.strictEqual(s.menu.kind, 'main'); assert.strictEqual(s.menuItems()[0].label, 'Devam et');
  }
});

test('the puzzle tune: written for the kit, calm, a lead and a bass of the same length, played by default', () => {
  const K = fresh(); const t = K.music.tracks.puzzle; assert.ok(t, 'the puzzle tune exists'); assert.ok(t.bpm <= 130 && t.bass && t.loop);
  const beats = (notes) => notes.reduce((a, n) => a + n.beats, 0); assert.strictEqual(beats(t.notes), beats(t.bass), 'lead and bass stay together');
  assert.ok(t.notes.every((n) => n.freq === 0 || n.freq > 100), 'every note was understood');
  assert.strictEqual(K.kit.run(spec()).spec.music, 'puzzle');
});
