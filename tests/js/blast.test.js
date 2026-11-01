const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const FILES = ['kgame.js', 'kgame.audio2.js', 'kgame.kits.js', 'kgame.blast.js'];
const fresh = () => { const K = load(...FILES); K.blast.menuAtStart = false; return K; };
function run(state, seconds, each) { for (let i = 0; i < Math.round(seconds * 60); i++) { if (each) each(i); state.g.step(1 / 60); } }
const spec = (o = {}) => ({ kit: 'blast', world: { seed: 5 }, ...o });
const tapKey = (K, s, key) => { K.press(key); run(s, 0.05); K.press(key, false); run(s, 0.05); };
const piece = (cells, color = [200, 60, 60]) => { let w = 0, h = 0; cells.forEach((c) => { w = Math.max(w, c[0] + 1); h = Math.max(h, c[1] + 1); }); return { cells, color, bomb: false, w, h }; };
const empty = (s) => { s.board.forEach((r) => r.fill(0)); };

test('the registry has the blast kit, its features, and checks a spec', () => {
  const K = fresh();
  assert.ok(K.kit.list().includes('blast')); for (const f of ['hint', 'undo', 'bomb']) assert.ok(K.feature.list('blast').includes(f), f);
  assert.deepStrictEqual(K.kit.check({ kit: 'blast' }), []);
  assert.ok(K.kit.check({ kit: 'blast', theme: 'moon' })[0].includes('bilinmeyen tema'));
  assert.ok(K.kit.check({ kit: 'blast', size: 'huge' })[0].includes('bilinmeyen boyut'));
  assert.ok(K.kit.check({ kit: 'blast', difficulty: 9 })[0].includes('difficulty'));
  assert.ok(K.kit.check({ kit: 'blast', goal: -1 })[0].includes('goal'));
});

test('the start: an empty (or a little filled) board of the right size, three pieces dealt, at least one of which fits, and the same seed deals the same pieces', () => {
  const K = fresh();
  for (const [size, n] of [['small', 6], ['medium', 8], ['large', 10]]) for (let seed = 1; seed <= 12; seed++) for (const difficulty of [1, 3, 5]) {
    const s = K.kit.run(spec({ size, difficulty, world: { seed } })); s.start(); assert.strictEqual(s.board.length, n); assert.ok(s.board.every((r) => r.length === n));
    assert.ok(s.pieces.every(Boolean) && s.pieces.length === 3, 'three pieces'); assert.ok(s.pieces.some((p) => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (s.canPlace(p, x, y)) return true; return false; }), 'one fits');
    assert.ok(s.board.every((r) => !r.every((v) => v)), 'no full row at the start'); assert.strictEqual(s.over, false);
  }
  const filled = (difficulty) => { const s = K.kit.run(spec({ difficulty })); s.start(); return s.board.reduce((a, r) => a + r.filter(Boolean).length, 0); };
  assert.strictEqual(filled(1), 0); assert.ok(filled(5) > filled(2), 'a harder game starts with more blocks');
  const shape = (seed) => { const s = K.kit.run(spec({ world: { seed } })); s.start(); return JSON.stringify(s.pieces.map((p) => p.cells)); }; assert.strictEqual(shape(7), shape(7));
});

test('placing: a piece goes on empty cells only, inside the board, the cells fill and score, the slot empties, and a new set comes when all three are used', () => {
  const K = fresh(); const s = K.kit.run(spec({ difficulty: 1 })); s.start(); empty(s); s.pieces = [piece([[0, 0], [1, 0], [0, 1]]), piece([[0, 0]]), piece([[0, 0], [1, 0], [2, 0]])]; const sc0 = s.score;
  assert.strictEqual(s.canPlace(s.pieces[0], -1, 0), false, 'not outside'); assert.strictEqual(s.canPlace(s.pieces[0], 7, 7), false, 'not over the edge'); assert.strictEqual(s.canPlace(s.pieces[0], 3, 3), true);
  assert.strictEqual(s.place(0, 3, 3), true); assert.strictEqual(s.board[3][3] > 0 && s.board[3][4] > 0 && s.board[4][3] > 0 && !s.board[4][4], true); assert.strictEqual(s.score, sc0 + 3); assert.strictEqual(s.pieces[0], null);
  assert.strictEqual(s.place(1, 3, 3), false, 'not on a filled cell'); assert.strictEqual(s.place(0, 0, 0), false, 'an empty slot gives nothing'); assert.strictEqual(s.place(1, 6, 6), true); assert.strictEqual(s.place(2, 0, 7), true);
  assert.ok(s.pieces.every(Boolean), 'a new set of three'); assert.strictEqual(s.moves, 3);
});

