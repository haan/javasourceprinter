# Deployment (Ubuntu 24.04 + Apache)

Target layout:

```
/var/www/java
|-- dist/              # Vite build output
|-- server/            # Node backend (from this repo)
|-- shared/            # Shared theme definitions
|-- public/            # Static assets (logo)
|-- package.json
`-- package-lock.json  # if you use npm ci
```

## 1) Install Node.js 20 LTS

```
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## 2) Build locally (recommended)

On your PC:

```
npm install
npm run build
```

Upload to the server:
- `dist/` -> `/var/www/java/dist`
- `server/` -> `/var/www/java/server`
- `shared/` -> `/var/www/java/shared`
- `public/` -> `/var/www/java/public`
- `package.json` and `package-lock.json` -> `/var/www/java/`

## 3) Install runtime dependencies + Playwright deps (server)

```
cd /var/www/java
npm ci --omit=dev
sudo mkdir -p /var/www/java/.cache/ms-playwright
sudo chown -R www-data:www-data /var/www/java/.cache
sudo -u www-data -H env PLAYWRIGHT_BROWSERS_PATH=/var/www/java/.cache/ms-playwright npx playwright install chromium
sudo npx playwright install-deps chromium
```

## 4) Backend env file

Copy `deploy/env/javasourceprinter.env` to `/var/www/java/server/.env` and adjust limits if needed. `RENDER_CONCURRENCY` controls how many files are rendered in parallel.

`CHROMIUM_NO_SANDBOX=0` keeps the Chromium sandbox enabled (recommended). Set it to `1` only if your server cannot use the sandbox and Playwright fails with a “No usable sandbox” error.

## 5) systemd service

```
sudo cp deploy/systemd/javasourceprinter.service /etc/systemd/system/javasourceprinter.service
sudo systemctl daemon-reload
sudo systemctl enable --now javasourceprinter
sudo systemctl status javasourceprinter
```

Health check:

```
curl http://127.0.0.1:3001/api/health
```

## 6) Apache vhost

```
sudo a2enmod proxy proxy_http headers ssl
sudo cp deploy/apache/javasourceprinter.conf /etc/apache2/sites-available/javasourceprinter.conf
sudo a2ensite javasourceprinter.conf
sudo systemctl reload apache2
```

If you use certbot:

```
sudo certbot --apache -d java.haan.lu
```

## Updating an existing deployment

1) Build locally
```
npm install
npm run build
```

2) Upload to the server (overwrite existing)
- `dist/` -> `/var/www/java/dist`
- `server/` -> `/var/www/java/server`
- `shared/` -> `/var/www/java/shared`
- `public/` -> `/var/www/java/public`
- `package.json` and `package-lock.json` -> `/var/www/java/`

3) On the server, update runtime deps
```
cd /var/www/java
npm ci --omit=dev
```

4) If the Playwright version changed, update browsers
```
sudo -u www-data -H env PLAYWRIGHT_BROWSERS_PATH=/var/www/java/.cache/ms-playwright npx playwright install chromium
```

5) Restart the service
```
sudo systemctl restart javasourceprinter
```

Optional health check:
```
curl http://127.0.0.1:3001/api/health
```
