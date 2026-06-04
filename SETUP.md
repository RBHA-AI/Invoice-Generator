# 📦 INSTALLATION PACKAGE
## R Bhargava & Associates - Invoice Generator

### ✅ What's Included

This package contains a complete, production-ready invoice generation platform with:

- ✨ Full-stack application (React + Node.js + SQLite)
- 📊 Client management system
- 🧾 Professional invoice generator matching your template
- 📈 Dashboard with statistics
- 💾 Local database storage
- 🎨 Professional CA firm design
- 📄 PDF export functionality

---

### 🚀 INSTALLATION - CHOOSE YOUR METHOD

#### **Method 1: Automated Setup (Recommended)**

**Windows:**
1. Extract the ZIP file
2. Double-click `deploy.bat`
3. Wait for completion
4. Run: `npm start`

**Mac/Linux:**
1. Extract the ZIP file
2. Open Terminal in the folder
3. Run: `chmod +x deploy.sh && ./deploy.sh`
4. Run: `npm start`

#### **Method 2: Manual Setup**

1. **Install Node.js** (if not installed)
   - Download from: https://nodejs.org/
   - Install version 16 or higher
   - Verify: `node --version`

2. **Extract Files**
   - Extract the ZIP to your desired location
   - Example: `C:\RBInvoiceGenerator` or `/home/user/rb-invoice`

3. **Install Dependencies**
   ```bash
   # In project root folder
   npm install
   
   # Then install client dependencies
   cd client
   npm install
   cd ..
   ```

4. **Build Application**
   ```bash
   cd client
   npm run build
   cd ..
   ```

5. **Start Server**
   ```bash
   npm start
   ```

6. **Access Application**
   - Open browser: http://localhost:5000

---

### 📁 Verify Your Files

After extraction, you should have:

```
rbhargava-invoice-generator/
├── server/
│   └── index.js
├── client/
│   ├── public/
│   ├── src/
│   │   ├── pages/
│   │   ├── App.js
│   │   └── App.css
│   └── package.json
├── package.json
├── README.md          ← Full documentation
├── QUICKSTART.md      ← Quick guide
├── deploy.bat         ← Windows installer
├── deploy.sh          ← Mac/Linux installer
└── .gitignore
```

---

### ⚙️ Configuration

#### Change Server Port
Edit `server/index.js`, line 6:
```javascript
const PORT = process.env.PORT || 5000;  // Change 5000 to your port
```

#### Update Firm Details
Edit `client/src/pages/InvoiceGenerator.js`:
- Firm name/address: Lines ~235-242
- Bank details: Lines ~330-335

#### Customize Colors
Edit `client/src/App.css`, lines 3-15:
```css
:root {
  --primary: #1a2332;     /* Change navy color */
  --accent: #d4af37;      /* Change gold color */
}
```

#### Email (Resend) Setup

1. Create a free account at [resend.com](https://resend.com)
2. Go to **API Keys** → create a key → copy it (`re_...`)
3. Copy `.env.example` to `.env` and add:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_api_key_here
MAIL_FROM=invoices@yourdomain.com
MAIL_FROM_NAME=R Bhargava & Associates
```

4. **Verify your domain** in Resend (Domains → Add domain → add DNS records at your registrar)
5. For AI-generated email drafts, also set `OPENAI_API_KEY` (same as HSN/SAC suggestions)
6. Restart the server after changing `.env`

**Using Send Email:** Open a saved invoice → click **Send Email**. Default templates are under **Dashboard → Email Defaults**.

Email settings and send logs live in `email.db` (separate from `invoices.db`). Invoice data is only read when sending — never altered by the email feature.

**Optional SMTP:** Set `EMAIL_PROVIDER=smtp` and uncomment `SMTP_*` variables in `.env.example` if you do not use Resend.

---

### 🌐 Deploy on Local Network

1. **Start the server**
   ```bash
   npm start
   ```

2. **Find your IP address**
   ```bash
   # Windows
   ipconfig
   
   # Mac/Linux
   ifconfig
   ```

3. **Access from other devices**
   - Use: `http://YOUR_IP:5000`
   - Example: `http://192.168.1.100:5000`

4. **Configure Firewall**
   - Windows: Allow Node.js through Windows Firewall
   - Mac: System Preferences → Security & Privacy → Firewall
   - Linux: `sudo ufw allow 5000`

---

### 💡 Usage Tips

1. **First Time Setup**
   - Add at least one client before creating invoices
   - Invoice numbers auto-increment per financial year
   - Database is created automatically on first run

2. **Data Backup**
   - Your data is in: `invoices.db`
   - Copy this file regularly for backups
   - Restore by replacing the file

3. **PDF Generation**
   - Works best in Chrome/Edge browsers
   - Preview updates in real-time
   - Click "Download PDF" to save

4. **Multiple Line Items**
   - Click "Add Item" for more rows
   - Each item calculates GST automatically
   - Remove items with the trash icon

---

### 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Port already in use" | Kill process on port 5000 (see QUICKSTART.md) |
| "Module not found" | Run `npm install` in both root and client folders |
| Can't access from network | Check firewall settings |
| PDF not generating | Use Chrome browser, disable extensions |
| Database locked | Close all app instances |

---

### 📞 Support

**Documentation:**
- `README.md` - Complete documentation
- `QUICKSTART.md` - Quick reference guide

**Common Tasks:**
- Add client → Clients page → Add Client button
- Create invoice → New Invoice page → Select client
- View stats → Dashboard page
- Backup data → Copy `invoices.db` file

---

### 🔒 Security Notes

- Designed for internal/local network use
- For internet deployment, add authentication
- Keep Node.js and dependencies updated
- Regular database backups recommended

---

### 📈 Future Features (Roadmap)

Phase 2 possibilities:
- Email invoices to clients
- Payment tracking
- IGST support
- Client portal
- Multi-user authentication
- Automated backups
- Recurring invoices

---

### ✅ Quick Test

After installation:

1. Start server: `npm start`
2. Open: http://localhost:5000
3. Go to Clients → Add a test client
4. Go to New Invoice → Select client → Add items
5. Watch live preview → Download PDF

If all steps work, installation is successful! ✨

---

**Version:** 1.0.0  
**Built for:** R Bhargava & Associates  
**Technology:** React + Node.js + Express + SQLite  
**License:** Proprietary

---

### 📧 Questions?

Refer to the comprehensive README.md for detailed information on:
- API endpoints
- Database schema
- Customization options
- Advanced deployment
- Windows Service setup

**Need help?** Contact your development team.

---

**🎉 Enjoy your professional invoice generator!**
