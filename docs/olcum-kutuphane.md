
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

## 2026-10-30 12:08 — qwen2.5-coder:14b, tarif: platform

| yöntem | geçti | doğrulanamadı | kaldı | düzeltme | JS hatası | sorunlar | süre (sn) |
|---|---|---|---|---|---|---|---|
| new | 4 | 1 | 0 | 1 | 0 | - | 1276 |

**new** düzeltmelere giden sorunlar: Test geçmedi: Düşmana çarpınca oyun kaybedilir. (test geçmedi)
**new** maddeler: passed: Oyuncu WASD ile hareket eder ve W ile zıplar. () | passed: Sahada altınlar ve devriye gezen düşman var. () | passed: Altınları toplayınca oyun kazanılır. () | unverified: Düşmana çarpınca oyun kaybedilir. (otomatik düzeltilemedi) | passed: Altınlar rastgele yerlerde, düşman da oyuncuyu takip eder. ()

## 2026-10-30 12:13 — qwen2.5-coder:14b, tarif: snake

| yöntem | geçti | doğrulanamadı | kaldı | düzeltme | JS hatası | sorunlar | süre (sn) |
|---|---|---|---|---|---|---|---|
| old | 0 | 5 | 0 | 0 | 0 | - | 387 |
| new | 0 | 5 | 0 | 0 | 0 | probe_mouse | 1265 |

**old** düzeltmelere giden sorunlar: yok
**old** maddeler: unverified: Ok tuşlarıyla yön verilir. (zaman aşımı) | unverified: Yılan yem yiyince yılan uzar ve skor artar. (zaman aşımı) | unverified: Duvara ya da kendine çarpınca oyun biter. (zaman aşımı) | unverified: Oyun klavye ile oynanır. (zaman aşımı) | unverified: Sayfa açılır açılmaz çalışmaya hazır olsun. (zaman aşımı)

**new** düzeltmelere giden sorunlar: yok
**new** maddeler: unverified: Yılan ok tuşlarıyla kontrol edilir. (boş durumda da geçti (anlamsız test)) | unverified: Yılan yem yiyince uzar ve skor artar. (boş durumda da geçti (anlamsız test)) | unverified: Yılan duvara veya kendine çarpınca oyun biter. (boş durumda da geçti (anlamsız test)) | unverified: Yılan ve yem tamamen kodla çizilir. (boş durumda da geçti (anlamsız test)) | unverified: Oyun iki sahneyle oluşur: 'play' ve 'over'. (boş durumda da geçti (anlamsız test))
**new** uyarılar: Fare dinleniyor ama tıklama ve fare hareketi hiçbir şeyi değiştirmedi.

## 2026-10-30 12:24 — qwen2.5-coder:14b, tarif: pong

| yöntem | geçti | doğrulanamadı | kaldı | düzeltme | JS hatası | sorunlar | süre (sn) |
|---|---|---|---|---|---|---|---|
| new | 3 | 2 | 0 | 3 | 0 | probe_mouse | 1001 |

**new** düzeltmelere giden sorunlar: Test geçmedi: Sağ raketi bir bot tarafından otomatik olarak oynanır. (test geçmedi) ; Test geçmedi: Top ekranın üstüne veya altına çıkarsa skor artırılır. (test geçmedi) ; Test geçmedi: Oyun 5-5 eşitlikte bitene kadar oynanır. (test geçmedi) ; Test geçmedi: Oyuncu ve bot 100 piksel genişliğinde ve 200 piksel yüksekliğinde dikdörtgenlerdir. (test geçmedi) || Test geçmedi: Sağ raketi bir bot tarafından otomatik olarak oynanır. (test geçmedi) ; Test geçmedi: Oyun 5-5 eşitlikte bitene kadar oynanır. (test geçmedi) || Test geçmedi: Sağ raketi bir bot tarafından otomatik olarak oynanır. (test geçmedi) ; Test geçmedi: Oyun 5-5 eşitlikte bitene kadar oynanır. (test geçmedi) ; Daha önce geçen madde bozuldu: Oyuncu ve bot 100 piksel genişliğinde ve 200 piksel yüksekliğinde dikdörtgenlerdir.
**new** maddeler: passed: Oyuncu W ve S tuşlarıyla sol raketi kontrol eder. () | unverified: Sağ raketi bir bot tarafından otomatik olarak oynanır. (otomatik düzeltilemedi) | passed: Top ekranın üstüne veya altına çıkarsa skor artırılır. () | unverified: Oyun 5-5 eşitlikte bitene kadar oynanır. (otomatik düzeltilemedi) | passed: Oyuncu ve bot 100 piksel genişliğinde ve 200 piksel yüksekli ()
**new** uyarılar: Fare dinleniyor ama tıklama ve fare hareketi hiçbir şeyi değiştirmedi.