test('clearing: a full row or column blows up and scores more for more lines at once, a streak of clears raises the combo, a clear board pays, and a miss ends the streak', () => {
  const K = fresh(); const s = K.kit.run(spec({ difficulty: 1 })); s.start(); empty(s);
  s.board[7] = [1, 1, 1, 1, 1, 1, 1, 0]; s.pieces = [piece([[0, 0]]), piece([[0, 0]]), piece([[0, 0]])]; const before = s.score; assert.strictEqual(s.place(0, 7, 7), true); run(s, 0.6);
  assert.ok(s.board[7].every((v) => v === 0), 'the row is gone'); assert.strictEqual(s.lines, 1); assert.ok(s.score - before >= 10 + 1, 'a line scores: ' + (s.score - before)); assert.strictEqual(s.streak, 1);
  empty(s); s.board[7] = [1, 1, 1, 1, 1, 1, 1, 0]; for (let y = 0; y < 7; y++) s.board[y][7] = 1; s.pieces = [piece([[0, 0]]), piece([[0, 0]]), piece([[0, 0]])]; const b2 = s.score; s.place(1, 7, 7); run(s, 0.6);
  assert.ok(s.board.every((r) => r.every((v) => v === 0)), 'row and column together'); assert.strictEqual(s.lines, 3); const two = s.score - b2; assert.ok(two >= 40, 'two lines at once pay much more: ' + two); assert.ok(s.streak >= 2, 'the combo grows: ' + s.streak);
  const hundred = s.score; empty(s); s.pieces = [piece([[0, 0]]), piece([[0, 0]]), piece([[0, 0]])]; s.place(0, 0, 0); assert.strictEqual(s.streak, 0, 'a move without a clear ends the streak');
});

test('the all-clear bonus and the goal: emptying the board gives +100, reaching the goal wins, and no piece that fits ends the game with a best score kept', () => {
  const K = fresh(); const s = K.kit.run(spec({ difficulty: 1, goal: 5000 })); s.start(); empty(s);
  s.board[7] = [1, 1, 1, 1, 1, 1, 1, 0]; s.pieces = [piece([[0, 0]]), piece([[0, 0]]), piece([[0, 0]])]; const b = s.score; s.place(0, 7, 7); run(s, 0.6); assert.ok(s.score - b >= 100, 'a clear board pays: ' + (s.score - b));
  const w = K.kit.run(spec({ goal: 20, difficulty: 1 })); w.start(); empty(w); w.board[7] = [1, 1, 1, 1, 1, 1, 1, 0]; w.pieces = [piece([[0, 0]]), piece([[0, 0]]), piece([[0, 0]])]; w.place(0, 7, 7); run(w, 0.6); assert.strictEqual(w.over, true); assert.strictEqual(w.won, true, 'the goal is reached');
  const l = K.kit.run(spec({ difficulty: 1 })); l.start(); l.board.forEach((r, y) => r.forEach((v, x) => { l.board[y][x] = (x + y) % 2 ? 1 : 0; })); l.pieces = [piece([[0, 0], [1, 0]]), piece([[0, 0], [0, 1]]), piece([[0, 0], [0, 1]])];
  assert.strictEqual(l.place(0, 99, 99), false); l.pieces[2] = piece([[0, 0]]); l.board[0][0] = 0; l.score = 77; assert.strictEqual(l.place(2, 0, 0), true); run(l, 0.2); assert.strictEqual(l.over, true); assert.strictEqual(l.won, false, 'nothing fits any more'); assert.ok(l.best >= 77, 'the best score is kept');
  K.press('r'); run(l, 0.1); K.press('r', false); run(l, 0.1); assert.strictEqual(l.over, false); assert.strictEqual(l.score, 0); assert.ok(l.best >= 77);
});

