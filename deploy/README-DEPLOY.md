# Deployment (Ubuntu 24.04 + Apache)

Target layout:

```
/var/www/java
├─ dist/              # Vite build output
├─ server/            # Node backend (from this repo)
├─ shared/            # Shared theme definitions
├─ package.json
└─ package-lock.json  # if you use npm ci
```

## 1) Install Node.js 20 LTS

```
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## 2) Install Playwright dependencies

```
cd /var/www/java
npm ci --omit=dev
npm run playwright:install:deps
```

## 3) Build and deploy the frontend

Option A (build locally, then upload):

```
npm install
npm run build
```

Copy the `dist/` folder to `/var/www/java/dist`.

Option B (build on the server):

```
cd /var/www/java
npm install
npm run build
```

## 4) Backend env file

Copy `deploy/env/java-source-printer.env` to `/var/www/java/server/.env` and adjust limits if needed.

## 5) systemd service

```
sudo cp deploy/systemd/java-source-printer.service /etc/systemd/system/java-source-printer.service
sudo systemctl daemon-reload
sudo systemctl enable --now java-source-printer
sudo systemctl status java-source-printer
```

Health check:

```
curl http://127.0.0.1:3001/api/health
```

## 6) Apache vhost

```
sudo a2enmod proxy proxy_http headers ssl
sudo cp deploy/apache/java.haan.lu.conf /etc/apache2/sites-available/java.haan.lu.conf
sudo a2ensite java.haan.lu.conf
sudo systemctl reload apache2
```

If you use certbot:

```
sudo certbot --apache -d java.haan.lu
```