## 2026-10-30 12:28 — llama3.1:8b, tarif: volleyball

| yöntem | geçti | doğrulanamadı | kaldı | düzeltme | JS hatası | sorunlar | süre (sn) |
|---|---|---|---|---|---|---|---|
| old | 0 | 5 | 0 | 3 | 0 | - | 816 |
| new | 0 | 0 | 0 | 0 | 0 | - | 53 |

**old** düzeltmelere giden sorunlar: Test geçmedi: Oyun iki kişilik bir mini voleybol oyunudur. (test geçmedi) ; Test geçmedi: Oyun 15 puana kadar oynanır. (test geçmedi) ; Test geçmedi: Sahanın ortasındaki fileye çarpılan top oyunu kazanırlar. (test geçmedi) || Test geçmedi: Oyun iki kişilik bir mini voleybol oyunudur. (test geçmedi) ; Test geçmedi: Oyun 15 puana kadar oynanır. (test geçmedi) ; Test geçmedi: Sahanın ortasındaki fileye çarpılan top oyunu kazanırlar. (test geçmedi) || Test geçmedi: Oyun iki kişilik bir mini voleybol oyunudur. (test geçmedi) ; Test geçmedi: Oyun 15 puana kadar oynanır. (test geçmedi) ; Test geçmedi: Sahanın ortasındaki fileye çarpılan top oyunu kazanırlar. (test geçmedi)
**old** maddeler: unverified: Oyun iki kişilik bir mini voleybol oyunudur. (otomatik düzeltilemedi) | unverified: Oyuncular WASD tuşları ve fare ile oynar. (test kodu çalışmadı (oyunun hatası olmayabilir): SyntaxError: Unexpected token ';') | unverified: Rakip bot zorluk seviyesini kolay/gayma olarak seçilebilir. (test kodu çalışmadı (oyunun hatası olmayabilir): SyntaxError: Invalid or unexpected token) | unverified: Oyun 15 puana kadar oynanır. (otomatik düzeltilemedi) | unverified: Sahanın ortasındaki fileye çarpılan top oyunu kazanırlar. (otomatik düzeltilemedi)

**new** düzeltmelere giden sorunlar: yok
**new** maddeler: 

## 2026-10-30 12:30 — llama3.1:8b, tarif: volleyball

| yöntem | geçti | doğrulanamadı | kaldı | düzeltme | JS hatası | sorunlar | süre (sn) |
|---|---|---|---|---|---|---|---|
| old | 0 | 7 | 0 | 3 | 1 | - | 266 |
| new | 0 | 0 | 0 | 0 | 0 | - | 59 |

**old** düzeltmelere giden sorunlar: window.__game nesnesi tanımlı değil; skor, konum gibi oyun durumunu window.__game içinde tut. ; Dosya yüklenemedi: http://127.0.0.1:52330/play/bt1qBIvhBopsuiDyOJ6CFQ/oyun.js || JavaScript hatası: Uncaught SyntaxError: Unexpected token '.' (satır 94: let window.__game = {) || window.__game nesnesi tanımlı değil; skor, konum gibi oyun durumunu window.__game içinde tut. ; JavaScript hatası: Uncaught TypeError: canvas.getContext is not a function (satır 57: const ctx = canvas.getContext('2d');)
**old** maddeler: unverified: Oyun, iki kişilik, mini voleybol oyunudur. (test kodu çalışmadı (oyunun hatası olmayabilir): TypeError: Cannot read properties of undefined (reading 'mode')) | unverified: Oyuncu, WASD tuşları ile kendi sahasında hareket ederken, fa (test kodu çalışmadı (oyunun hatası olmayabilir): TypeError: Cannot read properties of undefined (reading 'playerControls')) | unverified: Oyunun amacı, rakip botu, file yakalamak ya da topu karşı ta (test kodu çalışmadı (oyunun hatası olmayabilir): TypeError: Cannot read properties of undefined (reading 'objective')) | unverified: Oyuncu, topu atmaya çalışırken, rakip botun sahasına girmeme (test kodu çalışmadı (oyunun hatası olmayabilir): TypeError: Cannot read properties of undefined (reading 'playerScore')) | unverified: Rakip bot, oyuncunun puanını artırması için topu oyuncunun s (test kodu çalışmadı (oyunun hatası olmayabilir): TypeError: Cannot read properties of undefined (reading 'opponentScore')) | unverified: Oyuncu, 15 puanı geçerse kazandığı ilan edilir. (test kodu çalışmadı (oyunun hatası olmayabilir): TypeError: Cannot read properties of undefined (reading 'playerScore')) | unverified: Rakip bot, 15 puanı geçerse kazandığı ilan edilir. (test kodu çalışmadı (oyunun hatası olmayabilir): TypeError: Cannot read properties of undefined (reading 'opponentScore'))

