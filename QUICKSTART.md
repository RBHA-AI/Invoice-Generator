# 🚀 QUICK START GUIDE
## R Bhargava & Associates Invoice Generator

### ⚡ Fastest Way to Get Started

#### Windows Users:
1. Double-click `deploy.bat`
2. Wait for installation to complete
3. Run: `npm start`
4. Open browser: http://localhost:5000

#### Mac/Linux Users:
1. Open Terminal in project folder
2. Run: `chmod +x deploy.sh && ./deploy.sh`
3. Run: `npm start`
4. Open browser: http://localhost:5000

---

### 📋 Step-by-Step Setup

#### Prerequisites
- Node.js v16+ installed (download from nodejs.org)

#### Installation Steps

**1. Install Dependencies**
```bash
npm install
cd client
npm install
cd ..
```

**2. Build the Application**
```bash
cd client
npm run build
cd ..
```

**3. Start the Server**
```bash
npm start
```

**4. Access the Application**
- Open your browser
- Go to: `http://localhost:5000`

---

### 🎯 First Use

**Step 1: Add a Client**
1. Click "Clients" in the sidebar
2. Click "Add Client" button
3. Fill in client details:
   - Name: MEDI XPERT INDIA LIMITED
   - GSTIN: 07AAECR1202J2ZP
   - Address, City, State, Pincode
4. Click "Add Client"

**Step 2: Create an Invoice**
1. Click "New Invoice" in the sidebar
2. Select the client from dropdown
3. Invoice number is auto-generated
4. Add line items:
   - Description: PROFESSIONAL CHARGE GST ANNUAL RETURN F.Y 2024-25
   - HSN/SAC: 998222
   - Quantity: 1
   - Rate: 45000
5. Watch the preview update in real-time!
6. Click "Download PDF" to save

---

### 🔧 Development Mode (with Hot Reload)

```bash
npm run dev
```

This opens:
- Frontend: http://localhost:3000 (auto-refreshes)
- Backend: http://localhost:5000

---

### 🌐 Access from Other Devices

1. Find your computer's IP address:
   - Windows: `ipconfig` (look for IPv4 Address)
   - Mac/Linux: `ifconfig` (look for inet)

2. Start the server: `npm start`

3. On other devices, open:
   `http://YOUR_IP_ADDRESS:5000`
   
   Example: `http://192.168.1.100:5000`

---

### ❓ Troubleshooting

**"Port 5000 already in use"**
```bash
# Kill the process using port 5000
# Windows:
netstat -ano | findstr :5000
taskkill /PID [PID_NUMBER] /F

# Mac/Linux:
lsof -ti:5000 | xargs kill
```

**"Module not found" errors**
```bash
# Re-install dependencies
rm -rf node_modules client/node_modules
npm install
cd client && npm install && cd ..
```

**PDF not generating**
- Use Chrome or Edge browser
- Disable browser extensions
- Check browser console for errors

---

### 📁 Project Structure

```
rbhargava-invoice-generator/
├── server/
│   └── index.js              # Backend API
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.js
│   │   │   ├── Clients.js
│   │   │   └── InvoiceGenerator.js
│   │   ├── App.js
│   │   └── App.css
│   └── package.json
├── package.json
├── README.md                 # Full documentation
└── QUICKSTART.md            # This file
```

---

### 🎨 Features Overview

✅ **Client Management** - Store all client details
✅ **Auto Invoice Numbers** - DL/01/2025-26/XX format
✅ **Live Preview** - See invoice as you type
✅ **GST Calculations** - Automatic CGST/SGST
✅ **PDF Export** - Professional PDF download
✅ **Dashboard** - Stats and recent invoices
✅ **Professional Design** - Gold & navy theme

---

### 📞 Need Help?

- Check the full README.md for detailed documentation
- Contact your development team
- Review the code comments for customization

---

**Built for R Bhargava & Associates** | Version 1.0.0
