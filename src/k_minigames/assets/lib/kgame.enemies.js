/* kgame.enemies.js: düşman türleri (hepsi etiket 'enemy'). K.enemies.walker(g,x,y,{speed, map}) duvarda ve platform kenarında
   döner; K.enemies.flyer(g,x,y,{amp, speed}) havada dalgalanır; K.enemies.piranha(g,x,y,{rise, period}) borudan çıkar ve alçalır
   (ezilemez, stompable:false). K.enemies.stomp(g, düşman) ezer (etiket 'squashed', kısa süre sonra kaybolur). Yürüyen düşmanın
   duvara çarpıp dönmesi için her karede g.collideTiles(e, map) çağrılmalı (platform kiti bunu yapar). Önce kgame.js,
   kgame.sprites.js ve kgame.animation.js yüklenmiş olmalı. */
(function (root) {
  var K = root.K;
  var E = K.enemies = {};

  E.walker = function (g, x, y, o) {
    o = o || {};
    var speed = o.speed || 40, map = o.map;
    var e = g.add({ shape: "rect", x: x + 2, y: y + 4, w: 28, h: 28, tag: "enemy", color: "#7a4a21", gravity: true, collides: true, vx: -speed });
    e.kind = "walker";
    e.stompable = true;
    e.dir = -1;
    K.anim.attach(e, { sprites: { idle: ["walker.1", "walker.2"], run: ["walker.1", "walker.2"] }, fps: { idle: 4, run: 4 } });
    var previous = e.onUpdate;
    e.onUpdate = function (self, dt) {
      if (self.tag !== "enemy") return;
      if (self.vx === 0) self.dir = -self.dir;   // it hit a wall (the tile collision stopped it)
      if (map && self.onFloor && !map.solidAt(self.cx + self.dir * (self.w / 2 + 3), self.bottom + 3)) self.dir = -self.dir;   // the end of the platform
      self.vx = self.dir * speed;
      if (previous) previous(self, dt);
    };
    return e;
  };

  E.flyer = function (g, x, y, o) {
    o = o || {};
    var amp = o.amp || 30, speed = o.speed || 1.5, t = 0, baseY = y;
    var e = g.add({ shape: "rect", x: x, y: y, w: 28, h: 22, tag: "enemy", color: "#a45bd6", vx: -(o.drift || 0) });
    e.kind = "flyer";
    e.stompable = true;
    e.onUpdate = function (self, dt) { t += dt; self.y = baseY + Math.sin(t * speed * 2) * amp; };
    return e;
  };

  E.piranha = function (g, x, y, o) {
    o = o || {};
    var rise = o.rise || 32, period = o.period || 3, t = 0, baseY = y;
    var e = g.add({ shape: "rect", x: x, y: y, w: 24, h: 30, tag: "enemy", color: "#d32f2f" });
    e.kind = "piranha";
    e.stompable = false;
    e.onUpdate = function (self, dt) { t += dt; self.y = baseY - (Math.sin(t * Math.PI * 2 / period) * 0.5 + 0.5) * rise; };
    return e;
  };

  E.stomp = function (g, e) {
    e.tag = "squashed";
    e.vx = 0; e.vy = 0;
    e.collides = false;
    e.gravity = false;
    e.texture = K.sprites.get("walker.flat");
    e.onUpdate = null;
    e.y += e.h * 0.5; e.h = e.h * 0.5;
    K.sfx("stomp");
    K.timer.after(400, function () { e.dead = true; });
  };

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
