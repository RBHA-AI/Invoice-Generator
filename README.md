# R Bhargava & Associates - Invoice Generator

A professional, full-stack invoice generation platform designed specifically for CA firms. Features client management, automated invoice numbering, GST calculations, live preview, and PDF generation.

## 🎯 Features

### ✨ Core Features
- **Client Management** - Add, edit, and manage client database with GSTIN
- **Smart Invoice Generation** - Auto-incremented invoice numbers (DL/01/YYYY-YY/XX format)
- **Live Preview** - Real-time preview of invoice as you type
- **GST Calculations** - Automatic CGST/SGST calculations
- **PDF Export** - Download professional invoices as PDF
- **Email Invoices** - Send invoices with PDF attachment, AI-assisted drafts, and configurable default templates
- **Imported Invoices** - Upload invoice scans (image/PDF), AI vision extraction, review and edit — stored in a separate database from issued invoices
- **Professional Design** - CA firm-appropriate aesthetic with gold accents

### 📋 Invoice Template Features
- R Bhargava & Associates branding
- Complete firm and client details
- Multiple line items support
- HSN/SAC codes
- Quantity, rate, and tax calculations
- Total in words (Indian numbering system)
- Bank details (HDFC Bank)
- Terms & Conditions
- Professional formatting matching your sample

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone or extract the project**
```bash
cd rbhargava-invoice-generator
```

2. **Install dependencies**
```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

3. **Start Development Server**
```bash
# This will start both backend (port 5000) and frontend (port 3000)
npm run dev
```

The application will open at `http://localhost:3000`

Sign in with your **workspace name** and **password**. See [MULTI_TENANT.md](MULTI_TENANT.md) for provisioning new customer workspaces and production deploy steps.

### Email Configuration (optional)

