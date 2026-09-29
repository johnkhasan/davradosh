# 🧩 Multiplayer Puzzle — Loyiha rejasi

> Bir necha kishi bir vaqtda, bitta umumiy stolda jigsaw puzzle yig'adi.
> Har bir ishtirokchining kursori Figmadagidek ismi va rangi bilan ko'rinadi.

- **Frontend:** https://puzzle.javohir.ru (Vercel)
- **Backend (API + WebSocket):** https://api.puzzle.javohir.ru (VPS `207.180.200.230`)
- **Ovoz/video (LiveKit):** https://rtc.puzzle.javohir.ru (xuddi shu VPS)
- **Room limiti:** bitta puzzle'ni bir vaqtda **ko'pi bilan 5 kishi** yig'adi (serverda qat'iy tekshiriladi)
- **Maqsadli yuklama (boshida):** bir vaqtda 10–15 foydalanuvchi (3 ta to'la room)

---

## 0. Umumiy arxitektura

```
                     ┌──────────────────────────────┐
  Brauzer ──HTTPS──▶ │ Vercel: puzzle.javohir.ru    │  Next.js (UI, sahifalar, OG image)
     │               └──────────────────────────────┘
     │
     │  REST (upload, room yaratish) + WebSocket (o'yin)
     ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ VPS: api.puzzle.javohir.ru  (Ubuntu 24.04, 4 vCPU, 7.8GB)   │
  │                                                             │
  │  Caddy :443 ──┬── /socket.io/*  → server:4000 (Socket.IO)   │
  │  (auto HTTPS) ├── /api/*        → server:4000 (Fastify)     │
  │               └── /uploads/*    → /var/lib/puzzle/uploads   │
  │                                                             │
  │  server (Node 22) ──▶ postgres:5432 (faqat ichki tarmoq)    │
  │                                                             │
  │  rtc.puzzle.javohir.ru → livekit:7880 (signal, WebSocket)   │
  │  livekit media: UDP 50000–60000, TCP 7881, TURN UDP 3478    │
  └─────────────────────────────────────────────────────────────┘
```

**Nega bunday bo'lingan:**
- Vercel serverless funksiyalari doimiy WebSocket ulanishini ushlab turolmaydi, shuning uchun realtime server VPS'da ishlaydi.
- Vercel'da so'rov tanasi (body) 4.5MB bilan cheklangan, shuning uchun rasm upload ham to'g'ridan-to'g'ri VPS'ga boradi.
- Vercel faqat frontend'ni beradi: tezkor CDN, preview deploylar va avtomatik HTTPS.

**Asosiy tamoyil:** server authoritative. Client faqat so'rov yuboradi ("shu bo'lakni olmoqchiman"), qarorni server qabul qiladi va hammaga tarqatadi.

---

## Texnologiyalar

| Qatlam | Tanlov |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Next.js 15 (App Router) + TypeScript |
| Canvas | PixiJS v8 (WebGL) |
| UI | Tailwind CSS v4 + shadcn/ui + Radix, Framer Motion |
| Client state | Zustand |
| Backend | Node 22 + Fastify + Socket.IO |
| DB | PostgreSQL 16 + Prisma |
| Rasm qayta ishlash | `sharp` (serverda), `browser-image-compression` (clientda) |
| Validatsiya | Zod (client va server uchun umumiy sxemalar) |
| Ovoz/video | LiveKit (self-hosted SFU) + `livekit-client` + `@livekit/components-react` |
| Reverse proxy | Caddy 2 |
| Konteynerlar | Docker + Docker Compose |
| CI/CD | GitHub Actions → GHCR → VPS (SSH) |
| Test | Vitest (unit), Playwright (e2e, multi-tab) |

---

## Loyiha tuzilmasi

```
puzzle-game/
├── apps/
│   ├── web/                      # Next.js → Vercel
│   │   ├── app/
│   │   │   ├── page.tsx                  # Landing
│   │   │   ├── create/page.tsx           # Yaratish wizard'i
│   │   │   └── room/[id]/page.tsx        # O'yin ekrani
│   │   ├── components/
│   │   │   ├── game/   (PuzzleCanvas, Cursors, Minimap, Toolbar, TopBar)
│   │   │   ├── create/ (ImagePicker, Cropper, SettingsStep, NameStep)
│   │   │   └── ui/     (shadcn)
│   │   ├── lib/        (socket client, api client)
│   │   └── stores/     (zustand: room, camera, user)
│   └── server/                   # Fastify + Socket.IO → VPS
│       ├── src/
│       │   ├── rooms/  (RoomManager, Room, locks, snap validation, persist)
│       │   ├── routes/ (rooms, uploads, gallery, health)
│       │   └── index.ts
│       ├── prisma/schema.prisma
│       └── Dockerfile
├── packages/
│   └── shared/                   # client + server umumiy kodi
│       ├── puzzle/   (seed → bo'lak shakllari, snap logikasi)
│       ├── events.ts (event nomlari + Zod sxemalar)
│       └── types.ts
├── deploy/
│   ├── docker-compose.yml
│   ├── Caddyfile
│   └── backup.sh
├── .github/workflows/
│   ├── ci.yml
│   └── deploy-server.yml
└── plan.md
```

---

# Bosqichlar

Har bir bosqich oxirida **"Tayyor bo'ldi"** mezonlari bor. Ular bajarilmaguncha keyingi bosqichga o'tilmaydi.

---

## 1-bosqich. Infratuzilma va DNS (0.5–1 kun)

Kod yozishdan oldin qilinadi, chunki DNS tarqalishi vaqt oladi.

### 1.1 DNS (javohir.ru domen panelida)
| Tur | Nom | Qiymat |
|---|---|---|
| CNAME | `puzzle` | `cname.vercel-dns.com` |
| A | `api.puzzle` | `207.180.200.230` |
| AAAA | `api.puzzle` | `2a02:c207:2333:7193::1` |
| A | `rtc.puzzle` | `207.180.200.230` (9-bosqich, LiveKit) |
| AAAA | `rtc.puzzle` | `2a02:c207:2333:7193::1` |

- [ ] Yozuvlar qo'shildi
- [ ] `dig puzzle.javohir.ru`, `dig api.puzzle.javohir.ru` va `dig rtc.puzzle.javohir.ru` to'g'ri javob qaytaradi

### 1.2 VPS tayyorgarligi
- [ ] Hozir ishlayotgan servislarni tekshirish: `ss -tulpn`, `docker ps`. 80 yoki 443 port band emasligiga ishonch hosil qilish (band bo'lsa, mavjud proxy'ga yangi host qo'shiladi)
- [ ] **Swap 4GB** (hozir yo'q, bu OOM'dan himoya qiladi):
  ```bash
  sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  sudo sysctl vm.swappiness=10 && echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf
  ```
- [ ] Alohida `deploy` foydalanuvchisi, faqat SSH key orqali kirish, `PasswordAuthentication no`
- [ ] Firewall:
  ```bash
  sudo ufw default deny incoming && sudo ufw default allow outgoing
  sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
  sudo ufw enable
  ```
- [ ] `fail2ban` o'rnatildi (SSH brute-force'dan himoya)
- [ ] Docker Engine va Compose plugin o'rnatildi, `deploy` foydalanuvchisi `docker` guruhiga qo'shildi
- [ ] Papkalar yaratildi: `/opt/puzzle` (compose), `/var/lib/puzzle/uploads`, `/var/backups/puzzle`
- [ ] Avtomatik xavfsizlik yangilanishlari: `unattended-upgrades`

### 1.3 Repo va hisoblar
- [ ] GitHub repo (`puzzle-game`)
- [ ] Vercel hisobi GitHub'ga ulandi
- [ ] Unsplash Developer hisobi (galereya uchun API key)

**✅ Tayyor bo'ldi:** DNS ishlaydi, VPS himoyalangan, swap bor, Docker o'rnatilgan.

---

## 2-bosqich. Loyiha skeleti (1–2 kun)

- [ ] pnpm monorepo + Turborepo, `apps/web`, `apps/server`, `packages/shared`
- [ ] TypeScript strict rejim, umumiy `tsconfig.base.json`
- [ ] ESLint + Prettier, Husky + lint-staged
- [ ] `apps/web`: Next.js 15, Tailwind v4, shadcn/ui, Google fontlar (Bricolage Grotesque + Inter)
- [ ] Dizayn tokenlari: ranglar, radius, soyalar, light va dark mode (6-bosqichga qarang)
- [ ] `apps/server`: Fastify, `/health` endpoint, Socket.IO ulangan
- [ ] Prisma sxema va birinchi migratsiya
- [ ] `docker-compose.dev.yml`: lokal Postgres
- [ ] `.env.example` fayllari (quyidagi "Environment o'zgaruvchilari" bo'limiga qarang)
- [ ] GitHub Actions `ci.yml`: lint, typecheck, test (har bir PR'da)

**✅ Tayyor bo'ldi:** `pnpm dev` web (:3000) va server (:4000) ni ishga tushiradi, web sahifa server'ning `/health` javobini ko'rsatadi, CI yashil.

---

## 3-bosqich. Puzzle dvigateli (single-player) (1–1.5 hafta)

Eng muhim va eng murakkab qism. Avval tarmoqsiz, bitta o'yinchi uchun mukammal ishlashi kerak.

### 3.1 Shakl generatsiyasi (`packages/shared/puzzle`)
- [ ] Seed asosidagi PRNG (masalan `mulberry32`)
- [ ] `generatePuzzle({cols, rows, seed, width, height})`: har bir ichki chegara uchun tab (chiqiq) yoki blank (o'yiq) tanlanadi, Bezier nuqtalari tasodifiy lekin tabiiy ko'rinadi
- [ ] Bir xil seed doim bir xil shaklni beradi (unit test bilan tekshiriladi)
- [ ] Bo'laklarning boshlang'ich tasodifiy joylashuvi: puzzle ramkasi atrofida, bir-birining ustiga kam tushadigan qilib

### 3.2 Chizish (`apps/web/components/game/PuzzleCanvas`)
- [ ] PixiJS Application, world container va kamera (pan/zoom)
- [ ] Har bir bo'lak Sprite + Graphics mask sifatida, shakllar RenderTexture'ga keshlanadi
- [ ] Bo'laklarga soya va ingichka bevel
- [ ] Stol foni (yog'och, kigiz, qorong'i, grid) va puzzle ramkasi (yig'ish joyi)
- [ ] Viewport'dan tashqaridagi bo'laklar chizilmaydi (culling)

### 3.3 Interaksiya
- [ ] Guruhni sudrash: ko'tarilganda scale 1.05, soya chuqurlashadi, eng yuqori qatlamga chiqadi
- [ ] Pan: bo'sh joyni sudrash, Space + drag, trackpad scroll
- [ ] Zoom: Ctrl + scroll yoki pinch, kursor nuqtasi atrofida
- [ ] Touch: bir barmoq bilan bo'lakni sudrash, ikki barmoq bilan pan va zoom
- [ ] Burilish (ixtiyoriy rejim): `R` yoki o'ng tugma bilan, mobil'da ikki marta bosish

### 3.4 Snap va guruhlash
- [ ] Guruh qo'yib yuborilganda uning chekkasidagi bo'laklarning qo'shnilari tekshiriladi
- [ ] Nisbiy pozitsiya xatosi bo'lak o'lchamining 15% idan kam va burilish bir xil bo'lsa, guruhlar birlashadi
- [ ] Bo'lak o'z to'g'ri joyiga (ramka ichiga) yaqin bo'lsa, u yerga "qotadi" (ixtiyoriy)
- [ ] Snap effekti: "klik" ovozi, chegarada yorug'lik, kichik bounce, mobil'da haptic
- [ ] Puzzle tugaganini aniqlash: barcha bo'laklar bitta guruhda bo'lishi

### 3.5 Yordamchi vositalar
- [ ] Asl rasm preview'i (`Tab` ni bosib turish)
- [ ] Faqat chekka bo'laklarni ajratish
- [ ] Bo'laklarni tartiblab joylash (scatter yoki tartibli grid)

**✅ Tayyor bo'ldi:** 100 bo'lakli puzzle desktop va telefonda silliq (60fps) yig'iladi, 500 bo'lakda ham 45fps dan past tushmaydi. Snap va guruhlash xatosiz ishlaydi. `shared/puzzle` unit testlari bor.

---

## 4-bosqich. Realtime multiplayer (1–1.5 hafta)

### 4.1 Server: Room tizimi
- [ ] `RoomManager`: xotirada `Map<roomId, Room>`, kerak bo'lganda room DB'dan yuklanadi
- [ ] `Room` holati: bo'laklar, guruhlar, lock'lar, foydalanuvchilar, boshlangan vaqt, statistika
- [ ] Persist: har 10 soniyada, har bir merge'da va room bo'shaganda holat Postgres'dagi `room_state` (JSONB) ga yoziladi
- [ ] Server qayta ishga tushganda aktiv room'lar DB'dan tiklanadi

### 4.2 Eventlar (`packages/shared/events.ts`, hammasi Zod bilan validatsiya qilinadi)
| Yo'nalish | Event | Payload |
|---|---|---|
| C→S | `room:join` | `{roomId, username, color, avatar, clientId}` |
| S→C | `room:state` | to'liq holat (qo'shilganda va reconnect'da) |
| S→C | `user:joined` / `user:left` / `user:updated` | `{user}` |
| C→S | `cursor:move` (volatile) | `{x, y}` world koordinatada |
| C→S | `viewport:update` (volatile) | `{x, y, w, h}` (minimap va follow uchun) |
| C→S | `piece:grab` | `{groupId}` |
| S→C | `piece:grabbed` / `piece:grab-denied` | `{groupId, userId}` |
| C→S | `piece:move` (volatile) | `{groupId, x, y}` |
| C→S | `piece:drop` | `{groupId, x, y, rotation}` |
| S→C | `piece:dropped` / `piece:merged` | `{groupId, x, y}` / `{from, into}` |
| S→C | `puzzle:completed` | `{durationMs, stats}` |
| C→S / S→C | `reaction` | `{emoji, x, y}` |
| C→S / S→C | `chat:message` | `{text}` |
| C→S | `host:kick` / `host:restart` | host huquqlari |

### 4.3 Lock va konfliktlar
- [ ] `piece:grab`: guruh bo'sh bo'lsa `lockedBy = userId`, band bo'lsa `grab-denied`
- [ ] Lock timeout 10 soniya (`piece:move` kelib tursa yangilanadi)
- [ ] Disconnect'da lock'lar darhol bo'shatiladi
- [ ] Merge va tugash tekshiruvi serverda bajariladi (`shared/puzzle` kodi bilan)
- [ ] Client optimistic ishlaydi, server rad etsa holat to'g'rilanadi (rollback)

### 4.4 Kursorlar (Figma uslubida)
- [ ] Yuborish 40ms da bir marta (throttle), `volatile`
- [ ] Qabul qiluvchi tomonda interpolatsiya: `perfect-cursors` yoki spline
- [ ] Kursor ko'rinishi: rangli o'q va ism yozilgan pill, bo'lak ushlab turganda 🧩 belgisi
- [ ] 5 soniya harakatsiz kursor xiralashadi
- [ ] Ushlangan guruh o'sha foydalanuvchi rangidagi outline bilan ko'rinadi

### 4.5 Barqarorlik
- [ ] Reconnect: `clientId` (localStorage) orqali xuddi shu foydalanuvchi sifatida qaytadi, `room:state` qayta yuboriladi
- [ ] Ulanish holati indikatori UI'da ("Qayta ulanmoqda…")
- [ ] Rate limit: bitta socket uchun sekundiga ~60 event, oshsa e'tiborsiz qoldiriladi
- [ ] **Room limiti 5 kishi:** `room:join` da serverda tekshiriladi (`MAX_PLAYERS_PER_ROOM=5`). 6-kishi "Room to'la" ekranini ko'radi: "5/5 o'yinchi. Joy bo'shashini kutish yoki o'z puzzle'ingizni yaratish"
- [ ] Reconnect qilayotgan foydalanuvchi uchun joy 30 soniya band turadi (uning o'rnini boshqa odam egallab qo'ymaydi)
- [ ] TopBar'da `3/5` ko'rinishidagi o'yinchilar hisoblagichi

**✅ Tayyor bo'ldi:** 3 ta brauzer oynasida (bittasi telefon) bir vaqtda o'ynaganda kursorlar silliq harakatlanadi, bitta bo'lakni ikki kishi ushlay olmaydi, server restart'dan keyin o'yin davom etadi. Playwright multi-tab e2e testi bor.

---

## 5-bosqich. Room yaratish oqimi va rasm (1 hafta)

### 5.1 Username tizimi (ro'yxatdan o'tmasdan)
- [ ] Modal: ism (2–20 belgi), 12 ta rangdan biri, avatar emoji
- [ ] 🎲 tasodifiy ism tugmasi ("Chaqqon Tulki", "Aqlli Boyqush", …)
- [ ] `localStorage` da saqlanadi, keyingi safar avtomatik to'ldiriladi
- [ ] Room ichida bir xil ism bo'lsa oxiriga raqam qo'shiladi ("Aziz 2")
- [ ] Ism sanitizatsiya qilinadi (HTML va boshqaruv belgilari olib tashlanadi)

### 5.2 Rasm tanlash
- [ ] **Galereya:** Unsplash API orqali kategoriyalar (Tabiat, Shaharlar, Hayvonlar, San'at, O'zbekiston). Server javoblarni keshlaydi, Unsplash atributsiyasi ko'rsatiladi
- [ ] **Yuklash:** drag & drop, Ctrl+V, telefon kamerasi
- [ ] Clientda: eng ko'pi 2048px, WebP formatga o'tkazish, crop tool (4:3, 16:9, 1:1, 3:4)
- [ ] Serverda (`POST /api/uploads`): hajm limiti 10MB, magic-bytes orqali tur tekshiruvi, `sharp` bilan qayta kodlash (bu EXIF'ni ham tozalaydi), 2048px + 400px thumbnail
- [ ] Fayllar `/var/lib/puzzle/uploads/{id}.webp` ga yoziladi, Caddy ularni `Cache-Control: immutable` bilan beradi

### 5.3 Yaratish wizard'i (`/create`)
1. **Rasm:** galereya yoki upload
2. **Sozlamalar:** bo'laklar soni (24 / 48 / 100 / 200 / 500) va taxminiy vaqt, burilish rejimi, maksimal o'yinchilar (2–5, standart 5). O'ng tomonda jonli grid preview
3. **Ism:** agar hali tanlanmagan bo'lsa

- [ ] `POST /api/rooms` qisqa ID (nanoid, 8 belgi) qaytaradi va host `/room/{id}` ga o'tadi

### 5.4 Taklif qilish
- [ ] "Taklif qilish" modali: link, nusxalash tugmasi, QR kod, mobil'da Web Share API
- [ ] Link: `https://puzzle.javohir.ru/room/k7xP2a9Q`
- [ ] **OG image** (`app/room/[id]/opengraph-image.tsx`): rasm thumbnail'i va "Puzzle'ni birga yig'amiz!" yozuvi. Telegram'da chiroyli preview chiqadi
- [ ] Linkni ochgan odamda ism tanlanmagan bo'lsa, avval ism modali chiqadi, keyin u room'ga kiradi

**✅ Tayyor bo'ldi:** yangi foydalanuvchi landing'dan 30 soniyadan kamroq vaqtda room yaratib, linkni Telegram'da ulasha oladi, preview chiroyli chiqadi.

---

## 6-bosqich. UI/UX va polish (1–1.5 hafta)

### 6.1 Dizayn tizimi
- **Kayfiyat:** o'yinqaroq, lekin tartibli (Duolingo'ning quvnoqligi + Figma'ning aniqligi)
- **Shriftlar:** Bricolage Grotesque (sarlavhalar), Inter (matn)
- **Ranglar:** asosiy `#6C5CE7`, muvaffaqiyat `#FFB020`, snap `#00C2A8`, 12 ta yuqori kontrastli kursor rangi
- **Shakl:** radius 12–16px, yumshoq ko'p qatlamli soyalar, light va dark mode

### 6.2 Ekranlar
- [ ] **Landing:** hero'da jonli demo (soxta kursorlar "Malika", "Jasur" bo'laklarni yig'adi), bitta asosiy CTA "Puzzle yaratish", yonida "Kod bilan kirish" maydoni, "Qanday ishlaydi" 3 qadami
- [ ] **O'yin ekrani:**
  ```
  ┌────────────────────────────────────────────────────────────┐
  │ 🧩 Registon · 47/100 ████████░░░ 47%  ⏱ 12:34             │
  │                          (A)(M)(J)+2   [🔗 Taklif qilish]   │
  ├──┬─────────────────────────────────────────────────────────┤
  │🖼│        ╭──────────╮                ▲ Malika              │
  │🔲│        │  puzzle  │     ▲ Aziz                           │
  │🎯│        │  ramkasi │  [bo'laklar tarqalgan]               │
  │💬│        ╰──────────╯                          ┌────────┐  │
  │  │  😀 🎉 👏 🔥                 [-] 100% [+] [⤢] │minimap │  │
  └──┴──────────────────────────────────────────────└────────┘──┘
  ```
- [ ] **Avatarlar:** bosilganda **Follow rejimi** yoqiladi (o'sha odamning viewport'ini kuzatish, ekran chetida uning rangidagi ramka). `Esc` bilan chiqiladi
- [ ] **Minimap:** hamma o'yinchilarning viewport'lari ularning rangidagi to'rtburchak sifatida
- [ ] **Reaksiyalar:** `E` yoki panel orqali, emoji kursordan uchib chiqadi
- [ ] **Chat:** yon panel, o'qilmagan xabarlar badge'i
- [ ] **Yakun ekrani:** rasm "yopishadi", konfetti, umumiy vaqt, kim nechta bo'lak birlashtirgani (bar chart), "MVP" nishoni, "Yana o'ynash", "Rasmni yuklab olish", "Ulashish"

### 6.3 Mikro-interaksiyalar va ovoz
- [ ] Kimdir qo'shilganda toast ("👋 Malika qo'shildi") va avatar animatsiyasi
- [ ] Progress bar har bir snap'da "sakrab" to'ladi, 25%, 50% va 75% da kichik bayram effekti
- [ ] Ovozlar: pick, snap, join, complete. Mute tugmasi, sozlama eslab qolinadi
- [ ] Skeleton va loading holatlari, bo'sh holat va xato ekranlari (404 room, room to'la, ulanish uzildi)

### 6.4 Accessibility va mobil
- [ ] Klaviatura bilan navigatsiya, fokus ko'rinib turadi
- [ ] `prefers-reduced-motion` qo'llab-quvvatlanadi
- [ ] Faqat rangga tayanilmaydi (kursorda ism doim ko'rinadi)
- [ ] Mobil layout: toolbar pastga tushadi, minimap yig'iladi, touch target'lar 44px dan kichik emas
- [ ] Klaviatura yorliqlari yordami (`?` tugmasi)

**✅ Tayyor bo'ldi:** Lighthouse'da Performance 90+ va Accessibility 95+. iPhone Safari, Android Chrome, desktop Chrome, Safari va Firefox'da test qilindi.

---

## 7-bosqich. Deploy (1–2 kun)

### 7.1 Backend → VPS

**`deploy/docker-compose.yml`**
```yaml
services:
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports: ["80:80", "443:443", "443:443/udp"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - /var/lib/puzzle/uploads:/srv/uploads:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [server]

  server:
    image: ghcr.io/<github-user>/puzzle-server:latest
    restart: unless-stopped
    env_file: .env
    volumes:
      - /var/lib/puzzle/uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
    deploy:
      resources:
        limits: { memory: 1g }

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    env_file: .env
    volumes: [pg_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER"]
      interval: 5s
      retries: 10
    deploy:
      resources:
        limits: { memory: 512m }

volumes:
  caddy_data:
  caddy_config:
  pg_data:
```

**`deploy/Caddyfile`**
```caddy
api.puzzle.javohir.ru {
    encode zstd gzip

    handle_path /uploads/* {
        root * /srv/uploads
        header Cache-Control "public, max-age=31536000, immutable"
        header Access-Control-Allow-Origin "https://puzzle.javohir.ru"
        file_server
    }

    handle {
        reverse_proxy server:4000
    }

    request_body {
        max_size 12MB
    }
}
```
Caddy WebSocket'ni avtomatik o'tkazadi, qo'shimcha sozlama kerak emas.

- [ ] `apps/server/Dockerfile`: multi-stage build, `node:22-alpine`, non-root user, `prisma migrate deploy` konteyner ishga tushganda bajariladi
- [ ] Server CORS va Socket.IO `cors.origin`: `https://puzzle.javohir.ru` (va Vercel preview domenlari)
- [ ] `/opt/puzzle` ga `docker-compose.yml`, `Caddyfile` va `.env` joylashtirildi (`.env` ruxsati `chmod 600`)
- [ ] `docker compose up -d` ishga tushirildi, `https://api.puzzle.javohir.ru/health` → `200`

**CI/CD: `.github/workflows/deploy-server.yml`** (`main` ga push qilinganda, faqat `apps/server/**` yoki `packages/shared/**` o'zgarsa)
1. Docker image build qilinadi va `ghcr.io/<user>/puzzle-server:{sha}` hamda `:latest` sifatida push qilinadi
2. SSH orqali VPS'da `cd /opt/puzzle && docker compose pull server && docker compose up -d server` bajariladi
3. `/health` tekshiriladi, xato bo'lsa oldingi tag'ga qaytiladi (rollback)

GitHub Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`

### 7.2 Frontend → Vercel
- [ ] Vercel'da yangi loyiha: GitHub repo, **Root Directory: `apps/web`**, framework Next.js, pnpm
- [ ] Environment o'zgaruvchilari (Production va Preview): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`
- [ ] Domains: `puzzle.javohir.ru` qo'shildi, Vercel DNS'ni tasdiqladi va SSL chiqardi
- [ ] `next.config.ts` → `images.remotePatterns`: `api.puzzle.javohir.ru` va `images.unsplash.com`
- [ ] "Ignored Build Step": faqat `apps/web` yoki `packages/shared` o'zgarsa build qilinadi
- [ ] Har bir PR uchun preview URL avtomatik yaratiladi (server CORS preview domenlarini qabul qiladi)

### 7.3 Backup va monitoring
- [ ] `deploy/backup.sh` (cron, har kuni 03:00):
  ```bash
  docker compose exec -T postgres pg_dump -U puzzle puzzle | gzip > /var/backups/puzzle/db-$(date +%F).sql.gz
  tar czf /var/backups/puzzle/uploads-$(date +%F).tgz -C /var/lib/puzzle uploads
  find /var/backups/puzzle -mtime +14 -delete
  ```
- [ ] Backup'larni server tashqarisiga ham ko'chirish (masalan, `rclone` bilan Google Drive'ga, haftasiga bir marta)
- [ ] Uptime monitoring: UptimeRobot yoki BetterStack (bepul) `/health` ni kuzatadi, Telegram'ga xabar yuboradi
- [ ] Xatolarni kuzatish: Sentry (bepul tarif), web va server uchun
- [ ] Docker log rotatsiyasi (`/etc/docker/daemon.json` → `max-size: 10m`, `max-file: 3`)
- [ ] Tozalash cron'i: `expiresAt` o'tgan room'lar va ularga tegishli rasmlar o'chiriladi (har kuni)

**✅ Tayyor bo'ldi:** `https://puzzle.javohir.ru` ochiladi, room yaratiladi, boshqa qurilmadan link orqali kirib birga o'ynash mumkin. `main` ga push qilish avtomatik deploy qiladi. Backup ishlayapti.

---

## 8-bosqich. Launch va test (2–3 kun)

- [ ] Haqiqiy test: 3 ta room × 5 kishi (jami 15), 100 va 200 bo'lakli puzzle'lar
- [ ] 6-kishi kirishga uringanda "Room to'la" ekrani chiqishi tekshiriladi
- [ ] Yuklama testi: skript bilan 6 ta room × 5 ta soxta client (kursor + bo'lak harakati), server CPU va RAM kuzatiladi
- [ ] Sekin tarmoq (DevTools "Slow 4G") va uzilib-ulanish holatlarida test
- [ ] Topilgan xatolar tuzatiladi
- [ ] Analytics (ixtiyoriy): Vercel Analytics yoki Umami (VPS'ga self-host)

---

## 9-bosqich. Ovoz va video: LiveKit, self-hosted (1–1.5 hafta)

> MVP (1–8-bosqichlar) ishga tushib, barqaror ishlagandan keyin qilinadi.

### 9.1 Nega LiveKit va nega SFU
- P2P (mesh) usulida har kim har kimga alohida oqim yuboradi. SFU'da esa har kim **bitta** oqim yuboradi, server uni boshqalarga tarqatadi. Bu telefon va sekin internet uchun ancha yengil.
- LiveKit ochiq kodli va bepul. Uning TURN serveri, simulcast, adaptive stream, React SDK'si tayyor holda keladi.
- Room'da ko'pi bilan 5 kishi bo'lgani uchun **hammaning videosini bir vaqtda ko'rsatish mumkin**.

### 9.2 Resurs hisobi
| Holat | Server chiqish trafigi | CPU |
|---|---|---|
| 1 room, 5 kishi, faqat ovoz | ~1 Mbps | ~2% |
| 1 room, 5 kishi, ovoz + video (360p, simulcast) | ~6 Mbps | ~5–10% |
| 3 room (15 kishi), ovoz + video | ~18–20 Mbps | ~20–30% |

- [ ] Hosting provayderdan port tezligi va oylik trafik limiti aniqlanadi. Taxminiy hisob: 15 kishi kuniga 2 soat videoli o'ynasa, oyiga ~500GB

### 9.3 Infratuzilma
- [ ] DNS: `rtc.puzzle.javohir.ru` → VPS (1.1-bo'limda qo'shilgan)
- [ ] Firewall:
  ```bash
  sudo ufw allow 7881/tcp            # WebRTC TCP fallback
  sudo ufw allow 3478/udp            # TURN (NAT orqasidagilar uchun)
  sudo ufw allow 50000:60000/udp     # WebRTC media
  ```
- [ ] `deploy/livekit.yaml`:
  ```yaml
  port: 7880
  bind_addresses: ["0.0.0.0"]
  rtc:
    tcp_port: 7881
    port_range_start: 50000
    port_range_end: 60000
    use_external_ip: true
  turn:
    enabled: true
    udp_port: 3478
    domain: rtc.puzzle.javohir.ru
  room:
    max_participants: 5          # puzzle room limiti bilan bir xil
    empty_timeout: 300           # bo'sh room 5 daqiqadan keyin yopiladi
  keys:
    ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}
  logging:
    level: info
  ```
- [ ] `docker-compose.yml` ga qo'shiladi (UDP portlar ko'p bo'lgani uchun LiveKit tavsiya qilganidek host network'da):
  ```yaml
  livekit:
    image: livekit/livekit-server:latest
    restart: unless-stopped
    network_mode: host
    command: --config /etc/livekit.yaml
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml:ro
    deploy:
      resources:
        limits: { memory: 1g }
  ```
  Bunda `caddy` servisiga `extra_hosts: ["host.docker.internal:host-gateway"]` qo'shiladi.
- [ ] `Caddyfile` ga signal uchun (WebSocket va HTTPS) yangi blok:
  ```caddy
  rtc.puzzle.javohir.ru {
      reverse_proxy host.docker.internal:7880
  }
  ```
- [ ] `livekit-cli load-test` yoki `https://livekit.io/connection-test` bilan ulanish tekshiriladi

### 9.4 Server: token va room boshqaruvi
- [ ] `livekit-server-sdk` o'rnatiladi
- [ ] `POST /api/rooms/:id/rtc-token`:
  - foydalanuvchi shu puzzle room'ga socket orqali qo'shilganligi tekshiriladi (`clientId` va socket sessiyasi)
  - `AccessToken`: `identity = clientId`, `name = username`, `metadata = {color, avatar}`
  - huquqlar: `roomJoin`, `canPublish`, `canSubscribe`, `canPublishData: false`. Room nomi puzzle room ID'si bilan bir xil
  - `ttl = 2h`
- [ ] Host huquqlari `RoomServiceClient` orqali:
  - `POST /api/rooms/:id/rtc/mute-all`: barcha mikrofonlarni o'chiradi (qayta yoqish faqat foydalanuvchining o'zida)
  - `POST /api/rooms/:id/rtc/disable-camera/:userId`
- [ ] Kick qilingan foydalanuvchi LiveKit'dan ham chiqariladi (`removeParticipant`)
- [ ] Puzzle room o'chirilganda LiveKit room ham o'chiriladi

### 9.5 Client: ulanish va qurilmalar
- [ ] `livekit-client` + `@livekit/components-react`
- [ ] **Pre-join ekrani** (ism modalidan keyin, ixtiyoriy): mikrofon va kamera tanlash, ovoz balandligi indikatori (mikrofon testi), kamera preview, "Ovozsiz kirish" tugmasi
- [ ] **Room'ga mikrofon va kamera o'chiq holatda kiriladi.** Ruxsat faqat foydalanuvchi tugmani bosganda so'raladi
- [ ] Ruxsat berilmasa tushunarli xabar: "Mikrofonga ruxsat berilmagan. Brauzer manzil satridagi 🔒 belgisini bosing → Mikrofon → Ruxsat berish" (brauzerga qarab ko'rsatma)
- [ ] Audio sozlamalari: `echoCancellation`, `noiseSuppression`, `autoGainControl`
- [ ] `adaptiveStream: true`, `dynacast: true`, video uchun simulcast (180p, 360p)
- [ ] iOS Safari: agar ovoz bloklangan bo'lsa "🔊 Ovozni yoqish" tugmasi ko'rsatiladi (`room.startAudio()`)
- [ ] Ulanish sifati indikatori (avatar yonida signal belgisi: yaxshi, o'rtacha, yomon)
- [ ] LiveKit ulanmasa ham puzzle o'yini davom etadi (ovoz/video ixtiyoriy qatlam)

### 9.6 Boshqaruv va klaviatura
| Harakat | Yorliq | UI |
|---|---|---|
| Mikrofonni yoqish/o'chirish | `M` | Pastki panelda 🎙 tugma |
| Kamerani yoqish/o'chirish | `V` | 📷 tugma |
| Push-to-talk | `T` ni bosib turish | Sozlamalarda yoqiladi |
| Fazoviy ovozni yoqish/o'chirish | — | Sozlamalar |
| Video pufakchalarni yig'ish | `Shift + V` | ▾ tugma |

> ⚠️ `Space` pan uchun band (3.3), shuning uchun push-to-talk `T` ga beriladi.

### 9.7 UX: puzzle'ga moslashgan ovoz va video
- [ ] **Gapirayotgan kishining kursori "nafas oladi":** `participant.audioLevel` ga qarab kursor pill'i atrofida o'sha odam rangidagi yorug'lik halqasi kattalashadi va kichrayadi. TopBar'dagi avatarda ham xuddi shu effekt
- [ ] Mikrofoni o'chiq odamning kursor pill'ida kichik 🔇 belgisi
- [ ] **Video pufakchalar:** o'ng pastki burchakda 5 tagacha dumaloq video (96px). Ularni sudrash, yig'ish va kattalashtirish mumkin (bosilganda 240px). Gapirayotgan kishining pufakchasi biroz kattalashadi. Kamerasi o'chiq odam uchun avatar emoji ko'rsatiladi
- [ ] **Video kursorga yopishadi (ixtiyoriy, "wow" rejimi):** har bir odamning yuzi kichik doira (48px) ichida uning kursori yonida harakatlanadi. Kursor interpolatsiyasi bilan bir xil silliqlikda
- [ ] **Fazoviy ovoz (spatial audio):** world koordinatalarida kursorlar orasidagi masofaga qarab ovoz balandligi o'zgaradi (`RemoteAudioTrack.setVolume`), yaqin 100%, uzoq ~25%. Ovoz hech qachon butunlay o'chmaydi. Standart holatda o'chiq, sozlamalardan yoqiladi
- [ ] "Aziz mikrofonni yoqdi" kabi toast'lar ko'rsatilmaydi (ortiqcha shovqin). Faqat kursor va avatar effektlari
- [ ] **Host paneli:** "Hammani mute qilish", har bir o'yinchi menyusida "Kamerani o'chirish"
- [ ] Mobil: video pufakchalar tepada gorizontal qatorda, "kursorga yopishgan video" rejimi o'chiq
- [ ] `prefers-reduced-motion` yoqilgan bo'lsa "nafas olish" animatsiyasi o'rniga oddiy statik halqa ko'rsatiladi

### 9.8 Test
- [ ] 5 ta qurilma (kamida 2 tasi telefonda, 1 tasi mobil internetda 4G) bir room'da: ovoz kechikishi 300ms dan kam, aks-sado (echo) yo'q
- [ ] Korporativ yoki qattiq Wi-Fi'da TURN orqali ulanish ishlashi
- [ ] Wi-Fi ↔ 4G almashganda avtomatik qayta ulanish
- [ ] 3 ta room × 5 kishi, hammasi videoli: server CPU 50% dan past, trafik kuzatiladi
- [ ] Safari (macOS va iOS), Chrome (Android va desktop), Firefox

**✅ Tayyor bo'ldi:** 5 kishi puzzle yig'ayotib bir-birini eshitadi va ko'radi, kim gapirayotgani kursoridan bilinadi. Ovoz/video uzilsa ham o'yin to'xtamaydi.

---

## Environment o'zgaruvchilari

**VPS: `/opt/puzzle/.env`**
```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://puzzle:<parol>@postgres:5432/puzzle
POSTGRES_USER=puzzle
POSTGRES_PASSWORD=<kuchli-parol>
POSTGRES_DB=puzzle
CORS_ORIGINS=https://puzzle.javohir.ru
MAX_PLAYERS_PER_ROOM=5
LIVEKIT_URL=wss://rtc.puzzle.javohir.ru
LIVEKIT_API_KEY=<key>
LIVEKIT_API_SECRET=<kamida-32-belgili-secret>
UPLOAD_DIR=/app/uploads
PUBLIC_UPLOAD_URL=https://api.puzzle.javohir.ru/uploads
UNSPLASH_ACCESS_KEY=<key>
SENTRY_DSN=<dsn>
```

**Vercel**
```env
NEXT_PUBLIC_API_URL=https://api.puzzle.javohir.ru
NEXT_PUBLIC_WS_URL=wss://api.puzzle.javohir.ru
NEXT_PUBLIC_LIVEKIT_URL=wss://rtc.puzzle.javohir.ru
NEXT_PUBLIC_SENTRY_DSN=<dsn>
```

---

## Ma'lumotlar bazasi (Prisma)

```prisma
model Room {
  id          String     @id               // nanoid(8)
  hostId      String                       // host'ning clientId'si
  imageId     String
  image       Image      @relation(fields: [imageId], references: [id])
  cols        Int
  rows        Int
  seed        Int
  rotation    Boolean    @default(false)
  maxPlayers  Int        @default(5)    // 2..5, serverda max 5 bilan cheklanadi
  status      RoomStatus @default(PLAYING)
  state       Json?                        // bo'laklar va guruhlar snapshot'i
  stats       Json?                        // kim nechta bo'lak birlashtirgani
  createdAt   DateTime   @default(now())
  completedAt DateTime?
  expiresAt   DateTime                     // yaratilgandan 7 kun keyin
  @@index([expiresAt])
}

model Image {
  id        String   @id
  source    String                         // "upload" | "unsplash"
  url       String
  thumbUrl  String
  width     Int
  height    Int
  credit    String?                        // Unsplash atributsiyasi
  createdAt DateTime @default(now())
  rooms     Room[]
}

enum RoomStatus { PLAYING COMPLETED }
```

---

## Xavfsizlik

- [ ] Barcha socket eventlar va REST so'rovlari Zod bilan validatsiya qilinadi
- [ ] Rate limit: REST uchun `@fastify/rate-limit` (upload uchun bitta IP'dan soatiga 20 ta), socket uchun token bucket
- [ ] Upload: magic-bytes tekshiruvi, `sharp` bilan qayta kodlash, fayl nomi foydalanuvchidan olinmaydi
- [ ] Ism va chat matni sanitizatsiya qilinadi, React tomonidan escape qilinadi, uzunlik cheklangan
- [ ] Host huquqlari (kick, restart, hammani mute qilish) serverda `hostId` orqali tekshiriladi
- [ ] LiveKit token faqat serverda yaratiladi, `LIVEKIT_API_SECRET` hech qachon client'ga chiqmaydi. Token faqat puzzle room'ga socket orqali qo'shilgan foydalanuvchiga beriladi, amal qilish muddati 2 soat
- [ ] Postgres porti tashqariga ochilmaydi, secret'lar faqat `.env` va GitHub Secrets'da saqlanadi
- [ ] HTTP xavfsizlik header'lari (Vercel `headers()` va Caddy orqali)

---

## Xavflar va yechimlar

| Xavf | Yechim |
|---|---|
| 500 bo'lakda sekinlashish | WebGL, texture keshi, culling. 3-bosqichda o'lchab ko'riladi |
| Tarmoq kechikishi | Optimistic UI, interpolatsiya, server rollback |
| VPS o'chib qolishi | `restart: unless-stopped`, holat Postgres'da, uptime monitor Telegram'ga xabar beradi |
| Serverda RAM tugashi | Swap 4GB, konteynerlarga xotira limiti |
| Spam va noo'rin rasmlar | Rate limit, room'lar 7 kundan keyin o'chiriladi, kelajakda moderatsiya API |
| Vercel ↔ VPS CORS xatolari | `CORS_ORIGINS` aniq ro'yxat bilan, preview domenlari uchun regex |
| Ovoz/video trafigi | 5 kishilik room ~6 Mbps. Simulcast, adaptive stream va dynacast yoqiladi, kamera standart holatda o'chiq |
| NAT yoki qattiq firewall orqasidagi foydalanuvchilar | LiveKit ichidagi TURN (UDP 3478) va TCP 7881 fallback. Kerak bo'lsa TURN/TLS 5349 |
| iOS Safari ovozni avtomatik chalmaydi | "Ovozni yoqish" tugmasi (`room.startAudio()`) foydalanuvchi bosganda |
| Kelajakda foydalanuvchilar ko'payishi | Socket.IO Redis adapter va bir nechta instance, rasmlar uchun Cloudflare CDN |

---

## Umumiy muddat

| # | Bosqich | Muddat |
|---|---|---|
| 1 | Infratuzilma va DNS | 0.5–1 kun |
| 2 | Loyiha skeleti | 1–2 kun |
| 3 | Puzzle dvigateli | 1–1.5 hafta |
| 4 | Realtime multiplayer | 1–1.5 hafta |
| 5 | Yaratish oqimi va rasm | 1 hafta |
| 6 | UI/UX polish | 1–1.5 hafta |
| 7 | Deploy | 1–2 kun |
| 8 | Launch va test | 2–3 kun |
| | **Jami (MVP)** | **~6–7 hafta** |
| 9 | Ovoz va video (LiveKit) | 1–1.5 hafta |
| | **Jami (ovoz/video bilan)** | **~7–8.5 hafta** |

> 💡 **Tavsiya:** 7-bosqichdagi deploy'ning bir qismini 2-bosqichdan keyinoq qilib qo'yish kerak (bo'sh skeletni ham deploy qilish). Shunda CORS, WebSocket va HTTPS muammolari oxirida emas, boshida chiqadi.

---

## Kelajakdagi g'oyalar (MVP'dan keyin)

- Google yoki Telegram login, profil, o'ynalgan puzzle'lar tarixi
- "Kunlik puzzle": hamma bitta rasmni yig'adi, reyting jadvali bilan
- Jamoaviy musobaqa: 2 jamoa bir xil puzzle'ni parallel yig'adi
- Puzzle'ni rasm sifatida saqlash va "yig'ilgan puzzle'lar" galereyasi
- PWA: telefon ekraniga o'rnatish
