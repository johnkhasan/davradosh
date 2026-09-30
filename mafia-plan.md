# 🕵️ Mafia — Loyiha rejasi

> Do'stlar bilan onlayn **sport mafiasi**: havola orqali qo'shilasiz, server boshlovchi (sudya)
> bo'lib o'yinni rasmiy qoidalar bo'yicha o'zi yuritadi, gapirish esa navbat bilan, ovozli chatda.

- **Joylashuvi:** shu saytning ichida, alohida bo'lim: `/mafia`
- **Boshlovchi:** avtomatik. Server sudya vazifasini bajaradi: fazalar, taymerlar, so'z navbati, ovoz berish, natijalar
- **Qoidalar:** Sport mafiasi federatsiyasining rasmiy qoidalari (ФСМ, 2022-yil 17-oktyabr tahriri). Onlayn o'yinga moslashtirilgan joylar §2.9 da alohida ko'rsatilgan
- **O'yinchilar:** aniq **10 kishi** (rasmiy qoida)
- **Asosiy tamoyil:** server authoritative va **maxfiylik birinchi o'rinda**. Client hech qachon o'ziga tegishli bo'lmagan maxfiy ma'lumotni olmaydi

Manba: [Официальные правила игры «Мафия», ФСМ](https://gomafia.pro/fsm-rules.pdf). Boshqa klublar ham xuddi shu asosiy qoidalar bo'yicha o'ynaydi ([ФИИМ turnir qoidalari](https://planeta-igr.com/image/data/instrukcii/reglamentmafia.pdf)).

---

## 0. Doira

### Birinchi versiya (MVP)

- Xona yaratish, havola va Telegram orqali taklif qilish, lobbi, "Tayyorman" tugmasi
- Rasmiy tarkib: **7 qizil** (6 tinch aholi + Sherif) va **3 qora** (2 mafiya + Don)
- Avtomatik sudya: tanishuv tuni → kun → ovoz berish → tun (otish, Don, Sherif) → tong…
- So'z navbati: har bir o'yinchiga 1 daqiqa, **faqat navbatdagi o'yinchining mikrofoni ochiq** (server boshqaradi)
- Nomzod ko'rsatish, ketma-ket ovoz berish, teng ovozda qayta ovoz berish va "hammasini chiqarish" ovozi
- "Eng yaxshi yurish" (лучший ход), oxirgi so'z, o'yin oxirida rollarni ochish, o'yin jurnali
- O'lganlar tomoshabin bo'lib qoladi: eshitadi va ko'radi, lekin gapira olmaydi
- Telefon va kompyuterda ishlaydi (mobile-first)

### Keyinroq (MVP'ga kirmaydi)

- Sudya tomonidan foll (ogohlantirish) berish: onlayn o'yinda navbatsiz gapirishni server o'zi to'xtatadi, shuning uchun hozircha kerak emas (§2.9)
- "Do'stona stol" varianti (7–9 kishi): rasmiy emas, so'rov bo'lsa (§12)
- Party-mafia rollari (Shifokor, Manyak, Sevgili va h.k.): alohida rejim sifatida
- Reyting va ball (ФСМ ball tizimi: eng yaxshi yurish uchun qo'shimcha ballar va h.k.)
- Video (hozir faqat ovoz), ochiq xonalar, o'yinlar tarixi

---

## 1. Arxitektura: mavjud loyihaga qanday qo'shiladi

Mafia puzzle bilan **bitta server, bitta LiveKit, bitta identifikatsiya**dan foydalanadi, lekin kodi alohida turadi. Shunda puzzle'ga ta'sir qilmaydi.

```
apps/web/app/mafia/               ← Next.js sahifalari
  page.tsx                        ← mafia bosh sahifasi (qoidalar, "Xona yaratish")
  [id]/page.tsx                   ← o'yin xonasi (+ opengraph-image.tsx taklif uchun)
apps/web/components/mafia/        ← UI (stol, rol kartasi, so'z navbati, ovoz berish, jurnal…)
apps/web/lib/mafia/               ← MafiaController (socket, holat, ovoz)

apps/server/src/mafia/            ← server
  game.ts                         ← o'yin holati mashinasi (sof, test qilinadigan)
  game.test.ts
  mafia-room.ts                   ← xona: o'yinchilar, ulanishlar, taymerlar, emit
  socket-handlers.ts              ← Socket.IO "/mafia" namespace
  voice-policy.ts                 ← fazaga qarab LiveKit ruxsatlari

packages/shared/src/mafia/        ← umumiy tiplar, Zod sxemalar, taymer konstantalari
```

**Qayta ishlatiladigan tayyor qismlar:**

- `lib/identity.ts` (ism, rang, avatar, clientId): puzzle bilan bir xil
- Socket.IO serveri: yangi `/mafia` namespace, puzzle'ning `/` namespace'iga tegilmaydi
- `rtc/voice.ts` (LiveKit token, `removeParticipant`): kengaytiriladi
- Rate limit, origin tekshiruvi, "boshqa tabda ochildi", xonadan chiqarish va ban, host o'tkazish
- Prisma va Postgres: yangi `MafiaRoom` modeli
- Deploy (Vercel + VPS), monitoring (Uptime Kuma), OG preview

**Nega alohida namespace va alohida papka:** mafia qoidalari puzzle'dan butunlay farq qiladi. Aralashtirilsa, ikkalasini ham o'zgartirish qiyinlashadi. Ular umumiy infratuzilmani baham ko'radi, o'yin mantiqini emas.

---

## 2. O'yin qoidalari (rasmiy, ФСМ)

### 2.1. Tarkib va rollar

10 o'yinchi tasodifiy ravishda ikki jamoaga bo'linadi (1.1-band):

| Rol             | Soni | Jamoa | Tungi harakat                                                                       |
| --------------- | ---- | ----- | ----------------------------------------------------------------------------------- |
| **Tinch aholi** | 6    | Qizil | Yo'q                                                                                |
| **Sherif**      | 1    | Qizil | Har tun bitta o'yinchini tekshiradi: "qizil" yoki "qora"                            |
| **Mafiya**      | 2    | Qora  | Don bilan birga "otadi"                                                             |
| **Don**         | 1    | Qora  | Mafiya bilan birga otadi **va** har tun bitta o'yinchini "Sherifmi?" deb tekshiradi |

- O'yin boshida har bir o'yinchiga **stol raqami** (1–10) tasodifiy beriladi. O'yin davomida hamma raqam bilan murojaat qiladi: gapirish navbati, nomzod ko'rsatish, eng yaxshi yurish.
- Taqsimot kriptografik tasodifiy (`crypto.randomInt`) bilan serverda qilinadi.
- Shifokor va boshqa "party" rollar rasmiy o'yinda **yo'q**.

### 2.2. G'alaba shartlari (1.4-band)

- **Qizillar yutadi:** barcha qora o'yinchilar o'yindan chiqdi
- **Qoralar yutadi:** stolda ikki jamoadan **teng** o'yinchi qoldi yoki qoralar qizillardan **ko'p**
- O'yinchi chiqqan payt: ovoz berish natijasi yoki tungi "o'ldirish" payti. Shartlar shu zahoti tekshiriladi
- **Durang (7.7-band):** ketma-ket uch tun davomida stoldagi o'yinchilar soni o'zgarmasa, uchinchi tundan keyin durang e'lon qilinadi

### 2.3. Tanishuv tuni ("договорка", 4.2-band)

Birinchi tun o'ldirishsiz o'tadi:

1. Qora o'yinchilar **bir-birini ko'radi**. Bu qoralar birga "uyg'onadigan" yagona tun. Don o'zini ko'rsatadi va keyingi tunlar uchun **otish tartibini belgilaydi**. Buning uchun qoralarga **aniq 1 daqiqa** beriladi (onlayn: tungi ovozli va matnli kanal, §5).
2. Sherif stolni "ko'zdan kechiradi" (20 soniya), lekin bu tunda tekshiruv qilmaydi.

Shundan keyin **birinchi kun** boshlanadi.

### 2.4. Kun: muhokama (4.3-band)

- Har bir o'yinchiga **1 daqiqa** so'z beriladi. Navbat stol raqami bo'yicha:
  - birinchi kunni 1-raqamli o'yinchi boshlaydi
  - har keyingi kunni oldingi kun birinchi gapirganidan **keyingi** o'yinchi boshlaydi
- O'yinchi so'zini "Pas" yoki "Rahmat" bilan erta tugatishi mumkin (onlayn: **"Pas"** tugmasi)
- Faqat navbatdagi o'yinchi gapiradi. Onlayn o'yinda buni server mikrofon ruxsatlari bilan ta'minlaydi (§5)
- **Oxirgi so'z:** o'yindan chiqqan har bir o'yinchiga (tunda o'ldirilgan yoki ovoz bilan chiqarilgan) **1 daqiqa** beriladi (4.4.13, 4.5.4)

### 2.5. Nomzod ko'rsatish (4.4.2–4.4.3)

- Nomzodni faqat **o'z daqiqasi davomida** ko'rsatish mumkin ("Men N-raqamli o'yinchini ko'rsataman")
- Har bir o'yinchi bir kunda **faqat bitta** nomzod ko'rsata oladi
- Allaqachon ko'rsatilgan o'yinchini qayta ko'rsatib bo'lmaydi, u nomzodlar ro'yxatiga faqat bir marta kiradi
- Nomzodlar **ko'rsatilgan tartibda** ro'yxatga yoziladi. Ovoz berish ham shu tartibda o'tadi

### 2.6. Ovoz berish (4.4-band)

1. Ovoz berish muhokamadan keyin, faqat ko'rsatilgan nomzodlar orasida o'tadi.
2. **Birinchi kunda faqat bitta nomzod** ko'rsatilgan bo'lsa, ovoz berish **o'tkazilmaydi** (4.4.10). Keyingi kunlarda nomzodlar soni istalgancha bo'lishi mumkin, bitta nomzod ham ovozga qo'yiladi.
3. Har bir tirik o'yinchining **bitta ovozi** bor va u faqat bitta nomzodga qarshi ovoz beradi.
4. **Ovoz bermagan o'yinchining ovozi oxirgi ko'rsatilgan nomzodga o'tadi** (4.4.8). Shuning uchun bitta nomzod bo'lsa, u barcha ovozlarni oladi va o'yindan chiqadi.
5. **Eng ko'p ovoz** olgan o'yinchi o'yindan chiqadi (4.4.11). Uning roli **oshkor qilinmaydi** (4.4.13).
6. **Teng ovoz** (4.4.12):
   - teng ovoz olganlar ko'rsatilish tartibida **30 soniyadan** qo'shimcha so'z oladi, keyin faqat ular orasida qayta ovoz beriladi
   - qayta ovozda ham teng chiqsa-yu, nomzodlar **kamaygan** bo'lsa, qolganlar yana 30 soniya oladi va yana qayta ovoz beriladi
   - **xuddi o'sha** nomzodlar orasida yana teng chiqsa: "Barcha nomzodlar stolni tark etsinmi?" degan ovoz beriladi. **Ko'pchilik "ha"** desa, hammasi chiqadi. Ko'pchilik "yo'q" desa yoki ovozlar teng bo'lsa, hammasi qoladi
   - stoldagi **barcha** o'yinchilar nomzod bo'lsa, "hammasini chiqarish" ovozi o'tkazilmaydi (7.8)
7. **Ovozlar ochiq:** kim kimga ovoz bergani hammaga ko'rsatiladi. Oflayn o'yinda ham hamma qo'llarni ko'radi.

### 2.7. Tun (2-tun va keyingilari, 4.5-band)

Tun **ketma-ket bosqichlardan** iborat. Har bir bosqich rollardan qat'i nazar **doim bir xil uzunlikda** davom etadi (masalan, Don o'lgan bo'lsa ham "Don uyg'onadi" bosqichi o'tadi). Aks holda vaqtdan kim tirikligini bilib olish mumkin bo'lardi.

1. **"Mafiya ovga chiqadi"**: har bir tirik qora o'yinchi, **gaplashmasdan**, bitta nishonni tanlaydi.
   - Hamma tirik qoralar **bitta** o'yinchini tanlasa, u o'ldiriladi
   - Kimdir boshqa nishon tanlasa, bir nechtasini tanlasa yoki tanlamasa, bu **o'q tegmadi** (промах) deb hisoblanadi va o'sha tunda hech kim o'lmaydi (4.5.5)
   - Shuning uchun qoralar tanishuv tunida kelishilgan tartibga va kunduzgi "belgilar"ga tayanadi
2. **"Don uyg'onadi va Sherifni qidiradi"**: Don bitta o'yinchini tekshiradi va "Sherif" yoki "Sherif emas" javobini faqat o'zi ko'radi (≤10 s).
3. **"Sherif uyg'onadi"**: Sherif bitta o'yinchini tekshiradi va "qizil" yoki "qora" javobini faqat o'zi ko'radi (≤10 s).
   - Don va Sherif har tunda **bitta** tekshiruv qila oladi (4.5.8)
4. **Eng yaxshi yurish** (лучший ход, 4.5.9). Faqat **2-tunda** (tanishuvdan keyingi birinchi tunda) o'ldirilgan o'yinchi uchun: u tun davomida "uyg'onadi" va o'zi qora deb o'ylagan **3 ta o'yinchi raqamini** aytadi (20 s). Raqamlar tongda hammaga e'lon qilinadi.
   - Istisno (7.10): birinchi kunda ovoz berish bilan **2 yoki undan ko'p** o'yinchi chiqqan bo'lsa, eng yaxshi yurish berilmaydi
5. **Tong:** kechasi kim o'ldirilgani (yoki "O'q tegmadi, hech kim o'lmadi") va eng yaxshi yurish e'lon qilinadi. Keyin o'ldirilgan o'yinchining oxirgi so'zi va yangi kun boshlanadi.

### 2.8. O'lganlar va chiqqanlar

- Roli **oshkor qilinmaydi**, faqat o'yin oxirida hamma rollar ochiladi (4.4.13)
- O'yinni tomoshabin sifatida kuzatadi, lekin gapira olmaydi va ovoz bera olmaydi
- Tiriklarning rollarini ham ko'rmaydi. Aks holda keyingi o'yinlarda yoki "sizib chiqish" orqali adolat buziladi

### 2.9. Onlayn o'yinga moslashtirishlar

Rasmiy qoidalar stol atrofidagi jonli o'yin uchun yozilgan. Ularning ma'nosi o'zgarmaydi, faqat bajarilish usuli boshqacha:

| Oflayn (rasmiy)                            | Onlayn (bizda)                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Niqob taqish, ko'zni yumish                | Tunda ekran "uxlaydi": o'z rolingizdan boshqa hech narsa ko'rinmaydi                                          |
| Sudya ishorasi (bosh irg'ash, bosh barmoq) | Natija faqat tekshiruvchining ekraniga keladi                                                                 |
| Barmoq bilan "otish"                       | Maxfiy tanlov tugmasi                                                                                         |
| Musht bilan ovoz berish, ~1.5 s            | Ovoz berish ekrani, har bir nomzodga qisqa oyna. Ovoz bermaganning ovozi qoidaga ko'ra oxirgi nomzodga o'tadi |
| Navbatsiz gapirish uchun foll              | Server mikrofonni faqat navbatdagi o'yinchiga ochadi, shuning uchun bunday foll kerak emas                    |
| Imo-ishora, "belgilar" berish uchun foll   | Kunduzi faqat bitta mikrofon ochiq, matnli chat esa o'yin davomida yopiq. Kamerani MVP'da o'chirib qo'yamiz   |
| Sherif stolni "ko'zdan kechiradi"          | Sherif tanishuv tunida faqat kutadi (onlayn o'yinda ko'radigan narsa yo'q)                                    |

Yuqoridagi moslashtirishlar natijasida sudya aralashuvi (foll, diskvalifikatsiya) MVP'da kerak emas. Keyinroq host'ga foll berish imkoniyatini qo'shish mumkin: 3 foll bo'lsa keyingi daqiqada so'z berilmaydi, 4 foll bo'lsa o'yindan chiqadi (6.4–6.5).

---

## 3. Faza mashinasi va taymerlar

```
LOBBY ──(host "Boshlash", aniq 10 tayyor)──▶ ROLE_REVEAL
ROLE_REVEAL ─▶ ZERO_NIGHT (qoralar kelishuvi 60 s)
ZERO_NIGHT ─▶ DAY
DAY:  SPEECH(1) → SPEECH(2) → … → SPEECH(n)            (har biri 60 s yoki "Pas")
      → [VOTING] → [TIE_SPEECHES 30 s → REVOTE …] → [LIFT_ALL_VOTE]
      → [LAST_WORDS 60 s har bir chiqqan uchun]
NIGHT: SHOOT → DON_CHECK → SHERIFF_CHECK → [BEST_MOVE, faqat 2-tun] → DAWN
DAWN ─▶ [LAST_WORDS 60 s] ─▶ DAY …
har bir chiqishdan keyin: g'alaba yoki durang sharti bajarilsa ──▶ GAME_OVER
GAME_OVER ──(host "Yana o'ynash")──▶ LOBBY (xuddi shu o'yinchilar bilan)
```

| Bosqich       | Davomiyligi                             | Kim gapiradi                              |
| ------------- | --------------------------------------- | ----------------------------------------- |
| ROLE_REVEAL   | 10 s                                    | hech kim                                  |
| ZERO_NIGHT    | 60 s (rasmiy)                           | faqat qoralar, tungi kanalda              |
| SPEECH        | 60 s (rasmiy), "Pas" bilan erta tugaydi | faqat navbatdagi o'yinchi                 |
| VOTING        | nomzod boshiga ~5 s                     | hech kim                                  |
| TIE_SPEECH    | 30 s (rasmiy)                           | faqat navbatdagi nomzod                   |
| LIFT_ALL_VOTE | 5 s                                     | hech kim                                  |
| LAST_WORDS    | 60 s (rasmiy)                           | faqat chiqayotgan o'yinchi                |
| SHOOT         | 10 s                                    | hech kim (gaplashish taqiqlangan)         |
| DON_CHECK     | 10 s (rasmiy, ≤10 s)                    | hech kim                                  |
| SHERIFF_CHECK | 10 s (rasmiy, ≤10 s)                    | hech kim                                  |
| BEST_MOVE     | 20 s (rasmiy)                           | hech kim (raqamlar tugma bilan tanlanadi) |
| DAWN          | 5 s (e'lon)                             | hech kim                                  |

- Taymerlar **faqat serverda** ishlaydi. Client faqat `endsAt` vaqtini oladi va ekranda sanaydi.
- Tungi bosqichlar harakat qilingan-qilinmaganidan qat'i nazar **to'liq vaqt** davom etadi. SPEECH esa "Pas" bilan erta tugaydi, bu ochiq harakat.
- Uzilib qolgan o'yinchining gapirish navbati kelsa, 10 soniya kutiladi, keyin uning daqiqasi "Pas" deb hisoblanadi.
- Fazalarni o'zgartiradigan yagona funksiya: `game.advance(now)`. U sof funksiya, shuning uchun test qilish oson.

---

## 4. Maxfiylik va xavfsizlik (eng muhim qism)

Mafia'da bitta sizib chiqqan ma'lumot o'yinni buzadi. Shuning uchun:

1. **Har bir o'yinchi o'z "ko'rinishini" oladi.** Server to'liq holatni saqlaydi va har bir socket'ga alohida hisoblangan `viewFor(playerId)` yuboradi. Hammaga umumiy (broadcast) holat hech qachon yuborilmaydi.
2. **Rollar hech qachon ommaviy event'da bo'lmaydi.** Qoralar faqat bir-birini ko'radi. Otish tanlovlari, Don va Sherif tekshiruvlari faqat egasiga boradi.
3. **Otish tanlovlari hatto qoralar orasida ham sir:** kim kimni tanlagani ko'rsatilmaydi, faqat natija (o'ldirildi yoki o'q tegmadi) e'lon qilinadi. Oflayn o'yinda ham qoralar ko'zlari yumuq holda otadi.
4. **Client'ga ishonilmaydi:** otish, tekshiruv, nomzod ko'rsatish, ovoz berish, "Pas", eng yaxshi yurish, hammasi serverda tekshiriladi: faza to'g'rimi, o'yinchi tirikmi, rolga ruxsat bormi, navbat unikimi, nishon to'g'rimi.
5. **Tungi faollik sezilmasligi kerak.** Tungi bosqichlar doim bir xil uzunlikda. Harakatlar vaqti va soni boshqalarga ko'rinmaydi. O'lik Don yoki Sherifning bosqichi ham o'tkaziladi.
6. **Maxfiylik testi:** har bir emit qilingan payload rol va tungi ma'lumotni faqat ruxsat etilgan o'yinchiga olib borayotganini tekshiradigan avtomatik test (§10).
7. **Tasodifiylik:** `crypto.randomInt`, ya'ni `Math.random` emas. Rollar ham, stol raqamlari ham shu bilan taqsimlanadi.
8. **Ovoz ham maxfiylik qismi:** tungi kanalga faqat qoralar ulanadi va faqat tanishuv tunida. Bu server bergan token bilan ta'minlanadi (§5).
9. **Bir kishi, bitta o'yinchi:** bitta clientId bitta o'rin. Ikkinchi tab ochilsa, eskisi uziladi (puzzle'dagi mexanizm).

---

## 5. Ovoz (LiveKit)

Ikki LiveKit xonasi:

- **Umumiy xona** `mafia-{id}`: hamma o'yinchi va tomoshabin
- **Tungi xona** `mafia-{id}-night`: token **faqat qoralarga** va **faqat tanishuv tunida** (60 s) beriladi. Rasmiy qoidaga ko'ra keyingi tunlarda qoralar gaplashmaydi

Fazaga qarab server `RoomServiceClient.updateParticipant(...)` orqali ruxsatlarni o'zgartiradi:

| Faza                             | Umumiy xonada `canPublish`    | Tungi xona         |
| -------------------------------- | ----------------------------- | ------------------ |
| LOBBY                            | hamma                         | yopiq              |
| ZERO_NIGHT                       | hech kim                      | qoralar gaplashadi |
| SPEECH / TIE_SPEECH / LAST_WORDS | **faqat navbatdagi o'yinchi** | yopiq              |
| VOTING / LIFT_ALL_VOTE           | hech kim                      | yopiq              |
| Tungi bosqichlar                 | hech kim                      | yopiq              |
| GAME_OVER                        | hamma                         | yopiq              |

- Ruxsatlar **server tomonda** o'rnatiladi. Client'dagi "mute" tugmasi faqat qulaylik uchun, xavfsizlik uning ustiga qurilmaydi.
- Tanishuv tuni tugashi bilan tungi xonadagi ishtirokchilar `removeParticipant` bilan chiqariladi va xona yopiladi.
- O'lgan o'yinchi faqat o'zining oxirgi so'zi davomida gapira oladi.
- Mikrofon ishlamasa ham o'ynash mumkin: nomzod ko'rsatish, ovoz berish va "Pas" tugmalar orqali ishlaydi. So'z navbatida matn bilan yozish imkoniyati beriladi, u ham faqat navbatdagi o'yinchida bo'ladi.

---

## 6. Protokol (Socket.IO `/mafia`)

**Client → Server** (hammasi Zod bilan tekshiriladi, ack qaytaradi):

| Event               | Ma'nosi                                                    |
| ------------------- | ---------------------------------------------------------- |
| `mafia:join`        | xonaga kirish (ism, rang, avatar, clientId)                |
| `mafia:ready`       | lobbida "tayyorman" / "tayyor emasman"                     |
| `mafia:start`       | host o'yinni boshlaydi (aniq 10 o'yinchi tayyor bo'lsa)    |
| `mafia:pass`        | o'z daqiqasini erta tugatish ("Pas")                       |
| `mafia:nominate`    | `{ seat }`: o'z daqiqasida bitta nomzod                    |
| `mafia:speech-text` | mikrofonsiz o'yinchi uchun: o'z navbatida matn             |
| `mafia:vote`        | `{ seat }`: ovoz berish oynasida bitta nomzodga qarshi     |
| `mafia:lift-all`    | `{ agree: boolean }`: "hammasi chiqsinmi?" ovozi           |
| `mafia:shoot`       | `{ seat }`: faqat qoralar, SHOOT bosqichida                |
| `mafia:check`       | `{ seat }`: Don yoki Sherif, o'z bosqichida                |
| `mafia:best-move`   | `{ seats: [a, b, c] }`: faqat 2-tunda o'ldirilgan o'yinchi |
| `mafia:rematch`     | host "yana o'ynash"                                        |

**Server → Client:**

| Event               | Kimga                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mafia:state`       | har kimga o'zining `viewFor(playerId)` ko'rinishi: faza, `endsAt`, stol (raqam, ism, tirikmi), navbatdagi o'yinchi, nomzodlar, o'z roli, ruxsat etilgan harakatlar |
| `mafia:private`     | faqat egasiga: qora jamoadoshlar, tekshiruv natijasi                                                                                                               |
| `mafia:event`       | hammaga: jurnal yozuvi ("3-raqam 4-raqamni ko'rsatdi", "7-raqam 6 ovoz bilan chiqdi", "Tong: o'q tegmadi")                                                         |
| `mafia:voice-token` | faza o'zgarganda: umumiy xona token'i (qoralarga tanishuv tunida tungi xona token'i ham)                                                                           |

---

## 7. Ma'lumotlar modeli

**Xotirada (asosiy):** `MafiaGame`, ya'ni faza, `endsAt`, o'yinchilar (stol raqami, rol, tirikmi, ulanganmi), kun va tun raqami, so'z navbati, nomzodlar ro'yxati, ovozlar, shu tunning tanlovlari, "o'yinchilar soni o'zgarmagan tunlar" hisoblagichi (durang uchun), jurnal.

**Postgres (Prisma), qayta ishga tushganda tiklash uchun:**

```prisma
model MafiaRoom {
  id        String      @id           // nanoid(8): /mafia/{id}
  hostId    String
  status    MafiaStatus @default(LOBBY) // LOBBY | PLAYING | FINISHED
  state     Json?                       // o'yin snapshot'i (rollar shu yerda, faqat serverda)
  banned    String[]    @default([])
  createdAt DateTime    @default(now())
  expiresAt DateTime                    // 24 soat
  @@index([expiresAt])
}
```

- Snapshot har bosqich o'zgarishida yoziladi. Server qayta ishga tushsa, o'yin shu bosqichning boshidan davom etadi.
- `state` ichidagi rollar maxfiy. Ular hech qanday REST endpoint orqali qaytarilmaydi.
- Eskirgan xonalar mavjud tozalash jarayoni bilan o'chiriladi.

---

## 8. Interfeys (ekranlar)

Mobile-first: ko'pchilik telefondan, Telegram havolasi orqali kiradi.

1. **`/mafia` bosh sahifa:** qoidalar qisqacha, "Xona yaratish". SEO uchun ham ("mafia onlayn", "sport mafiasi", "мафия онлайн").
2. **Lobbi:** 10 o'rinli stol (avatar va ism), "Tayyorman", taklif havolasi va QR, "yana N kishi kerak", host uchun "Boshlash".
3. **Rol kartasi:** ag'dariladigan karta animatsiyasi. "Yashirish" tugmasi bor (atrofdagilar telefonga qarab qolmasligi uchun).
4. **Stol (asosiy ekran):** 10 ta o'rin doira shaklida, raqam, ism, avatar. Gapirayotgan o'yinchi yoritiladi va taymer halqasi ko'rsatiladi. O'lganlar xiralashadi.
   - O'z navbatingizda: "Nomzod ko'rsatish" (raqam tanlash) va "Pas"
   - Nomzodlar ro'yxati ko'rsatilgan tartibda
5. **Ovoz berish:** nomzodlar birin-ketin ko'rsatiladi. Har biriga qisqa oyna va "Qarshi ovoz" tugmasi, natijalar ochiq ko'rinadi. Teng ovozda qo'shimcha so'z va qayta ovoz, "Hammasi chiqsinmi?" ekrani.
6. **Tun:** qorong'i mavzu, "Shahar uxlayapti…" va umumiy tungi taymer. Rolga qarab:
   - Qoralar: "Ovga chiqing" va nishon tanlash (tanishuv tunida: jamoadoshlar va tungi ovozli kanal)
   - Don va Sherif: o'z bosqichida tekshiruv va javob kartasi
   - 2-tunda o'ldirilgan o'yinchi: eng yaxshi yurish uchun 3 ta raqam tanlash
   - Qolganlar: faqat tungi ekran (bosqichlar ham ko'rinmaydi, faqat umumiy vaqt)
7. **Tong:** e'lon animatsiyasi (kim o'ldi yoki "O'q tegmadi"), eng yaxshi yurish raqamlari, oxirgi so'z.
8. **O'yin tugadi:** g'olib jamoa (yoki durang), hamma rollar ochiladi, o'yin jurnali (har bir kun, tun, ovoz va tekshiruv), "Yana o'ynash".
9. **Doimiy elementlar:** faza va taymer paneli, jurnal (yig'iladigan), o'z rolim (bosib turganda ko'rinadi), mikrofon holati, o'z Sherif yoki Don tekshiruvlarim tarixi.

Dizayn puzzle bilan bir xil tokenlardan foydalanadi (ranglar, shriftlar). Tun uchun alohida qorong'i palitra.

---

## 9. Chekka holatlar

| Holat                                      | Qaror                                                                                                                                                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O'yinchi o'yin davomida uzilib qoldi       | O'rni 90 s saqlanadi. Shu vaqtda navbati kelsa: 10 s kutiladi, keyin "Pas". Ovoz berishda uning ovozi qoidaga ko'ra oxirgi nomzodga o'tadi. Otishda tanlamagani uchun o'q tegmaydi                              |
| 90 s ichida qaytmadi                       | O'yinchi o'yindan chiqarilgan hisoblanadi (rasmiy o'yindagi diskvalifikatsiyaga o'xshab), roli oshkor qilinmaydi va g'alaba sharti tekshiriladi. Rasmiy 7.1-bandga ko'ra shu kunning ovoz berishi o'tkazilmaydi |
| Hammasi uzildi                             | O'yin to'xtaydi, snapshot saqlanadi. 10 daqiqa ichida qaytsalar davom etadi                                                                                                                                     |
| Host chiqib ketdi                          | Host boshqa o'yinchiga o'tadi (puzzle'dagi host o'tkazish mexanizmi). O'yin to'xtamaydi, sudya baribir server                                                                                                   |
| Lobbida 10 kishidan kam                    | "Boshlash" o'chiq, "yana N kishi kerak" deb ko'rsatiladi                                                                                                                                                        |
| 10 dan ortiq kishi kirdi                   | Tomoshabin sifatida qo'shiladi (puzzle'dagi viewer rejimi). Keyingi o'yinda o'rin bo'shasa o'yinchi bo'ladi                                                                                                     |
| O'yin boshlangandan keyin yangi odam keldi | Faqat tomoshabin                                                                                                                                                                                                |
| Server qayta ishga tushdi                  | Snapshot'dan tiklanadi, joriy bosqich taymeri qaytadan boshlanadi                                                                                                                                               |
| O'yin davomida ism o'zgartirish            | Qulflanadi: stolda raqam va ism o'yin oxirigacha o'zgarmaydi                                                                                                                                                    |

---

## 10. Testlar

1. **`game.ts` birlik testlari** (sof mantiq, soxta soat bilan), har bir rasmiy qoida uchun alohida test:
   - tarkib: 6 tinch aholi, 1 Sherif, 2 mafiya, 1 Don. Stol raqamlari noyob
   - gapirish navbati: 1-kun 1-raqamdan, keyingi kunlar siljiydi, o'liklar o'tkazib yuboriladi
   - nomzod: faqat o'z daqiqasida, kuniga bitta, takrorlanmaydi, tartib saqlanadi
   - ovoz berish: 1-kunda bitta nomzod bo'lsa ovoz yo'q, ovoz bermaganlar oxirgi nomzodga, teng ovoz → 30 s → qayta ovoz → "hammasi chiqsinmi?", 7.8-istisno
   - otish: hamma bitta nishonni tanlasa o'ladi, aks holda o'q tegmaydi (turli nishon, tanlamaslik)
   - Don va Sherif tekshiruvlari, tunda bittadan
   - eng yaxshi yurish: faqat 2-tunda o'ldirilganga, 7.10-istisno
   - g'alaba: teng qolganda qoralar yutadi, barcha qoralar chiqsa qizillar yutadi, 3 tun o'zgarishsiz bo'lsa durang
2. **Simulyatsiya:** 1000 ta tasodifiy o'yin boshidan oxirigacha. Har biri tugashi, hech qachon noto'g'ri fazaga o'tmasligi va natija to'g'ri aniqlanishi tekshiriladi.
3. **Maxfiylik testi:** har bir emit ushlanadi va hech bir o'yinchi o'ziga tegishli bo'lmagan rol, otish tanlovi yoki tekshiruv natijasini olmagani tekshiriladi.
4. **Ruxsat testlari:** o'lik o'yinchi ovoz bera olmaydi, navbati bo'lmagan o'yinchi nomzod ko'rsata olmaydi, tinch aholi otolmaydi, Sherif ikki marta tekshira olmaydi.
5. **Socket integratsiya testi:** 10 ta haqiqiy socket client bilan bitta to'liq o'yin (puzzle'dagi `server.test.ts` kabi).
6. **Ovoz siyosati testi:** har bir faza uchun `voice-policy.ts` kutilgan ruxsatlarni qaytaradi (masalan, SPEECH'da faqat navbatdagi o'yinchi `canPublish`).

---

## 11. Bosqichlar

| #   | Bosqich                                                                                                                       | Natija                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Umumiy tiplar va o'yin mantiqi (`packages/shared/src/mafia`, `apps/server/src/mafia/game.ts`) va testlar                      | Server'siz, sof holda to'liq o'ynaladigan o'yin mashinasi, har bir rasmiy qoida testlangan |
| 2   | Server xonasi, Socket.IO `/mafia`, Prisma modeli                                                                              | Socket orqali o'ynaladi, maxfiylik testlari o'tadi                                         |
| 3   | Minimal UI: lobbi, rol kartasi, stol, so'z navbati, ovoz berish, tun, natija (ovozsiz, navbatdagi o'yinchi matn bilan yozadi) | Brauzerda boshidan oxirigacha o'ynaladi                                                    |
| 4   | LiveKit ovoz siyosati: faqat navbatdagi o'yinchining mikrofoni, tanishuv tunining tungi kanali                                | Ovozli o'yin                                                                               |
| 5   | Dizayn va animatsiyalar: karta ag'darish, tun va tong, ovoz sanash, mobile sayqal                                             | Chiroyli, telefonda qulay                                                                  |
| 6   | `/mafia` bosh sahifasi, SEO, OG preview, monitoring, deploy                                                                   | Prod'da                                                                                    |

Har bir bosqich alohida commit va deploy qilinadi. Bosh sahifadan mafia'ga havola faqat 6-bosqichda qo'shiladi, undan oldin bo'lim yashirin turadi.

---

## 12. Ochiq savollar

Rasmiy qoidalar qabul qilingani uchun avvalgi savollarning ko'pi hal bo'ldi: rol oshkor qilinmaydi, birinchi tun tanishuv tuni, ovozlar ochiq, eng ko'p ovoz olgan chiqadi, o'liklar gapirmaydi. Qolganlari:

1. **10 kishi yig'ilmasa-chi?** Rasmiy o'yin aniq 10 kishi. Do'stlar orasida 7–9 kishi ham ko'p bo'ladi. Rasmiy bo'lmagan "do'stona stol" varianti kerakmi (masalan, 7–8 kishi: 2 qora = Don + 1 mafiya, 9 kishi: 3 qora)? Qoidalar o'zgarmaydi, faqat tarkib. _Taklif: MVP faqat rasmiy 10 kishi, variantni keyin qo'shamiz._
2. **Foll tizimi kerakmi?** Onlayn o'yinda navbatsiz gapirishni server o'zi to'xtatadi, lekin host haqorat yoki "belgi berish" uchun foll bera olsa foydali bo'lishi mumkin. _Taklif: keyinroq, host'ga foll tugmasi._
3. **Nomi:** "Mafia" qoladimi, yoki o'zbekcha nom kerakmi? Bo'lim manzili `/mafia`.
