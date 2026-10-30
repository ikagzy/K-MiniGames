/* kgame.kits.js: oyun kitleri ve özellikler için kayıt sistemi.
   Bir KİT, bir oyun türünün tam iskeletidir (platformer, nişancı, bulmaca...). Model oyunu kod olarak değil, bir ÖZET (spec)
   olarak yazar: K.kit.run({ kit:'platformer', theme:'sky', levels:[[...]], features:['doubleJump'] }).
   Yeni kit: K.kit.define(ad, {defaults, build(spec) -> durum {g, ...}}).
   Yeni ÖZELLİK (kite takılan küçük parça): K.feature.define(ad, {kits:['platformer'], options:{...}, apply(durum, ayarlar)}).
   Özet geçerli mi: K.kit.check(spec) -> hata listesi. Önce kgame.js yüklenmiş olmalı. */
(function (root) {
  var K = root.K;
  var kits = {}, features = {};
  K.kit = {};
  K.feature = {};

  function merge(base, extra) {
    if (Array.isArray(extra) || extra === null || typeof extra !== "object") return extra === undefined ? base : extra;
    var out = {};
    var b = base && typeof base === "object" && !Array.isArray(base) ? base : {};
    for (var k in b) out[k] = b[k];
    for (var j in extra) out[j] = merge(b[j], extra[j]);
    return out;
  }

  K.kit.define = function (name, def) { kits[name] = def; };
  K.kit.list = function () { return Object.keys(kits); };
  K.kit.defaults = function (name) { return kits[name] ? merge({}, kits[name].defaults || {}) : null; };
  K.feature.define = function (name, def) { features[name] = def; };
  K.feature.list = function (kit) { return Object.keys(features).filter(function (n) { return !kit || (features[n].kits || []).indexOf(kit) >= 0; }); };

  function featureEntries(spec) {
    return (spec.features || []).map(function (f) { return typeof f === "string" ? { name: f } : f; });
  }

  // A list of what is wrong with a spec (an empty list: it can run).
  K.kit.check = function (spec) {
    var errors = [];
    if (!spec || typeof spec !== "object") return ["özet bir nesne olmalı"];
    if (!kits[spec.kit]) return ["bilinmeyen kit: " + spec.kit + " (var olanlar: " + K.kit.list().join(", ") + ")"];
    featureEntries(spec).forEach(function (f) {
      var def = features[f.name];
      if (!def) errors.push("bilinmeyen özellik: " + f.name + " (bu kit için: " + K.feature.list(spec.kit).join(", ") + ")");
      else if ((def.kits || []).indexOf(spec.kit) < 0) errors.push("'" + f.name + "' özelliği " + spec.kit + " kitine takılmaz");
    });
    if (kits[spec.kit].check) errors = errors.concat(kits[spec.kit].check(merge(K.kit.defaults(spec.kit), spec)));
    return errors;
  };

  K.kit.run = function (spec) {
    var errors = K.kit.check(spec);
    if (errors.length) throw new Error("oyun özeti geçersiz: " + errors.join("; "));
    var kit = kits[spec.kit], full = merge(kit.defaults || {}, spec);
    var state = kit.build(full);
    featureEntries(full).forEach(function (f) {
      var def = features[f.name];
      def.apply(state, merge(def.options || {}, f));
    });
    if (state.start) state.start();
    K.expose(state.expose || state);
    state.g.run();
    return state;
  };

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
