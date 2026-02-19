#!/bin/bash

echo "================================================"
echo "R Bhargava Invoice Generator - Deployment Script"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="rbhargava-invoice"
APP_DIR="/var/www/$APP_NAME"
DOMAIN="invoice.rbhargava.com"  # Change this to your domain

echo -e "${YELLOW}This script will deploy the invoice application.${NC}"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

# Check if running as sudo for some commands
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}Don't run this script as root. Run as regular user (will ask for sudo when needed).${NC}"
   exit 1
fi

echo ""
echo "=== Step 1: Installing Required Software ==="
echo ""

# Update system
echo "Updating system..."
sudo apt update

# Install Node.js if not present
if ! command -v node &> /dev/null
then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo -e "${GREEN}✓ Node.js already installed: $(node --version)${NC}"
fi

# Install Nginx
if ! command -v nginx &> /dev/null
then
    echo "Installing Nginx..."
    sudo apt install nginx -y
else
    echo -e "${GREEN}✓ Nginx already installed${NC}"
fi

# Install PM2
if ! command -v pm2 &> /dev/null
then
    echo "Installing PM2..."
    sudo npm install -g pm2
else
    echo -e "${GREEN}✓ PM2 already installed${NC}"
fi

echo ""
echo "=== Step 2: Setting up Application Directory ==="
echo ""

# Create app directory
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# Copy application files
echo "Copying application files..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -r $SCRIPT_DIR/* $APP_DIR/

cd $APP_DIR

echo ""
echo "=== Step 3: Installing Dependencies ==="
echo ""

# Install server dependencies
echo "Installing server dependencies..."
npm install --production

# Install and build client
echo "Building client application..."
cd client
npm install
npm run build
cd ..

echo ""
echo "=== Step 4: Creating PM2 Configuration ==="
echo ""

cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
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
EOF

# Create logs directory
mkdir -p logs

echo ""
echo "=== Step 5: Starting Application with PM2 ==="
echo ""

pm2 start ecosystem.config.js
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

echo ""
echo "=== Step 6: Configuring Nginx ==="
echo ""

sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;

    access_log /var/log/nginx/$APP_NAME-access.log;
    error_log /var/log/nginx/$APP_NAME-error.log;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    client_max_body_size 10M;
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/

# Test and restart Nginx
sudo nginx -t
if [ $? -eq 0 ]; then
    sudo systemctl restart nginx
    sudo systemctl enable nginx
    echo -e "${GREEN}✓ Nginx configured successfully${NC}"
else
    echo -e "${RED}✗ Nginx configuration error${NC}"
    exit 1
fi

echo ""
echo "=== Step 7: Configuring Firewall ==="
echo ""

sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo ""
echo "=== Step 8: Creating Backup Script ==="
echo ""

sudo tee /usr/local/bin/backup-$APP_NAME.sh > /dev/null << 'EOF'
#!/bin/bash
APP_DIR="/var/www/rbhargava-invoice"
BACKUP_DIR="/var/backups/rbhargava-invoice"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

mkdir -p $BACKUP_DIR
cp $APP_DIR/invoices.db $BACKUP_DIR/invoices_$DATE.db
find $BACKUP_DIR -name "invoices_*.db" -mtime +$RETENTION_DAYS -delete
echo "Backup completed: invoices_$DATE.db"
EOF

sudo chmod +x /usr/local/bin/backup-$APP_NAME.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-$APP_NAME.sh >> /var/log/$APP_NAME-backup.log 2>&1") | crontab -

echo ""
echo "================================================"
echo -e "${GREEN}✓ DEPLOYMENT COMPLETE!${NC}"
echo "================================================"
echo ""
echo "Application Status:"
pm2 status

echo ""
echo "Next Steps:"
echo "1. Configure your domain DNS to point to this server"
echo "2. Install SSL certificate: sudo certbot --nginx -d $DOMAIN"
echo "3. Test the application: http://$DOMAIN"
echo ""
echo "Useful Commands:"
echo "  View logs:    pm2 logs $APP_NAME"
echo "  Restart app:  pm2 restart $APP_NAME"
echo "  Stop app:     pm2 stop $APP_NAME"
echo "  App status:   pm2 status"
echo ""
echo "Application running on: http://localhost:5000"
echo "Access via domain: http://$DOMAIN (after DNS setup)"
echo ""