**new** düzeltmelere giden sorunlar: yok
**new** maddeler: 

## 2026-10-30 12:32 — qwen2.5:3b, tarif: volleyball

| yöntem | geçti | doğrulanamadı | kaldı | düzeltme | JS hatası | sorunlar | süre (sn) |
|---|---|---|---|---|---|---|---|
| old | 0 | 0 | 0 | 3 | 1 | no_game_state, probe_blank | 101 |
| new | 0 | 0 | 0 | 0 | 0 | - | 46 |

**old** düzeltmelere giden sorunlar: window.__game nesnesi tanımlı değil; skor, konum gibi oyun durumunu window.__game içinde tut. ; Ekran boş görünüyor: canvas'a hiçbir şey çizilmemiş (tek renk). Oyunun ilk karede sahneyi çizdiğinden emin ol. ; JavaScript hatası: Uncaught SyntaxError: Identifier 'topSpeed' has already been declared (satır 44: const topSpeed = 10;) || window.__game nesnesi tanımlı değil; skor, konum gibi oyun durumunu window.__game içinde tut. ; Ekran boş görünüyor: canvas'a hiçbir şey çizilmemiş (tek renk). Oyunun ilk karede sahneyi çizdiğinden emin ol. ; JavaScript hatası: Uncaught SyntaxError: Identifier 'top' has already been declared (satır 21: <script>) || window.__game nesnesi tanımlı değil; skor, konum gibi oyun durumunu window.__game içinde tut. ; Ekran boş görünüyor: canvas'a hiçbir şey çizilmemiş (tek renk). Oyunun ilk karede sahneyi çizdiğinden emin ol. ; JavaScript hatası: Uncaught SyntaxError: Identifier 'top' has already been declared (satır 34: <script>)
**old** maddeler: 

**new** düzeltmelere giden sorunlar: yok
**new** maddeler: 

## 2026-10-30 12:35 — qwen2.5:3b, tarif: volleyball

| yöntem | geçti | doğrulanamadı | kaldı | düzeltme | JS hatası | sorunlar | süre (sn) |
|---|---|---|---|---|---|---|---|
| old | 0 | 0 | 0 | 3 | 0 | probe_keys | 189 |
| new | 0 | 0 | 0 | 3 | 1 | probe_blank, probe_keys, probe_mouse | 260 |

**old** düzeltmelere giden sorunlar: window.__game nesnesi tanımlı değil; skor, konum gibi oyun durumunu window.__game içinde tut. || window.__game nesnesi tanımlı değil; skor, konum gibi oyun durumunu window.__game içinde tut. || window.__game nesnesi tanımlı değil; skor, konum gibi oyun durumunu window.__game içinde tut. ; JavaScript hatası: Uncaught ReferenceError: topMoving is not defined (satır 87: } else if (topMoving) {)
**old** maddeler: 
**old** uyarılar: Klavye dinleniyor ama W A S D, ok tuşları ve boşluk hiçbir şeyi değiştirmedi.

**new** düzeltmelere giden sorunlar: Dış ağ adresi kullanılmış: https://cdn.jsdelivr.net/npm/k-game. Kaldır; oyun tamamen yerel çalışmalı. ; Ekran boş görünüyor: canvas'a hiçbir şey çizilmemiş (tek renk). Oyunun ilk karede sahneyi çizdiğinden emin ol. ; Dosya yüklenemedi: https://cdn.jsdelivr.net/npm/k-game ; JavaScript hatası: Uncaught TypeError: Cannot read properties of undefined (reading 'mouse') (satır 76: x: K.input.mouse.x,) || Ekran boş görünüyor: canvas'a hiçbir şey çizilmemiş (tek renk). Oyunun ilk karede sahneyi çizdiğinden emin ol. ; JavaScript hatası: Uncaught TypeError: Cannot read properties of undefined (reading 'mouse') (satır 76: x: K.input.mouse.x,) || Ekran boş görünüyor: canvas'a hiçbir şey çizilmemiş (tek renk). Oyunun ilk karede sahneyi çizdiğinden emin ol. ; JavaScript hatası: Uncaught TypeError: g.on is not a function (satır 69: g.on('mousemove', (e, dt) => {)
**new** maddeler: 
**new** uyarılar: Klavye dinleniyor ama W A S D, ok tuşları ve boşluk hiçbir şeyi değiştirmedi. | Fare dinleniyor ama tıklama ve fare hareketi hiçbir şeyi değiştirmedi.
