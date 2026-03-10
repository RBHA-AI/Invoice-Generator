otp = input("Enter OTP from your phone: ")
session = client.gst_taxpayer_otp("YOUR_GSTIN", "your_username", otp, request_id)
taxpayer_token = session["data"]["auth_token"]
```

**To answer your question directly:** An authenticated session is valid for 6 hours and can be refreshed before expiry.  So if you run the script again after 10 minutes, you do NOT need a new OTP — you reuse the same token for 6 hours. Refreshing the token before it expires means users only need to enter the OTP manually once every 30 days. 

---

### What you can do WITHOUT any OTP — right now, today

These all work with just your `.env` API key. No GST portal login needed:

| What | What it gives you |
|---|---|
| **Search GSTIN** | Trade name, status, registration date, jurisdiction of any business |
| **Track Returns Status** | Which months are filed/pending for any GSTIN |
| **Search GSTIN by PAN** | All GSTINs registered under a PAN (useful for vendors) |
| **PAN Verify** | Verify any PAN is valid, get name on PAN |
| **PAN-Aadhaar link status** | Check if PAN is linked to Aadhaar |
| **Bank IFSC lookup** | Bank name, branch, address for any IFSC |
| **Bank account verify** | Confirm account number + IFSC is valid |
| **MCA company lookup** | Company registration details by CIN |
| **Vehicle RC lookup** | Owner, registration details for any vehicle |

These are genuinely useful for **vendor due diligence** right now — before you even touch filing. You can verify every vendor's GSTIN is active and filing regularly, which protects your Input Tax Credit.

---

### What needs OTP (GST Taxpayer session)

| What | Why OTP needed |
|---|---|
| Upload GSTR-1 | Writing to GSTN on your behalf |
| File GSTR-1/3B | Irreversible action — GSTN requires you to prove it's you |
| Read your own GSTR-2A/2B | Your private purchase data |
| EVC filing signature | Final confirmation step for filing |

---

### How reconciliation works with Sandbox API

Sandbox has built India's first end-to-end tax compliance APIs covering the complete GSTR-2B reconciliation flow.  Here's exactly how it works:
```
YOUR BOOKS                    GSTN's RECORDS
(what you recorded            (what your suppliers
 as purchases)                 actually filed)
      │                              │
      └──────── Sandbox API ─────────┘
                     │
                  Compares every invoice line by line
                     │
              Returns 4 categories:
              ✅ MATCHED   — both sides agree
              ⚠️  MISMATCH  — amounts differ (tax risk)
              ❌ MISSING   — supplier didn't file (you lose ITC)
              ➕ EXTRA     — in GSTN but not your books (unrecorded)
```

The **business impact** of MISSING is real money — if your supplier didn't file GSTR-1, you cannot claim that ITC, meaning you pay more tax than you should.

The API flow is:
1. Submit job → get two S3 upload URLs
2. Upload your `purchase_ledger.json` to URL #1
3. Upload your `gstr2b.json` (downloaded from GST portal) to URL #2
4. Poll the job status URL → get back the categorized discrepancy report

The reconciliation test in your framework currently returns `Invalid request body` — meaning the Analytics addon needs to be enabled on your Sandbox account dashboard, and the payload format needs one small tweak. Once enabled, this becomes the most valuable part of the whole framework because it runs every month automatically and tells your accountant exactly which suppliers to chase.

---

### What to do right now — in order
```
TODAY (30 mins):
  1. gst.gov.in → Manage API Access → Enable for 30 days
  2. Run debug_gst.py (from last message) → see your actual filing history

THIS WEEK:
  3. Run the OTP flow once → get taxpayer token → save it
  4. Use that token to fetch your GSTR-2A (what suppliers filed for you)
  5. Compare against your purchase ledger → find ITC gaps

THIS MONTH:
  6. Upload your actual invoice data for GSTR-1
  7. File GSTR-1 via API for the first time
  8. Set up reconciliation as a monthly scheduled job