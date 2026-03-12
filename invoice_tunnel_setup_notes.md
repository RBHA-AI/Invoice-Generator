# Invoice App Deployment, Tunnel, and Debugging Notes

## Live URL

- Production URL: `https://invoice.invoicecreation.store`

## Current Architecture

```text
Browser
  -> Cloudflare DNS
  -> Cloudflare Tunnel (named tunnel)
  -> cloudflared service
  -> Nginx on localhost:80
  -> PM2 backend on port 5000
  -> SQLite DB (invoices.db)
```

## Project Paths

- Repo: `/home/admin1/Downloads/rbhargava-invoice-generator`
- Frontend source: `/home/admin1/Downloads/rbhargava-invoice-generator/client`
- Backend source: `/home/admin1/Downloads/rbhargava-invoice-generator/server`
- Frontend build output: `/home/admin1/Downloads/rbhargava-invoice-generator/client/build`
- Nginx-served frontend: `/var/www/invoice-app`
- User cloudflared config: `/home/admin1/.cloudflared`
- System cloudflared config: `/etc/cloudflared`

## Services in Use

### PM2

Backend process name:

```bash
pm2 status
```

Expected process:

```text
invoice-backend
```

Useful commands:

```bash
pm2 logs invoice-backend
pm2 restart invoice-backend
pm2 save
pm2 startup
```

### Nginx

Useful commands:

```bash
sudo systemctl status nginx
sudo nginx -t
sudo systemctl reload nginx
sudo journalctl -u nginx -n 100 --no-pager
sudo tail -n 100 /var/log/nginx/error.log
```

### Cloudflare Tunnel

Useful commands:

```bash
cloudflared tunnel list
cloudflared tunnel info invoice-tunnel
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -n 100 --no-pager
sudo journalctl -u cloudflared -f
```

## Cloudflare Tunnel Config

### User config

File:

```text
/home/admin1/.cloudflared/config.yml
```

### System config

File:

```text
/etc/cloudflared/config.yml
```

Expected content:

```yaml
tunnel: 0666c4fd-373e-4fa2-9549-5f95a8c82ba2
credentials-file: /etc/cloudflared/0666c4fd-373e-4fa2-9549-5f95a8c82ba2.json

ingress:
  - hostname: invoice.invoicecreation.store
    service: http://localhost:80
  - service: http_status:404
```

## Nginx Config

Expected site file:

```text
/etc/nginx/sites-available/invoice-app
```

Typical content:

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/invoice-app;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

Useful checks:

```bash
sudo cat /etc/nginx/sites-available/invoice-app
ls -l /etc/nginx/sites-enabled/
```

## Commands to Make Changes Live

### If only backend code changed

Run:

```bash
cd /home/admin1/Downloads/rbhargava-invoice-generator
pm2 restart invoice-backend
```

### If frontend code changed

Run:

```bash
cd /home/admin1/Downloads/rbhargava-invoice-generator/client
npm run build
sudo rsync -av --delete /home/admin1/Downloads/rbhargava-invoice-generator/client/build/ /var/www/invoice-app/
```

### If both frontend and backend changed

Run:

```bash
cd /home/admin1/Downloads/rbhargava-invoice-generator/client
npm run build
sudo rsync -av --delete /home/admin1/Downloads/rbhargava-invoice-generator/client/build/ /var/www/invoice-app/
cd /home/admin1/Downloads/rbhargava-invoice-generator
pm2 restart invoice-backend
```

### If Nginx config changed

Run:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### If tunnel config changed

Run:

```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
```

## One-Line Deploy Command

Use this when both frontend and backend changed:

```bash
cd /home/admin1/Downloads/rbhargava-invoice-generator/client && npm run build && sudo rsync -av --delete /home/admin1/Downloads/rbhargava-invoice-generator/client/build/ /var/www/invoice-app/ && cd /home/admin1/Downloads/rbhargava-invoice-generator && pm2 restart invoice-backend
```

## Recommended Deploy Script

Create a file named `deploy_live.sh` in the repo root with:

```bash
#!/bin/bash
set -e

REPO=/home/admin1/Downloads/rbhargava-invoice-generator
FRONTEND=$REPO/client
LIVE=/var/www/invoice-app

cd "$FRONTEND"
npm run build
sudo rsync -av --delete "$FRONTEND/build/" "$LIVE/"

cd "$REPO"
pm2 restart invoice-backend

echo "Live deploy completed."
```

Make it executable:

```bash
chmod +x /home/admin1/Downloads/rbhargava-invoice-generator/deploy_live.sh
```

Run it:

```bash
/home/admin1/Downloads/rbhargava-invoice-generator/deploy_live.sh
```

## Debugging Checklist

### 1. Site not loading

Check:

```bash
curl -I http://localhost
curl -I https://invoice.invoicecreation.store
sudo systemctl status nginx
sudo systemctl status cloudflared
pm2 status
```

### 2. Frontend shows old version

Rebuild and copy again:

```bash
cd /home/admin1/Downloads/rbhargava-invoice-generator/client
npm run build
sudo rsync -av --delete /home/admin1/Downloads/rbhargava-invoice-generator/client/build/ /var/www/invoice-app/
```

Then hard refresh browser.

### 3. Backend API not responding

Check backend:

```bash
pm2 logs invoice-backend
curl http://127.0.0.1:5000
curl http://127.0.0.1:5000/api
```

Restart if needed:

```bash
pm2 restart invoice-backend
```

### 4. Nginx serving wrong page or errors

Check config and logs:

```bash
sudo nginx -t
sudo cat /etc/nginx/sites-available/invoice-app
sudo tail -n 100 /var/log/nginx/error.log
```

Reload:

```bash
sudo systemctl reload nginx
```

### 5. Cloudflare tunnel down

Check:

```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -n 100 --no-pager
```

Restart:

```bash
sudo systemctl restart cloudflared
```

### 6. DNS or route issues

Check:

```bash
resolvectl query api.cloudflare.com
cloudflared tunnel list
cloudflared tunnel info invoice-tunnel
```

### 7. PM2 process missing after reboot

Re-save and enable startup:

```bash
pm2 save
pm2 startup
```

Then run the printed `sudo env PATH=... pm2 startup ...` command if required.

## Useful Verification Commands

```bash
curl -I http://localhost
curl -I http://127.0.0.1:5000
curl -I https://invoice.invoicecreation.store
pm2 status
sudo systemctl status nginx
sudo systemctl status cloudflared
```

## Branch / Deployment Recommendation

Keep two branches:

- `main` -> stable, live code
- `branch3` -> development

Suggested flow:

1. Make and test changes on `branch3`
2. When ready, merge into `main`
3. Checkout `main`
4. Run deploy command

Useful commands:

```bash
git branch
git checkout branch3
git checkout main
git merge branch3
```

## Notes

- Cloudflare named tunnel URL is stable: `https://invoice.invoicecreation.store`
- Tunnel does not need terminal to stay open once systemd service is running.
- Quick `trycloudflare.com` URLs are temporary and should no longer be used.
- Frontend changes require rebuild.
- Backend changes require PM2 restart.

