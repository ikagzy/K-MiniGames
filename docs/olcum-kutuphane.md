
## 2026-10-30 10:31 — qwen2.5-coder:14b, tarif: volleyball

| yöntem | geçti | doğrulanamadı | kaldı | düzeltme | JS hatası | sorunlar | süre (sn) |
|---|---|---|---|---|---|---|---|
| old | 0 | 5 | 0 | 1 | 0 | - | 458 |
| new | 1 | 4 | 0 | 3 | 0 | - | 659 |

## 2026-10-30 10:38 — qwen2.5-coder:14b, tarif: volleyball

| yöntem | geçti | doğrulanamadı | kaldı | düzeltme | JS hatası | sorunlar | süre (sn) |
|---|---|---|---|---|---|---|---|
| new | 0 | 5 | 0 | 0 | 0 | - | 161 |

## 2026-10-30 10:56 — qwen2.5-coder:14b, tarif: platform

| yöntem | geçti | doğrulanamadı | kaldı | düzeltme | JS hatası | sorunlar | süre (sn) |
|---|---|---|---|---|---|---|---|
| old | 0 | 4 | 0 | 0 | 0 | probe_keys | 211 |
| new | 1 | 4 | 0 | 3 | 0 | probe_mouse | 851 |

## 2026-10-30 11:17 — qwen2.5-coder:14b, tarif: platform

| yöntem | geçti | doğrulanamadı | kaldı | düzeltme | JS hatası | sorunlar | süre (sn) |
|---|---|---|---|---|---|---|---|
| new | 1 | 4 | 0 | 3 | 0 | probe_mouse | 1161 |

**new** düzeltmelere giden sorunlar: Fare dinleniyor ama tıklama ve fare hareketi hiçbir şeyi değiştirmedi. ; Test geçmedi: Sahada altınlar ve bir düşman var. (TypeError: Cannot read properties of undefined (reading 'some')) ; Test geçmedi: Altınları toplayınca oyun kazanılır, düşmana çarpınca kaybedilir. (TypeError: game.score is not a function) ; Test geçmedi: Platform oyunu genel yapısına sahip. (ReferenceError: KGame is not defined) ; Test geçmedi: Kod ile sahada platform, altınlar ve düşman oluşturulmuştur. (TypeError: Cannot read properties of undefined (reading 'some')) || Test geçmedi: Sahada altınlar ve bir düşman var. (TypeError: Cannot read properties of undefined (reading 'some')) ; Test geçmedi: Altınları toplayınca oyun kazanılır, düşmana çarpınca kaybedilir. (TypeError: game.score is not a function) ; Test geçmedi: Platform oyunu genel yapısına sahip. (ReferenceError: KGame is not defined) ; Test geçmedi: Kod ile sahada platform, altınlar ve düşman oluşturulmuştur. (TypeError: Cannot read properties of undefined (reading 'some')) || Fare dinleniyor ama tıklama ve fare hareketi hiçbir şeyi değiştirmedi. ; Test geçmedi: Sahada altınlar ve bir düşman var. (TypeError: Cannot read properties of undefined (reading 'some')) ; Test geçmedi: Altınları toplayınca oyun kazanılır, düşmana çarpınca kaybedilir. (TypeError: game.score is not a function) ; Test geçmedi: Platform oyunu genel yapısına sahip. (ReferenceError: KGame is not defined) ; Test geçmedi: Kod ile sahada platform, altınlar ve düşman oluşturulmuştur. (TypeError: Cannot read properties of undefined (reading 'some'))
**new** maddeler: passed: Oyuncu WASD ile hareket eder, W ile zıplar. () | unverified: Sahada altınlar ve bir düşman var. (otomatik düzeltilemedi) | unverified: Altınları toplayınca oyun kazanılır, düşmana çarpınca kaybed (otomatik düzeltilemedi) | unverified: Platform oyunu genel yapısına sahip. (otomatik düzeltilemedi) | unverified: Kod ile sahada platform, altınlar ve düşman oluşturulmuştur. (otomatik düzeltilemedi)
**new** uyarılar: Fare dinleniyor ama tıklama ve fare hareketi hiçbir şeyi değiştirmedi.

## 2026-10-30 11:45 — qwen2.5-coder:14b, tarif: pong

| yöntem | geçti | doğrulanamadı | kaldı | düzeltme | JS hatası | sorunlar | süre (sn) |
|---|---|---|---|---|---|---|---|
| old | 0 | 5 | 0 | 0 | 0 | - | 286 |
| new | 2 | 3 | 0 | 3 | 0 | probe_mouse | 1392 |

