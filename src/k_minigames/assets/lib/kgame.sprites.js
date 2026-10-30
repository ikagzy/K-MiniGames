/* kgame.sprites.js: kodla çizilen piksel sanat (resim dosyası gerekmez). Her sprite satırlardan oluşur; her harf paletteki bir
   renk, '.' saydam. Çizim `sprite.draw(ctx, x, y, w, h, flip)` ile yapılır; bir varlığa `texture: K.sprites.get('hero.idle')`
   verilir. Yeni sprite: K.sprites.define(ad, satirlar, palet?). Önce kgame.js yüklenmiş olmalı. */
(function (root) {
  var K = root.K;
  var hasDom = typeof document !== "undefined";
  var S = K.sprites = {};

  S.palette = {
    k: "#1a1a1a", w: "#ffffff", r: "#d32f2f", R: "#8e1b1b", b: "#1e5bd8", B: "#133b8f", s: "#f2b88c", n: "#7a4a21",
    y: "#ffd23f", Y: "#d99a00", o: "#f28c28", g: "#3aa655", G: "#1f6b36", p: "#a45bd6", l: "#c9c9c9", L: "#8a8a8a",
    d: "#5c3a1e", c: "#b5651d", C: "#7a4519", f: "#7dd3fc", e: "#e8d9b0", m: "#e53935"
  };

  var art = {};
  var cache = {};

  function pad(rows) {
    var width = 0;
    rows.forEach(function (r) { width = Math.max(width, r.length); });
    return rows.map(function (r) { while (r.length < width) r += "."; return r; });
  }

  S.define = function (name, rows, palette) {
    art[name] = { rows: pad(rows), palette: palette || null };
    delete cache[name];
  };
  S.has = function (name) { return !!art[name]; };
  S.names = function () { return Object.keys(art); };

  S.get = function (name) {
    if (cache[name]) return cache[name];
    var def = art[name];
    if (!def) throw new Error("sprite yok: " + name);
    var pal = {};
    for (var k in S.palette) pal[k] = S.palette[k];
    if (def.palette) for (var j in def.palette) pal[j] = def.palette[j];
    var w = def.rows[0].length, h = def.rows.length, canvas = null;
    if (hasDom) {
      canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      var x = canvas.getContext("2d");
      def.rows.forEach(function (row, ry) {
        for (var rx = 0; rx < w; rx++) {
          var color = pal[row.charAt(rx)];
          if (color) { x.fillStyle = color; x.fillRect(rx, ry, 1, 1); }
        }
      });
    }
    var sprite = {
      name: name, w: w, h: h, rows: def.rows, canvas: canvas,
      draw: function (ctx, px, py, pw, ph, flip) {
        if (!canvas || !ctx.drawImage) return;
        ctx.imageSmoothingEnabled = false;
        if (flip) { ctx.save(); ctx.translate(px + pw, py); ctx.scale(-1, 1); ctx.drawImage(canvas, 0, 0, pw, ph); ctx.restore(); }
        else ctx.drawImage(canvas, px, py, pw, ph);
      }
    };
    cache[name] = sprite;
    return sprite;
  };


  // ---- hero (an original explorer: purple hood and tunic, yellow belt) ----
  S.define("hero.idle", ["...gggg...", "..gggggg..", ".gGggggGg.", ".gssssssg.", ".gskssksg.", "..ssssss..", "...ssss...", "..GGggGG..",
    ".Gggggggg.", "ssgyyyygss", "..gggggg..", "..dd..dd..", ".ddd..ddd.", ".nnn..nnn."]);
  S.define("hero.run1", ["...gggg...", "..gggggg..", ".gGggggGg.", ".gssssssg.", ".gskssksg.", "..ssssss..", "...ssss...", ".GGggggG..",
    "sGggggggs.", "s.gyyyyg..", "..gggggg..", ".dd....dd.", ".dd.....dd", ".nn......n"]);
  S.define("hero.run2", ["...gggg...", "..gggggg..", ".gGggggGg.", ".gssssssg.", ".gskssksg.", "..ssssss..", "...ssss...", "..GGggGG..",
    ".Gggggggg.", "..gyyyygss", "..gggggg..", "...dd.dd..", "...dd.dd..", "..nnn.nnn."]);
  S.define("hero.jump", ["...gggg...", "..gggggg..", ".gGggggGg.", ".gssssssg.", ".gskssksg.", "..ssssss..", "...ssss...", "s.GGggGG.s",
    "ssGggggggs", "..gyyyyg..", "..gggggg..", ".dd....dd.", ".dd....dd.", ".nn....nn."]);
  S.define("hero.die", ["...gggg...", "..gggggg..", ".gGggggGg.", ".gssssssg.", ".gkskkskg.", "..ssssss..", "...ssss...", "s.GGggGG.s",
    "ssGggggggs", "..gyyyyg..", "..gggggg..", ".dd....dd.", ".dd....dd.", ".........."]);

  ["idle", "run1", "run2", "jump", "die"].forEach(function (n) { art["hero." + n].palette = { g: "#7a56d6", G: "#4b348f" }; });

  // ---- runner (an original fast hero: orange fox, purple scarf, yellow boots) ----
  S.define("runner.idle", ["..o....o..", ".ooo..ooo.", ".oooooooo.", ".owkoowko.", ".oooeeooo.", "..oeekeeo.", "...pppp...", "..opppp.o.",
    ".ooeeeeoo.", ".ooeeeeoo.", "..oooooo..", "..oo..oo..", "..yy..yy..", ".yyy..yyy."]);
  S.define("runner.run1", ["..o....o..", ".ooo..ooo.", ".oooooooo.", ".owkoowko.", ".oooeeooo.", "..oeekeeo.", "...pppp...", "..opppppo.",
    "ooeeeeeoo.", "o.eeeeeo..", "..ooooo...", ".oo...oo..", "yy.....yy.", "yy......yy"]);
  S.define("runner.run2", ["..o....o..", ".ooo..ooo.", ".oooooooo.", ".owkoowko.", ".oooeeooo.", "..oeekeeo.", "...pppp...", ".opppppo..",
    ".ooeeeeoo.", "..eeeeeoo.", "..ooooo...", "..oo.oo...", "..yy..yy..", "..yyy.yyy."]);
  S.define("runner.jump", ["..o....o..", ".ooo..ooo.", ".oooooooo.", ".owkoowko.", ".oooeeooo.", "..oeekeeo.", "...pppp...", "o.opppp.o.",
    "oooeeeeooo", "oo.eeee.oo", "..oooooo..", ".yy....yy.", ".yy....yy.", ".........."]);
  S.define("runner.die", ["..o....o..", ".ooo..ooo.", ".oooooooo.", ".okkookko.", ".oooeeooo.", "..oeekeeo.", "...pppp...", "o.opppp.o.",
    "oooeeeeooo", "..oeeeeo..", "..oooooo..", ".yy....yy.", ".yy....yy.", ".........."]);


  // ---- walking enemy (an original blue slime) ----
  S.define("walker.1", ["..........", "...bbbb...", "..bbffbb..", ".bbfbbbbb.", ".bwkbbwkb.", "bbbbbbbbbb", "bbbbbbbbbb", "BBBBBBBBBB", ".BB....BB.", ".BB....BB."]);
  S.define("walker.2", ["..........", "...bbbb...", "..bbffbb..", ".bbfbbbbb.", ".bwkbbwkb.", "bbbbbbbbbb", "bbbbbbbbbb", "BBBBBBBBBB", "..BB..BB..", "..BB..BB.."]);
  S.define("walker.flat", ["..........", "..........", "..........", "..........", "..........", "..........", "...bbbb...", ".bwkbbwkb.", "bbbbbbbbbb", "BBBBBBBBBB"]);

  // ---- power-up (an original blue potion) ----
  S.define("mushroom", ["....ll....", "...llll...", "....bb....", "...bbbb...", "..bbffbb..", ".bbffffbb.", ".bbfffbbb.", ".bbbbbbbb.", "..bbbbbb..", "...bbbb..."]);

  // ---- items ----
  S.define("coin.1", ["...yy...", "..yYYy..", ".yYyyYy.", ".yYyyYy.", ".yYyyYy.", ".yYyyYy.", "..yYYy..", "...yy..."]);
  S.define("coin.2", ["...yy...", "..yYy...", "..yYy...", "..yYy...", "..yYy...", "..yYy...", "..yYy...", "...yy..."]);
  S.define("coin.3", ["...yy...", "...yy...", "...yy...", "...yy...", "...yy...", "...yy...", "...yy...", "...yy..."]);
  S.define("coin.4", S.get("coin.2").rows.slice());
  S.define("star", ["....yy....", "....yy....", "...yyyy...", "yyyyyyyyyy", ".yyYyyYyy.", "..yyyyyy..", "..yyyyyy..", ".yyy..yyy.", ".yy....yy."]);
  S.define("heart", [".mm..mm.", "mmmmmmmm", "mmmmmmmm", "mmmmmmmm", ".mmmmmm.", "..mmmm..", "...mm..."]);
  S.define("spike", ["....l....", "...lLl...", "...lLl...", "..lLLLl..", "..lLLLl..", ".lLLLLLl.", ".lLLLLLl.", "lLLLLLLLl"]);

  // ---- tiles ----
  S.define("brick", ["cccccccccccccccc", "cCcccccCcccccccC", "CCCCCCCCCCCCCCCC", "cccCcccccccCcccc", "cccCcccccccCcccc", "CCCCCCCCCCCCCCCC",
    "cCcccccCcccccccC", "cCcccccCcccccccC"].concat(["CCCCCCCCCCCCCCCC", "cccCcccccccCcccc", "cccCcccccccCcccc", "CCCCCCCCCCCCCCCC", "cCcccccCcccccccC",
    "cCcccccCcccccccC", "CCCCCCCCCCCCCCCC", "cccCcccccccCcccc"]));
  // ---- gem block (the question block) ----
  (function () {
    var rows = [], plain = "p".repeat(14);
    var gem = [2, 4, 6, 8, 6, 4, 2];
    rows.push("B".repeat(16));
    for (var r = 1; r < 15; r++) {
      var w = gem[r - 3], inner = plain;
      if (w) inner = "p".repeat((14 - w) / 2) + "w" + "f".repeat(w - 2) + "w" + "p".repeat((14 - w) / 2);
      rows.push("B" + inner + "B");
    }
    rows.push("B".repeat(16));
    S.define("qblock", rows);
  })();
  S.define("qblock.used", ["LLLLLLLLLLLLLLLL", "LdddddddddddddLk", "LdLdddddddddLdLk", "LddddddddddddddLk", "LddddddddddddddLk", "LddddddddddddddLk",
    "LddddddddddddddLk", "LddddddddddddddLk", "LddddddddddddddLk", "LddddddddddddddLk", "LddddddddddddddLk", "LddddddddddddddLk", "LdLdddddddddLdLk",
    "LdddddddddddddLk", "LkkkkkkkkkkkkkkL", "LLLLLLLLLLLLLLLL"]);
  S.define("ground", ["nnnnnnnnnnnnnnnn", "ndnnnnnnndnnnnnn", "nnnnnnnnnnnnnnnn", "nnnnndnnnnnnnnnd", "nnnnnnnnnnnnnnnn", "dnnnnnnnnnndnnnn",
    "nnnnnnnnnnnnnnnn", "nnnndnnnnnnnnnnn", "nnnnnnnnnnnnnnnn", "nndnnnnnnndnnnnn", "nnnnnnnnnnnnnnnn", "nnnnnnnndnnnnnnn", "nnnnnnnnnnnnnnnn",
    "ndnnnnnnnnnnnnnd", "nnnnnnnnnnnnnnnn", "nnnndnnnnnnnnnnn"]);
  S.define("grass", ["gggggggggggggggg", "gGgggGgggGggggGg", "GGGGGGGGGGGGGGGG", "nnnnnnnnnnnnnnnn", "ndnnnnnnndnnnnnn", "nnnnnnnnnnnnnnnn",
    "nnnnndnnnnnnnnnd", "nnnnnnnnnnnnnnnn", "dnnnnnnnnnndnnnn", "nnnnnnnnnnnnnnnn", "nnnndnnnnnnnnnnn", "nnnnnnnnnnnnnnnn", "nndnnnnnnndnnnnn",
    "nnnnnnnnnnnnnnnn", "nnnnnnnndnnnnnnn", "nnnnnnnnnnnnnnnn"]);
  S.define("pipe.top", ["GGGGGGGGGGGGGGGG", "GgggggggggggggGk", "GgGGggggggggggGk", "GgGGggggggggggGk", "GgggggggggggggGk", "GGGGGGGGGGGGGGGG",
    "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..",
    "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG.."], { g: "#9aa7b8", G: "#4d5868" });
  S.define("pipe.body", ["..GgggggggggG...", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..",
    "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..",
    "..GgGggggggggG.."], { g: "#9aa7b8", G: "#4d5868" });

  // ---- scenery and goal ----
  S.define("cloud", ["....www.....", "..wwwwwww...", ".wwwwwwwwww.", "wwwwwwwwwwww", ".wwwwwwwwww."]);
  S.define("pole", ["lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL"]);
  S.define("flag", ["gggg....", "ggggg...", "gggggg..", "ggggggg.", "gggggg..", "ggggg...", "gggg....", "gg......"]);
})(globalThis);
if (typeof module !== "undefined" && module && module.exports) module.exports = globalThis.K;
