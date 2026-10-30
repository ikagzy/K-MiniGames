# kgame.kits.js: kit kayıt sistemi
Bir KİT, bir oyun türünün hazır iskeletidir. Oyunu kod olarak değil ÖZET olarak yaz: `K.kit.run({ kit: 'ad', ... })`.
- `K.kit.list()` kitleri, `K.feature.list('ad')` o kite takılan özellikleri verir. `K.kit.check(ozet)` özetteki hataları listeler (boşsa çalışır).
- Özelliği özetin `features` listesine yaz: `features: ['doubleJump']` ya da ayarlı `features: [{ name: 'doubleJump', jumps: 2 }]`.
- Yeni kit/özellik eklemek için: `K.kit.define(ad, {defaults, build})`, `K.feature.define(ad, {kits, options, apply})`.
