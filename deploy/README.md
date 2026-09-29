# Deploy qo'llanmasi

| Qism                      | Qayerda             | Manzil                        |
| ------------------------- | ------------------- | ----------------------------- |
| Frontend (Next.js)        | Vercel              | https://puzzle.javohir.ru     |
| API + WebSocket + rasmlar | VPS, Docker Compose | https://api.puzzle.javohir.ru |
| Ovoz/video (LiveKit)      | VPS, Docker Compose | wss://rtc.puzzle.javohir.ru   |

## 1. DNS (javohir.ru panelida)

| Tur   | Nom          | Qiymat                         |
| ----- | ------------ | ------------------------------ |
| CNAME | `puzzle`     | `cname.vercel-dns.com`         |
| A     | `api.puzzle` | `207.180.200.230`              |
| AAAA  | `api.puzzle` | `2a02:c207:2333:7193::1`       |
| A     | `rtc.puzzle` | `207.180.200.230` (ovoz/video) |
| AAAA  | `rtc.puzzle` | `2a02:c207:2333:7193::1`       |

Tekshirish: `dig +short api.puzzle.javohir.ru` → `207.180.200.230`.

## 2. VPS tayyorgarligi (bir marta)

```bash
# 80/443 band emasligini tekshiring (band bo'lsa, o'sha proxy'ga yangi host qo'shiladi)
sudo ss -tulpn | grep -E ':(80|443)\s'

# Swap 4 GB (hozir swap yo'q)
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf && sudo sysctl --system

# Firewall
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
# LiveKit (ovoz/video): WebRTC media, TCP fallback, TURN
sudo ufw allow 50000:60000/udp && sudo ufw allow 7881/tcp && sudo ufw allow 3478/udp
sudo ufw enable

# Docker (rasmiy skript) va deploy foydalanuvchisi
curl -fsSL https://get.docker.com | sudo sh
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo apt-get install -y fail2ban unattended-upgrades

# Papkalar
sudo mkdir -p /opt/puzzle /var/lib/puzzle/uploads /var/backups/puzzle
sudo chown -R deploy:deploy /opt/puzzle /var/backups/puzzle
# Server konteyneri "app" foydalanuvchisi (UID 10001) nomidan yozadi
sudo chown -R 10001:10001 /var/lib/puzzle/uploads

# Log rotatsiyasi
echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' | sudo tee /etc/docker/daemon.json
sudo systemctl restart docker
```

## 3. Sozlamalar

```bash
sudo -iu deploy
cd /opt/puzzle
# deploy/.env.example ni shu yerga .env nomi bilan ko'chiring va to'ldiring
nano .env && chmod 600 .env
# Kuchli parol: openssl rand -base64 32
```

## 4. GitHub Actions orqali avtomatik deploy

Repo → **Settings → Secrets and variables → Actions**:

| Tur      | Nom              | Qiymat                                          |
| -------- | ---------------- | ----------------------------------------------- |
| Secret   | `VPS_HOST`       | `207.180.200.230`                               |
| Secret   | `VPS_USER`       | `deploy`                                        |
| Secret   | `VPS_SSH_KEY`    | `deploy` foydalanuvchisining private SSH kaliti |
| Variable | `DEPLOY_ENABLED` | `true`                                          |

SSH kalit yaratish (o'z kompyuteringizda):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/puzzle_deploy -C "github-actions"
ssh-copy-id -i ~/.ssh/puzzle_deploy.pub deploy@207.180.200.230
cat ~/.ssh/puzzle_deploy   # → VPS_SSH_KEY
```

Shundan keyin `main` ga har push (server yoki shared o'zgarganda):

1. Docker image build qilinadi → `ghcr.io/johnkhasan/puzzle-server:<sha>`
2. `docker-compose.yml`, `Caddyfile`, `backup.sh` VPS'ga ko'chiriladi
3. `docker compose pull && up -d`, keyin `/health` tekshiriladi, xato bo'lsa oldingi versiyaga qaytadi

Qo'lda birinchi ishga tushirish:

```bash
cd /opt/puzzle
docker compose up -d
curl https://api.puzzle.javohir.ru/health   # {"status":"ok","db":true,...}
```

## 5. Vercel (frontend)

1. vercel.com → **Add New Project** → `johnkhasan/puzzle-game`
2. **Root Directory:** `apps/web` (framework avtomatik: Next.js, pnpm)
3. **Environment Variables** (Production va Preview):
   - `NEXT_PUBLIC_API_URL` = `https://api.puzzle.javohir.ru`
   - `NEXT_PUBLIC_WS_URL` = `wss://api.puzzle.javohir.ru`
4. **Settings → Domains:** `puzzle.javohir.ru` qo'shing

`apps/web/vercel.json` dagi `ignoreCommand` faqat web yoki shared o'zgarganda build qiladi.

## 6. Ovoz/video tekshiruvi

- `https://livekit.io/connection-test` sahifasida `wss://rtc.puzzle.javohir.ru` va token bilan ulanishni sinab ko'ring
  (token: room'ga kirib, brauzer DevTools → Network → `rtc-token` javobidan)
- `.env` da `LIVEKIT_*` bo'sh bo'lsa, ovoz o'chiq bo'ladi va o'yin odatdagidek ishlayveradi

## 7. Backup va monitoring

```bash
crontab -e
# 0 3 * * * /opt/puzzle/backup.sh >> /var/log/puzzle-backup.log 2>&1
```

- Uptime: UptimeRobot/BetterStack'da `https://api.puzzle.javohir.ru/health` ni kuzating
- Loglar: `docker compose logs -f server`

## Foydali buyruqlar

```bash
docker compose ps                     # holat
docker compose logs -f server caddy   # loglar
docker compose restart server         # qayta ishga tushirish
docker compose exec postgres psql -U puzzle puzzle   # baza
```
