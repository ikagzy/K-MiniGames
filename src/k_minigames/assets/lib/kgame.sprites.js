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

  // ---- hero (red cap, blue overalls) ----
  S.define("hero.idle", ["...rrrr...", "..rrrrrrr.", "..nnsssns.", ".nsnsssnss", ".nsnnsssns", "..nssssnn.", "...sssss..",
    "..rrbrrr..", ".rrrbrbrrr", "rrrrbbbbrr", "ss.bybyb.s", "ss.bbbbb.s", "..bbb.bbb.", ".nnn...nnn"]);
  S.define("hero.run1", ["...rrrr...", "..rrrrrrr.", "..nnsssns.", ".nsnsssnss", ".nsnnsssns", "..nssssnn.", "...sssss..",
    ".rrrbrrr..", "rrrrbrbrr.", "ss.bbbbbbs", "s..bybybbs", "...bbbbb..", "..nnb.bbn.", "..nnn..nnn"]);
  S.define("hero.run2", ["...rrrr...", "..rrrrrrr.", "..nnsssns.", ".nsnsssnss", ".nsnnsssns", "..nssssnn.", "...sssss..",
    "..rrbrrr..", ".rrrbrbrrr", "rrrrbbbbrr", "ss.bybyb.s", "ss.bbbbb.s", "...bb.bbb.", "...nn.nnn."]);
  S.define("hero.jump", ["s.rrrr..ss", "ss.rrrrrrss", "..nnsssns.", ".nsnsssnss", ".nsnnsssns", "..nssssnn.", "...sssss..",
    "..rrbrrr..", ".rrrbrbrrr", "rrrrbbbbrr", "..bbybybb.", "..bbbbbbb.", ".bbb...bbb", ".nnn...nnn"]);
  S.define("hero.die", ["..........", "...rrrr...", "..rrrrrrr.", "..nnsssns.", ".nsnkskns.", "..nssssnn.", "..sskkkss.", "s.rrbrrr.s", "ssrrbrbrrs",
    "rrrrbbbbrr", "..bbybyb..", "..bbbbbb..", ".bbb..bbb.", ".nnn..nnn."]);

  // ---- walking enemy (brown) ----
  S.define("walker.1", ["...dddd...", "..dddddd..", ".dddddddd.", ".dwkddkwd.", ".dwkddkwd.", "dddddddddd", ".ddsssssd.", "..sssssss.", "..nnn.nnn.", ".nnn...nnn"]);
  S.define("walker.2", ["...dddd...", "..dddddd..", ".dddddddd.", ".dwkddkwd.", ".dwkddkwd.", "dddddddddd", ".ddsssssd.", "..sssssss.", "...nn.nn..", "..nnn.nnn."]);
  S.define("walker.flat", ["..........", "..........", "..........", "..........", "..........", "..........", "..dddddd..", ".dwkddkwd.", "dddddddddd", ".nnn..nnn."]);

  // ---- items ----
  S.define("coin.1", ["...yy...", "..yYYy..", ".yYyyYy.", ".yYyyYy.", ".yYyyYy.", ".yYyyYy.", "..yYYy..", "...yy..."]);
  S.define("coin.2", ["...yy...", "..yYy...", "..yYy...", "..yYy...", "..yYy...", "..yYy...", "..yYy...", "...yy..."]);
  S.define("coin.3", ["...yy...", "...yy...", "...yy...", "...yy...", "...yy...", "...yy...", "...yy...", "...yy..."]);
  S.define("coin.4", S.get("coin.2").rows.slice());
  S.define("mushroom", ["...rrrr...", "..rrwwrrr.", ".rrwwwwrrr", "rrrwwwwrrr", "rrrrrrrrrr", "..eeeeee..", "..eekkee..", "..eeeeee..", "...eeee..."]);
  S.define("star", ["....yy....", "....yy....", "...yyyy...", "yyyyyyyyyy", ".yyYyyYyy.", "..yyyyyy..", "..yyyyyy..", ".yyy..yyy.", ".yy....yy."]);
  S.define("heart", [".mm..mm.", "mmmmmmmm", "mmmmmmmm", "mmmmmmmm", ".mmmmmm.", "..mmmm..", "...mm..."]);
  S.define("spike", ["....l....", "...lLl...", "...lLl...", "..lLLLl..", "..lLLLl..", ".lLLLLLl.", ".lLLLLLl.", "lLLLLLLLl"]);

  // ---- tiles ----
  S.define("brick", ["cccccccccccccccc", "cCcccccCcccccccC", "CCCCCCCCCCCCCCCC", "cccCcccccccCcccc", "cccCcccccccCcccc", "CCCCCCCCCCCCCCCC",
    "cCcccccCcccccccC", "cCcccccCcccccccC"].concat(["CCCCCCCCCCCCCCCC", "cccCcccccccCcccc", "cccCcccccccCcccc", "CCCCCCCCCCCCCCCC", "cCcccccCcccccccC",
    "cCcccccCcccccccC", "CCCCCCCCCCCCCCCC", "cccCcccccccCcccc"]));
  S.define("qblock", ["YYYYYYYYYYYYYYYY", "Yyyyyyyyyyyyyyyk", "YyYyyyyyyyyyyYyk", "YyyyykkkkkkyyyYk", "YyyyykyyyykyyyYk", "YyyyykyyyykyyyYk",
    "YyyyyyyyykkyyyYk", "YyyyyyyykkyyyyYk", "YyyyyyyykyyyyyYk", "YyyyyyyykyyyyyYk", "YyyyyyyyyyyyyyYk", "YyyyyyyykyyyyyYk", "YyYyyyyykyyyyYYk",
    "Yyyyyyyyyyyyyyyk", "YkkkkkkkkkkkkkkY", "YYYYYYYYYYYYYYYY"]);
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
    "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG.."]);
  S.define("pipe.body", ["..GgggggggggG...", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..",
    "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..", "..GgGggggggggG..",
    "..GgGggggggggG.."]);

  // ---- scenery and goal ----
  S.define("cloud", ["....www.....", "..wwwwwww...", ".wwwwwwwwww.", "wwwwwwwwwwww", ".wwwwwwwwww."]);
  S.define("pole", ["lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL", "lL"]);
  S.define("flag", ["gggg....", "ggggg...", "gggggg..", "ggggggg.", "gggggg..", "ggggg...", "gggg....", "gg......"]);
})(globalThis);
if (typeof module !== "undefined" && module && module.exports) module.exports = globalThis.K;