test('undo, hint and bomb are features: undo takes the last move back three times, the hint shows a place that fits, and a bomb clears a 3x3 area', () => {
  const K = fresh(); const s = K.kit.run(spec({ features: ['undo', 'hint', 'bomb'], difficulty: 1 })); s.start(); empty(s); s.pieces = [piece([[0, 0], [1, 0]]), piece([[0, 0]]), piece([[0, 0]])];
  s.place(0, 2, 2); assert.ok(s.board[2][2] > 0); assert.strictEqual(s.undo(), true); assert.strictEqual(s.board[2][2], 0, 'the move is back'); assert.ok(s.pieces[0], 'with its piece'); assert.strictEqual(s.undoLeft, 2); assert.strictEqual(s.undo(), false, 'one undo per move');
  const h = s.findHint(); assert.ok(h && s.canPlace(s.pieces[h.slot], h.x, h.y), 'the hint is a place that fits'); run(s, 9); assert.ok(s.hint, 'it shows itself after a wait');
  empty(s); for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) s.board[y][x] = 3; s.board[6][6] = 3; s.pieces = [{ cells: [[0, 0]], color: [255, 255, 255], bomb: true, w: 1, h: 1 }, piece([[0, 0]]), piece([[0, 0]])]; s.board[3][3] = 0; s.place(0, 3, 3); run(s, 0.2);
  assert.ok(s.board[2][2] === 0 && s.board[4][4] === 0 && s.board[3][2] === 0, 'the bomb cleared its neighbours'); assert.ok(s.board[6][6] > 0, 'and nothing further');
  const plain = K.kit.run(spec({ features: [] })); plain.start(); assert.strictEqual(plain.undo(), false, 'no undo without the feature'); assert.strictEqual(plain.findHint() !== null, true); assert.strictEqual(plain.hint, null);
});

test('the controls: the mouse takes a piece from the tray and drops it on the board (or back), and the keyboard moves a cursor, chooses a piece and places it', () => {
  const K = fresh(); const s = K.kit.run(spec({ difficulty: 1 })); s.start(); empty(s); s.pieces = [piece([[0, 0], [1, 0]]), piece([[0, 0]]), piece([[0, 0], [0, 1]])];
  assert.strictEqual(s.mouseDown(20, 160), true); assert.strictEqual(s.drag.slot, 0); s.mouseMove(160, 70); assert.strictEqual(s.mouseUp(160, 70), true); assert.ok(s.board.some((r) => r.some(Boolean)), 'dropped on the board'); assert.strictEqual(s.pieces[0], null);
  assert.strictEqual(s.mouseDown(120, 160), true); assert.strictEqual(s.mouseUp(120, 180), false, 'dropped back on the tray'); assert.ok(s.pieces[1], 'it stays in its place'); assert.strictEqual(s.mouseDown(20, 160), false, 'an empty slot cannot be taken');
  s.cx = 0; s.cy = 7; tapKey(K, s, '2'); assert.strictEqual(s.sel, 1); tapKey(K, s, ' '); assert.ok(s.board[7][0] > 0, 'placed by the keys'); tapKey(K, s, 'ArrowRight'); assert.strictEqual(s.cx, 1);
});

test('the blast tune: written for the kit, a lead and a bass of the same length, played by default', () => {
  const K = fresh(); const t = K.music.tracks.blast; assert.ok(t, 'the blast tune exists'); assert.ok(t.bpm >= 100 && t.bass && t.loop);
  const beats = (notes) => notes.reduce((a, n) => a + n.beats, 0); assert.strictEqual(beats(t.notes), beats(t.bass), 'lead and bass stay together');
  assert.ok(t.notes.every((n) => n.freq === 0 || n.freq > 100), 'every note was understood'); assert.strictEqual(K.kit.run(spec()).spec.music, 'blast');
});

test('the blast menus: a main menu first (the game waits), Esc pauses, the pause menu restarts or goes back, and the controls page shows', () => {
  const K = fresh(); K.blast.menuAtStart = true; const s = K.kit.run(spec()); s.start();
  assert.strictEqual(s.menu.open, true); const t0 = s.time; run(s, 2); assert.strictEqual(s.time, t0, 'waits behind the menu');
  K.press('Enter'); run(s, 0.1); K.press('Enter', false); run(s, 0.1); assert.strictEqual(s.menu.open, false);
  K.press('Escape'); run(s, 0.1); K.press('Escape', false); run(s, 0.1); assert.strictEqual(s.menu.kind, 'pause');
  assert.deepStrictEqual(s.menuItems().map((i) => i.label), ['Devam et', 'Kontroller', 'Müzik: açık', 'Baştan başla', 'Ana menü']);
  s.menuItems()[1].act(); assert.strictEqual(s.menu.kind, 'controls'); K.press('Escape'); run(s, 0.1); K.press('Escape', false); run(s, 0.1); assert.strictEqual(s.menu.kind, 'pause');
  s.menuItems()[4].act(); assert.strictEqual(s.menu.kind, 'main'); assert.strictEqual(s.menuItems()[0].label, 'Devam et');
});