**old** düzeltmelere giden sorunlar: yok
**old** maddeler: unverified: Oyuncu W ve S tuşlarıyla sol raketi kontrol eder. (boş durumda da geçti (anlamsız test)) | unverified: Sağ raketi otomatik olarak hareket eder. (boş durumda da geçti (anlamsız test)) | unverified: Top ekrana dokunduğunda yön değiştirir. (boş durumda da geçti (anlamsız test)) | unverified: Top raketlerden geçtiğinde skor güncellenir ve top ortaya çı (boş durumda da geçti (anlamsız test)) | unverified: Oyun 5-5'e kadar oynanır. (boş durumda da geçti (anlamsız test))

**new** düzeltmelere giden sorunlar: Fare dinleniyor ama tıklama ve fare hareketi hiçbir şeyi değiştirmedi. ; Test geçmedi: Sağ raketi bir bot tarafından oynanır. (test geçmedi) ; Test geçmedi: Raketler topu yakalayınca, top biraz yukarı doğru doğru ilerler. (TypeError: Cannot read properties of undefined (reading 'y')) ; Test geçmedi: Oyun 5 puana kadar oynanır ve kazanan ekranda gösterilir. (test geçmedi) || Klavye dinleniyor ama W A S D, ok tuşları ve boşluk hiçbir şeyi değiştirmedi. ; Fare dinleniyor ama tıklama ve fare hareketi hiçbir şeyi değiştirmedi. ; JavaScript hatası: Uncaught TypeError: K.sports.draw is not a function (satır 75: K.sports.draw(g, court, ctx);) ; Daha önce geçen madde bozuldu: Oyuncu W ve S tuşları ile sol raketi kontrol eder. ; Test geçmedi: Sağ raketi bir bot tarafından oynanır. (TypeError: Cannot read properties of undefined (reading 'rightPaddle')) ; Daha önce geçen madde bozuldu: Top ekranın üst ve alt kenarlarına çarptığında yukarı veya aşağı doğru doğru yansır. ; Test geçmedi: Raketler topu yakalayınca, top biraz yukarı doğru doğru ilerler. (TypeError: Cannot read properties of undefined (reading 'ball')) ; Test geçmedi: Oyun 5 puana kadar oynanır ve kazanan ekranda gösterilir. (TypeError: Cannot read properties of undefined (reading 'rules')) || Ekran boş görünüyor: canvas'a hiçbir şey çizilmemiş (tek renk). Oyunun ilk karede sahneyi çizdiğinden emin ol. ; Klavye dinleniyor ama W A S D, ok tuşları ve boşluk hiçbir şeyi değiştirmedi. ; Fare dinleniyor ama tıklama ve fare hareketi hiçbir şeyi değiştirmedi. ; JavaScript hatası: Uncaught TypeError: court.draw is not a function (satır 79: court.draw(ctx);) ; Test geçmedi: Oyuncu W ve S tuşları ile sol raketi kontrol eder. (TypeError: Cannot read properties of undefined (reading 'leftPaddle')) ; Test geçmedi: Sağ raketi bir bot tarafından oynanır. (TypeError: Cannot read properties of undefined (reading 'rightPaddle')) ; Test geçmedi: Top ekranın üst ve alt kenarlarına çarptığında yukarı veya aşağı doğru doğru yansır. (TypeError: Cannot read properties of undefined (reading 'ball')) ; Test geçmedi: Raketler topu yakalayınca, top biraz yukarı doğru doğru ilerler. (TypeError: Cannot read properties of undefined (reading 'ball')) ; Test geçmedi: Oyun 5 puana kadar oynanır ve kazanan ekranda gösterilir. (TypeError: Cannot read properties of undefined (reading 'rules'))
**new** maddeler: passed: Oyuncu W ve S tuşları ile sol raketi kontrol eder. () | unverified: Sağ raketi bir bot tarafından oynanır. (otomatik düzeltilemedi) | passed: Top ekranın üst ve alt kenarlarına çarptığında yukarı veya a () | unverified: Raketler topu yakalayınca, top biraz yukarı doğru doğru iler (otomatik düzeltilemedi) | unverified: Oyun 5 puana kadar oynanır ve kazanan ekranda gösterilir. (otomatik düzeltilemedi)
**new** uyarılar: Fare dinleniyor ama tıklama ve fare hareketi hiçbir şeyi değiştirmedi.
