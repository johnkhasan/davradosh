# Deploy qo'llanmasi

| Qism                      | Qayerda                      | Manzil                   |
| ------------------------- | ---------------------------- | ------------------------ |
| Frontend (Next.js)        | Vercel                       | https://davradosh.uz     |
| API + WebSocket + rasmlar | VPS, `/srv/puzzle` (Compose) | https://api.davradosh.uz |
| Ovoz/video (LiveKit)      | VPS, `/srv/puzzle` (Compose) | wss://rtc.davradosh.uz   |

Eski manzillar (`puzzle.javohir.ru` davradosh.uz'ga 308 bilan yo'naltiriladi,
`api.puzzle.javohir.ru`, `rtc.puzzle.javohir.ru`) ishlab turishi shart: eski rasmlar
bazada shu manzil bilan saqlangan, mobil test buildlar ham shunga ulangan.

VPS'da 80/443 portlarni umumiy `hsbch-nginx-1` konteyneri boshqaradi (boshqa
loyihalar ham shu orqali ishlaydi). Puzzle unga `server` bloklari bilan ulanadi:
[`nginx/davradosh.conf`](./nginx/davradosh.conf) (yangi manzillar, sertifikat
`/srv/hsbch/certs/davradosh.uz`) va [`nginx/puzzle.conf`](./nginx/puzzle.conf) (eski manzillar).

```
Internet ─▶ hsbch-nginx-1 (443, TLS) ─┬─ api.davradosh.uz, api.puzzle ─▶ puzzle-server:4000  (hsbch_default tarmog'i)
                                      └─ rtc.davradosh.uz, rtc.puzzle ─▶ 172.18.0.1:7880     (puzzle-livekit, host tarmog'i)
puzzle-server ─▶ puzzle-postgres (ichki tarmoq)
WebRTC media: UDP 50000–60000, TCP 7881, TURN UDP 3478 (to'g'ridan-to'g'ri LiveKit'ga)
```

## 1. DNS

| Tur   | Nom          | Qiymat                   |
| ----- | ------------ | ------------------------ |
| CNAME | `puzzle`     | `cname.vercel-dns.com`   |
| A     | `api.puzzle` | `207.180.200.230`        |
| AAAA  | `api.puzzle` | `2a02:c207:2333:7193::1` |
| A     | `rtc.puzzle` | `207.180.200.230`        |
| AAAA  | `rtc.puzzle` | `2a02:c207:2333:7193::1` |

## 2. Server tayyorgarligi (bir marta, root)

```bash
# Swap 4 GB
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf && sysctl --system

# Papkalar (server konteyneri UID 10001 nomidan yozadi)
mkdir -p /srv/puzzle/uploads /var/backups/puzzle
chown deploy:deploy /srv/puzzle /var/backups/puzzle
chown 10001:10001 /srv/puzzle/uploads

# Sozlamalar: deploy/.env.example → /srv/puzzle/.env (parollar: openssl rand -hex 32)
chmod 600 /srv/puzzle/.env && chown deploy:deploy /srv/puzzle/.env
```

## 3. TLS sertifikat va nginx

```bash
# Ikkala nom bitta sertifikatda (port 80 challenge'ni umumiy nginx beradi)
certbot certonly --webroot -w /srv/certbot-webroot \
  -d api.puzzle.javohir.ru -d rtc.puzzle.javohir.ru --cert-name puzzle.javohir.ru

mkdir -p /srv/hsbch/certs/puzzle.javohir.ru
install -m 644 /etc/letsencrypt/live/puzzle.javohir.ru/fullchain.pem /srv/hsbch/certs/puzzle.javohir.ru/
install -m 600 /etc/letsencrypt/live/puzzle.javohir.ru/privkey.pem   /srv/hsbch/certs/puzzle.javohir.ru/
```

Yangilanishda nusxalash uchun `/etc/letsencrypt/renewal-hooks/deploy/hsbch-nginx-certs.sh`
dagi `case` ga qo'shing:

```sh
  */puzzle.javohir.ru)
    DEST=/srv/hsbch/certs/puzzle.javohir.ru
    ;;
```

nginx bloklarini qo'shish (avval backup, keyin tekshiruv, keyin reload):

```bash
cp /srv/hsbch/nginx.conf /srv/hsbch/nginx.conf.bak-$(date +%s)
cat /srv/puzzle/nginx/puzzle.conf >> /srv/hsbch/nginx.conf
docker exec hsbch-nginx-1 nginx -t && docker exec hsbch-nginx-1 nginx -s reload
```

## 4. Ishga tushirish

```bash
cd /srv/puzzle
docker compose pull && docker compose up -d
curl https://api.puzzle.javohir.ru/health   # {"status":"ok","db":true,...}
```

## 5. GitHub Actions orqali avtomatik deploy

Repo → **Settings → Secrets and variables → Actions**:

| Tur      | Nom              | Qiymat                                              |
| -------- | ---------------- | --------------------------------------------------- |
| Secret   | `VPS_HOST`       | `207.180.200.230`                                   |
| Secret   | `VPS_USER`       | `deploy`                                            |
| Secret   | `VPS_SSH_KEY`    | `deploy` foydalanuvchisiga qo'shilgan private kalit |
| Variable | `DEPLOY_ENABLED` | `true`                                              |

`main` ga har push (server yoki shared o'zgarganda): image build → Postgres bilan
smoke test → GHCR'ga push → `docker-compose.yml`, `livekit.yaml`, `backup.sh`
`/srv/puzzle` ga ko'chiriladi → `docker compose up -d` → `/health` tekshiruvi,
xato bo'lsa oldingi versiyaga qaytadi.

## 6. Vercel (frontend)

- Root Directory: `apps/web`
- Environment: `NEXT_PUBLIC_SITE_URL=https://davradosh.uz`,
  `NEXT_PUBLIC_API_URL=https://api.davradosh.uz`, `NEXT_PUBLIC_WS_URL=wss://api.davradosh.uz`
- Domain: `davradosh.uz` (+ `www`); `puzzle.javohir.ru` davradosh.uz'ga 308 bilan yo'naltiriladi

## 7. Backup va monitoring

```bash
crontab -u deploy -e
# 0 3 * * * /srv/puzzle/backup.sh >> /srv/puzzle/backup.log 2>&1
```

Monitoring: serverdagi Uptime Kuma (`nasiya-uptime-kuma-1`, status.javohir.ru) har daqiqada tekshiradi:

- `puzzle.javohir.ru (Puzzle Web)`: HTTP `https://puzzle.javohir.ru/`
- `api.puzzle.javohir.ru (Puzzle API)`: `https://api.puzzle.javohir.ru/health` javobida `"db":true` bo'lishi shart

Ikkalasi "Telegram (Puzzle alerts)" bildirishnomasiga ulangan: sayt tushsa va tiklansa admin chatga xabar keladi.
`/health` javobi o'zgarsa, `"db":true` kalit so'zini saqlang yoki monitorni yangilang.

## Foydali buyruqlar

```bash
cd /srv/puzzle
docker compose ps
docker compose logs -f server livekit
docker compose restart server
docker compose exec postgres psql -U puzzle puzzle
tail -f /var/log/nginx/puzzle.error.log   # hsbch-nginx-1 ichida: docker exec hsbch-nginx-1 tail ...
```
