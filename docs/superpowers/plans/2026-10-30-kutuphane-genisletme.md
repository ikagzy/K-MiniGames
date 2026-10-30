# Kütüphane genişletme: 51 modül (dalgalar)

Kullanıcı onayı: 2026-10-30 ("tamam bunları ekle"). Üst tasarım: `docs/superpowers/specs/2026-10-30-oyun-kutuphanesi-design.md`; ilk plan: `2026-10-30-oyun-kutuphanesi.md` (bitti). Her modül: `assets/lib/kgame.<ad>.js` + `<ad>.guide.md` (≤1500 token) + Node testi + kayıt (`kgamelib.MODULES`, `summary` ile Don'un istemine girer). Yalnızca **uygulanmış** modüller kayda girer (Don başka modül seçemez).

## Dalgalar ve durum
| Dalga | Modüller | Durum |
|---|---|---|
| 1 (Mario yolu) | sprites, animation, camera2, themes, levels, hud, audio2, input2, progress(save2), items, enemies, platformer, kits | yapılıyor |
| 2 | particles2, physics2, combat, ui-kit, dialogue, lighting2d, weather, postfx, minimap | bekliyor |
| 3 | topdown, shooter, puzzle, racing, fighting, towerdefense, procgen, idle, cards, boards, rhythm, stealth, survival, sim, strategy, quests, economy, narrative | bekliyor |
| 4 | editor, replay, local-multi, accessibility, physics-sandbox, pathfinding2, testbot, assets | bekliyor |
| 5 | 3d (three.js sarmalayıcı), voxel, fps | bekliyor |

## Tasarım kuralları (hepsi için)
- Çekirdek (`kgame.js`) yalnızca küçük kancalar alır: `g.layers` (paralaks), `g.cameraBounds`, `g.fade`, `texture.draw`/`e.flip`, `K.sfxTable`. Modüller çekirdeğe bağlıdır, DOM'suz (Node) yüklenebilir.
- Her modül bir kit gibi **tek çağrıyla** işe yarar (model parça parça kurmasın), ama parçalar tek tek de kullanılabilir.
- Tür kitleri (`K.kit.*`) seviye ve kuralları ister; fizik, kamera, grafik, ses, arayüz hazır gelir.
- Kılavuz bütçeleri `tests/test_guides.py` ile korunur; kılavuzdaki her ad kütüphanede olmalı.
- Her dalga sonunda: tam test, gerçek tarayıcı yoklaması (örnek oyun), commit, CP kaydı, devir notu.
