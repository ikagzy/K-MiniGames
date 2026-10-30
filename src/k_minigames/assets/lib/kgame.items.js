/* kgame.items.js: toplanabilirler ve bloklar. K.items.coin(g,x,y) (etiket 'coin'), K.items.qblock(g,x,y,{contains:'coin'|'mushroom'|
   'star'}) (etiket 'qblock'), K.items.brick(g,x,y) ('brick'), K.items.powerup(g,'mushroom'|'star',x,y) ('powerup').
   K.items.bump(g, blok, {big, onCoin}) bir bloğa aşağıdan vurulunca çağrılır: soru bloğu içindekini verir, tuğla küçük kahramanda
   zıplar ('bounce'), büyükte kırılır ('break'). Önce kgame.js, kgame.sprites.js ve kgame.animation.js yüklenmiş olmalı. */
(function (root) {
  var K = root.K;
  var I = K.items = {};
  var TILE = 32;

  I.coin = function (g, x, y) {
    var e = g.add({ shape: "rect", x: x + 8, y: y + 6, w: 16, h: 20, tag: "coin", color: "#ffd23f" });
    K.anim.attach(e, { sprites: { idle: ["coin.1", "coin.2", "coin.3", "coin.4"] }, fps: { idle: 8 } });
    e.texture = K.sprites.get("coin.1");
    return e;
  };

  I.qblock = function (g, x, y, o) {
    var e = g.add({ shape: "rect", x: x, y: y, w: TILE, h: TILE, tag: "qblock", color: "#e0a800", texture: K.sprites.get("qblock") });
    e.contains = (o && o.contains) || "coin";
    e.used = false;
    return e;
  };

  I.brick = function (g, x, y) {
    return g.add({ shape: "rect", x: x, y: y, w: TILE, h: TILE, tag: "brick", color: "#b5651d", texture: K.sprites.get("brick") });
  };

  I.powerup = function (g, kind, x, y) {
    var e = g.add({ shape: "rect", x: x + 4, y: y, w: 24, h: 24, tag: "powerup", color: kind === "star" ? "#ffd23f" : "#e53935",
                    texture: K.sprites.get(kind), gravity: true, collides: true, bounce: kind === "star" ? 1 : 0, vx: 70 });
    e.kind = kind;
    return e;
  };

  var popCoin = function (g, block, o) {
    var c = g.add({ shape: "rect", x: block.x + 8, y: block.y - 24, w: 16, h: 20, color: "#ffd23f", gravity: false, vy: -260, life: 500,
                    texture: K.sprites.get("coin.2"), tag: "popcoin" });
    K.sfx("coin");
    if (o && o.onCoin) o.onCoin();
    return c;
  };

  I.bump = function (g, block, o) {
    o = o || {};
    if (block.tag === "qblock") {
      if (block.used) return null;
      block.used = true;
      block.texture = K.sprites.get("qblock.used");
      K.sfx("bump");
      var what = block.contains;
      if (what === "coin") popCoin(g, block, o);
      else { var p = I.powerup(g, what, block.x, block.y - TILE); p.vy = -120; K.sfx("powerup"); }
      return what;
    }
    if (block.tag === "brick") {
      if (o.big) {
        block.dead = true;
        K.sfx("break");
        K.particles.burst(g, block.x + TILE / 2, block.y + TILE / 2, { count: 8, color: "#b5651d", speed: 160, life: 600 });
        return "break";
      }
      K.sfx("bump");
      var y0 = block.y;
      block.y = y0 - 6;
      K.timer.after(90, function () { block.y = y0; });
      return "bounce";
    }
    return null;
  };

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
