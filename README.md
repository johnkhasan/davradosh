# 🧩 Puzzle — birga yig'amiz

Multiplayer jigsaw puzzle: 5 kishigacha bitta puzzle'ni real vaqtda birga yig'adi,
har kimning kursori Figmadagidek ismi bilan ko'rinadi.

- Frontend: https://puzzle.javohir.ru (Vercel)
- Backend: https://api.puzzle.javohir.ru (VPS, Docker Compose)

To'liq reja: [plan.md](./plan.md) · Deploy: [deploy/README.md](./deploy/README.md)

## Tuzilma

| Papka             | Nima                                                                  |
| ----------------- | --------------------------------------------------------------------- |
| `apps/web`        | Next.js 16 frontend (PixiJS canvas, Tailwind v4)                      |
| `apps/server`     | Fastify + Socket.IO o'yin serveri, Prisma + PostgreSQL                |
| `packages/shared` | Client va server uchun umumiy kod (konstanta, tip, puzzle generatori) |

## Lokal ishga tushirish

Talablar: Node 22, pnpm 10, Docker.

```bash
pnpm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local

# PostgreSQL ixtiyoriy: DATABASE_URL bo'lmasa room'lar xotirada saqlanadi
pnpm db:up                                   # lokal Postgres (docker)
pnpm --filter @puzzle/server db:migrate      # migratsiyalar
pnpm dev                                     # web :3000, server :4000
```

## Buyruqlar

| Buyruq           | Nima qiladi                  |
| ---------------- | ---------------------------- |
| `pnpm dev`       | Hamma ilovalarni dev rejimda |
| `pnpm build`     | Production build             |
| `pnpm lint`      | ESLint / tsc                 |
| `pnpm typecheck` | TypeScript tekshiruvi        |
| `pnpm test`      | Vitest testlari              |
| `pnpm format`    | Prettier bilan formatlash    |
