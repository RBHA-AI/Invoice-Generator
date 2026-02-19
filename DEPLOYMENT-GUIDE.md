# 🚀 DEPLOYMENT PLAN - R Bhargava Invoice Generator
## Local Standalone Server Deployment

---

## 📋 PHASE 1: PRE-DEPLOYMENT CHECKLIST

### ✅ Current Status Assessment
- [ ] Application runs on localhost:5000
- [ ] All features working (Clients, Invoices, PDF generation)
- [ ] Database file location confirmed (`invoices.db`)
- [ ] No critical bugs or errors

### ✅ Server Requirements
- [ ] Ubuntu/Linux server (you have this ✓)
- [ ] Node.js v16+ installed
- [ ] Port 80/443 available for web traffic
- [ ] Domain name configured (e.g., invoice.rbhargava.com)
- [ ] Static IP address or DDNS setup

### ✅ Security Requirements
- [ ] Firewall configured (UFW)
- [ ] SSL certificate (Let's Encrypt)
- [ ] Backup strategy in place
- [ ] Login system planned (Phase 2)

---

## 🔧 PHASE 2: SERVER SETUP

### Step 1: Install Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Nginx (reverse proxy)
sudo apt install nginx -y

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Certbot (SSL certificates)
sudo apt install certbot python3-certbot-nginx -y

# Verify installations
node --version
npm --version
nginx -v
pm2 --version
```

### Step 2: Setup Firewall

```bash
# Configure UFW
sudo ufw allow 22        # SSH
sudo ufw allow 80        # HTTP
sudo ufw allow 443       # HTTPS
sudo ufw allow 5000      # Development (optional, can close later)
sudo ufw enable

# Check status
sudo ufw status
```

---

## 📦 PHASE 3: APPLICATION DEPLOYMENT

### Step 1: Prepare Application Directory

```bash
# Create application directory
sudo mkdir -p /var/www/rbhargava-invoice
sudo chown -R $USER:$USER /var/www/rbhargava-invoice

# Copy your application
cd ~/Downloads/rbhargava-invoice-generator
cp -r * /var/www/rbhargava-invoice/

# Navigate to app directory
cd /var/www/rbhargava-invoice
```

### Step 2: Install Dependencies & Build

```bash
# Install server dependencies
npm install --production

# Install client dependencies and build
cd client
npm install
npm run build
cd ..

# Test the application
npm start
# Press Ctrl+C to stop
```

### Step 3: Configure PM2 (Process Manager)

Create PM2 ecosystem file:

```bash
nano ecosystem.config.js
```

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [{
    name: 'rbhargava-invoice',
    script: './server/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
```

**Start with PM2:**
```bash
# Create logs directory
mkdir -p logs

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Enable PM2 to start on boot
pm2 startup
# Follow the command it gives you (run with sudo)

# Check status
pm2 status
pm2 logs rbhargava-invoice
```

---

## 🌐 PHASE 4: DOMAIN & NGINX SETUP

### Step 1: Domain Configuration

**Option A: Using Your Own Domain**
```
1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Add an A record:
   - Type: A
   - Name: invoice (or @ for root domain)
   - Value: YOUR_SERVER_IP
   - TTL: 300
```

**Option B: Using Subdomain**
```
If you have rbhargava.com:
- Create subdomain: invoice.rbhargava.com
- Point to your server IP
```

**Option C: Local Network Only**
```
- Edit /etc/hosts on client machines
- Add: YOUR_SERVER_IP invoice.local
```

### Step 2: Nginx Configuration

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/rbhargava-invoice
```

**Basic Configuration (HTTP only - before SSL):**
```nginx
server {
    listen 80;
    server_name invoice.rbhargava.com;  # Replace with your domain

    # Logs
    access_log /var/log/nginx/rbhargava-invoice-access.log;
    error_log /var/log/nginx/rbhargava-invoice-error.log;

    # Serve static files
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Increase upload size for PDFs
    client_max_body_size 10M;
}
```

**Enable the site:**
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/rbhargava-invoice /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Enable Nginx on boot
sudo systemctl enable nginx
```

---

## 🔒 PHASE 5: SSL CERTIFICATE (HTTPS)

### Get Free SSL Certificate with Let's Encrypt

```bash
# Stop Nginx temporarily
sudo systemctl stop nginx

# Get certificate (replace with your domain)
sudo certbot certonly --standalone -d invoice.rbhargava.com

# Start Nginx
sudo systemctl start nginx

# Or use Nginx plugin (automatic)
sudo certbot --nginx -d invoice.rbhargava.com
```

**Updated Nginx Configuration with SSL:**
```bash
sudo nano /etc/nginx/sites-available/rbhargava-invoice
```

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name invoice.rbhargava.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name invoice.rbhargava.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/invoice.rbhargava.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/invoice.rbhargava.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logs
    access_log /var/log/nginx/rbhargava-invoice-access.log;
    error_log /var/log/nginx/rbhargava-invoice-error.log;

    # Proxy to Node.js app
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Increase upload size
    client_max_body_size 10M;
}
```

**Restart Nginx:**
```bash
sudo nginx -t
sudo systemctl restart nginx
```

**Auto-renew SSL:**
```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot auto-renewal is already configured via systemd timer
sudo systemctl status certbot.timer
```

---

## 💾 PHASE 6: BACKUP STRATEGY

### Automated Backup Script

Create backup script:
```bash
sudo nano /usr/local/bin/backup-invoice.sh
```

**backup-invoice.sh:**
```bash
#!/bin/bash