To use **Send Email** on saved invoices, use [Resend](https://resend.com) (recommended — one API key, no Gmail App Passwords):

1. Sign up at [resend.com](https://resend.com) and create an **API key**
2. Copy `.env.example` to `.env` in the project root
3. Add:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_api_key_here
MAIL_FROM=invoices@yourdomain.com
MAIL_FROM_NAME=R Bhargava & Associates
```

4. In the Resend dashboard, **verify your domain** (add DNS records they provide) so mail is delivered reliably
5. Optionally set `OPENAI_API_KEY` for AI-generated email drafts
6. Restart the server (`npm run dev` or `npm start`)

**Testing before domain verification:** Resend lets you send from `onboarding@resend.dev` to your own email only — useful for a quick test.

**Manual send (no Resend/SMTP):** If email is not configured on the server, open a saved invoice → **Send Email** → use **Download PDF**, **Copy email text**, and **Open mail app**, then send from Outlook/Gmail and attach the PDF yourself.

**SMTP fallback:** If you prefer SMTP, set `EMAIL_PROVIDER=smtp` and the `SMTP_*` variables in `.env.example`.

Configure default email subject/body templates from **Dashboard → Email Defaults**, or from the link inside the Send Email modal. The sender address is prefilled from the invoice's company and can be edited per send.

Email templates and send history are stored in a separate `email.db` file (not in `invoices.db`), so your existing invoice database is never modified by the email feature.

### Imported Invoices (AI/OCR upload)

Use **Imported Invoices** in the sidebar to upload a photo or PDF of a vendor bill or issued invoice copy. The server uses OpenAI vision to extract fields; you review and edit anything missing before marking complete.

1. Set `OPENAI_API_KEY` in `.env` (required for extraction)
2. Optional: `OPENAI_VISION_MODEL` (default: same as `OPENAI_MODEL`), `IMPORTED_INVOICE_LLM_TIMEOUT_MS` (default 30000)
3. Optional: `IMPORTED_INVOICES_DB_PATH` to customize where imported data is stored (default: `imported_invoices.db` at project root)

Imported invoice data and uploaded scans live in **`imported_invoices.db`** and **`server/uploads/imported/<workspaceId>/`** — completely separate from `invoices.db` and your issued invoice workflow.

PDF uploads are converted to an image (first page) server-side before AI extraction, since the vision API only accepts image formats.

## 📦 Production Deployment

### Option 1: Local Server Deployment

1. **Build the React frontend**
```bash
cd client
npm run build
cd ..
```

2. **Start the production server**
```bash
npm start
```

The server will run on port 5000. Access at `http://localhost:5000`

### Option 2: Deploy on Your Network

1. **Build the application**
```bash
cd client
npm run build
cd ..
```

2. **Set environment variables** (optional)
```bash
export PORT=5000
```

3. **Start the server**
```bash
node server/index.js
```

4. **Access from other devices**
- Find your server's IP address: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
- Access from other devices: `http://YOUR_IP_ADDRESS:5000`

### Option 3: Deploy as Windows Service (for 24/7 operation)

1. Install `node-windows` globally:
```bash
npm install -g node-windows
```

2. Create service script (`install-service.js`):
```javascript
var Service = require('node-windows').Service;

var svc = new Service({
  name: 'RB Invoice Generator',
  description: 'Invoice generation platform for R Bhargava & Associates',
  script: 'C:\\path\\to\\your\\project\\server\\index.js'
});

svc.on('install', function(){
  svc.start();
});

svc.install();
```

3. Run the service installer:
```bash
node install-service.js
```

## 🗂️ Project Structure

```
rbhargava-invoice-generator/
├── server/
│   └── index.js              # Express server & API endpoints
├── client/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.js         # Dashboard with stats
│   │   │   ├── Clients.js           # Client management
│   │   │   ├── InvoiceGenerator.js  # Invoice creation
│   │   │   └── InvoiceGenerator.css
│   │   ├── App.js            # Main app with routing
│   │   ├── App.css           # Global styles
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
├── package.json
├── invoices.db               # SQLite database (auto-created)
├── imported_invoices.db      # Imported invoice scans + extracted data (auto-created)
├── email.db                  # Email templates and send log (auto-created)
└── README.md
```

## 💾 Database

The application uses SQLite for local data storage. The database file (`invoices.db`) is automatically created on first run.

### Tables:
- **clients** - Client information and GSTIN
- **invoices** - Invoice headers
- **invoice_items** - Invoice line items

### Backup
To backup your data, copy `invoices.db`, `imported_invoices.db`, `email.db`, and `server/uploads/` to a safe location (or run `./scripts/backup.sh`).

## 🎨 Customization

### Update Firm Details
Edit `client/src/pages/InvoiceGenerator.js`:
- Firm name and address (line ~235)
- GSTIN (line ~242)
- Bank details (line ~330)

### Change Colors
Edit `client/src/App.css`:
```css
:root {
  --primary: #1a2332;        /* Navy blue */
  --accent: #d4af37;         /* Gold */
  /* ... */
}
```

## 🔧 Configuration

### Change Port
Edit `server/index.js`:
```javascript
const PORT = process.env.PORT || 5000;
```

Or set environment variable:
```bash
export PORT=8080
npm start
```

### Enable HTTPS (for production)
1. Get SSL certificate
2. Update server configuration to use HTTPS
3. Configure firewall rules

## 📱 Usage Guide

### 1. Add Clients
- Navigate to "Clients" page
- Click "Add Client"
- Fill in client details (name, GSTIN, address, etc.)
- Save

### 2. Create Invoice
- Navigate to "New Invoice"
- Select a client from dropdown
- Invoice number is auto-generated
- Add line items (description, HSN/SAC, qty, rate)
- GST is calculated automatically
- Preview updates in real-time
- Click "Download PDF" to save

### 3. Dashboard
- View total clients
- View total invoices
- See revenue statistics
- Check recent invoices

## 🛠️ Troubleshooting

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:5000 | xargs kill
```

### Database Locked
- Close all instances of the app
- Delete `invoices.db` (will create new database)

### PDF Not Generating
- Ensure html2canvas library is installed
- Check browser console for errors
- Try using Chrome/Edge for best compatibility

## 📄 License

Proprietary - R Bhargava & Associates

## 🤝 Support

For support or customization requests, contact your development team.

## 🔒 Security Notes

- This is designed for internal/local network use
- For internet deployment, add authentication
- Backup database regularly
- Keep Node.js and dependencies updated

## 📌 Future Enhancements (Phase 2+)

- [x] Email invoices directly to clients
- [x] Payment tracking
- [x] Multiple tax templates (IGST support)
- [x] Invoice search and filtering
- [x] Excel export
- [ ] Client portal
- [ ] Multi-user support with authentication
- [ ] Automated backups
- [ ] Invoice templates customization
- [ ] Recurring invoices

---

**Built with ❤️ for R Bhargava & Associates**