# Configuration
APP_DIR="/var/www/rbhargava-invoice"
BACKUP_DIR="/var/backups/rbhargava-invoice"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
cp $APP_DIR/invoices.db $BACKUP_DIR/invoices_$DATE.db

# Backup entire app (optional)
# tar -czf $BACKUP_DIR/app_$DATE.tar.gz -C $APP_DIR .

# Remove old backups
find $BACKUP_DIR -name "invoices_*.db" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: invoices_$DATE.db"
```

**Make executable and schedule:**
```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-invoice.sh

# Test backup
sudo /usr/local/bin/backup-invoice.sh

# Schedule with cron (daily at 2 AM)
sudo crontab -e
```

**Add to crontab:**
```
0 2 * * * /usr/local/bin/backup-invoice.sh >> /var/log/invoice-backup.log 2>&1
```

---

## 🔐 PHASE 7: AUTHENTICATION SETUP (Future)

### Prepare for Login System

**Create authentication plan:**

1. **User Management**
   - Admin users (CA firm staff)
   - Client portal (optional)
   - Role-based access

2. **Technology Options:**
   - **Option A**: Passport.js (local strategy)
   - **Option B**: JWT tokens
   - **Option C**: OAuth (Google/Microsoft)

3. **Database Schema:**
   ```sql
   -- Will add to SQLite
   CREATE TABLE users (
     id TEXT PRIMARY KEY,
     username TEXT UNIQUE NOT NULL,
     email TEXT UNIQUE NOT NULL,
     password_hash TEXT NOT NULL,
     role TEXT DEFAULT 'user',
     created_at TEXT DEFAULT CURRENT_TIMESTAMP
   );
   ```

4. **Protected Routes:**
   - `/login` - Public
   - `/dashboard` - Protected
   - `/clients` - Protected
   - `/invoices` - Protected

**Will implement in Phase 8**

---

## 📊 PHASE 8: MONITORING & MAINTENANCE

### Setup Monitoring

```bash
# Install monitoring tools
npm install -g pm2-logrotate

# Configure log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Health Check Script

Create monitoring script:
```bash
nano /usr/local/bin/health-check.sh
```

```bash
#!/bin/bash

URL="http://localhost:5000"
if curl -s --head $URL | grep "200 OK" > /dev/null; then
    echo "$(date): Application is running"
else
    echo "$(date): Application is DOWN - Restarting..."
    pm2 restart rbhargava-invoice
fi
```

**Schedule health check:**
```bash
sudo chmod +x /usr/local/bin/health-check.sh

# Add to crontab (every 5 minutes)
*/5 * * * * /usr/local/bin/health-check.sh >> /var/log/health-check.log 2>&1
```

---

## 🎯 DEPLOYMENT QUICK COMMANDS

### Essential Commands

```bash
# Check application status
pm2 status
pm2 logs rbhargava-invoice

# Restart application
pm2 restart rbhargava-invoice

# Stop application
pm2 stop rbhargava-invoice

# View Nginx logs
sudo tail -f /var/log/nginx/rbhargava-invoice-access.log
sudo tail -f /var/log/nginx/rbhargava-invoice-error.log

# Check Nginx status
sudo systemctl status nginx

# Restart Nginx
sudo systemctl restart nginx

# Manual backup
sudo /usr/local/bin/backup-invoice.sh

# Check disk space
df -h

# Check database size
ls -lh /var/www/rbhargava-invoice/invoices.db
```

---

## ✅ POST-DEPLOYMENT VERIFICATION

### Testing Checklist

- [ ] Application accessible via domain (http://invoice.rbhargava.com)
- [ ] HTTPS working (green padlock)
- [ ] Can create clients
- [ ] Can generate invoices
- [ ] PDF download works
- [ ] Invoice numbers auto-increment correctly
- [ ] Data persists after server restart
- [ ] PM2 restarts app on crash
- [ ] Backups running daily
- [ ] Nginx serving correctly
- [ ] SSL certificate valid
- [ ] Firewall configured properly

---

## 🔧 TROUBLESHOOTING

### Common Issues

**1. Application won't start:**
```bash
pm2 logs rbhargava-invoice --lines 50
```

**2. Domain not accessible:**
```bash
# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# Check DNS
nslookup invoice.rbhargava.com
```

**3. SSL errors:**
```bash
sudo certbot certificates
sudo certbot renew --force-renewal
```

**4. Database locked:**
```bash
sudo lsof /var/www/rbhargava-invoice/invoices.db
pm2 restart rbhargava-invoice
```

---

## 📈 PERFORMANCE OPTIMIZATION

### Optional Enhancements

```nginx
# Add to Nginx config for caching
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Enable gzip compression
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

---

## 🎉 DEPLOYMENT COMPLETE!

Your application will be:
- ✅ Running 24/7 with PM2
- ✅ Accessible via custom domain
- ✅ Secured with HTTPS
- ✅ Auto-restarting on failure
- ✅ Automatically backed up daily
- ✅ Protected by firewall
- ✅ Ready for authentication (Phase 2)

---

## 📞 NEXT STEPS

1. **Test deployment** thoroughly
2. **Document** server IP and domain
3. **Share credentials** with team
4. **Plan** authentication implementation
5. **Schedule** regular maintenance

**Ready to start deployment?** Let me know which phase you want to begin with!
