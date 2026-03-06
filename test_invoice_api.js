// Save as: test_invoice_api.js
const http = require('http');

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body: body });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function testInvoiceSave() {
  try {
    // Fetch real client and company IDs
    console.log('Fetching clients...');
    const clientsRes = await makeRequest('GET', '/api/clients');
    const clients = clientsRes.body;
    if (!clients || clients.length === 0) {
      console.error('No clients found. Please create a client first.');
      return;
    }
    const clientId = clients[0].id;
    console.log('Using client:', clientId, clients[0].name);

    console.log('Fetching companies...');
    const companiesRes = await makeRequest('GET', '/api/companies');
    const companies = companiesRes.body;
    let companyId = null;
    if (companies && companies.length > 0) {
      companyId = companies[0].id;
      console.log('Using company:', companyId, companies[0].name);
    }

    // Now test invoice save
    const invoicePayload = {
      invoiceNumber: "DL/01/2025-26/TEST-" + Date.now(),
      clientId: clientId,
      companyId: companyId,
      invoiceDate: "2026-03-06",
      dueDate: "2026-03-20",
      placeOfSupply: "Delhi (07)",
      bankName: "HDFC BANK LIMITED",
      bankBranch: "CC-31, COMMERCIAL COMPLEX, NARAINA IND AREA",
      bankAccount: "50200003760432",
      ifsc: "HDFC0000440",
      subtotal: 1000,
      cgst: 90,
      sgst: 90,
      total: 1180,
      status: "draft",
      signatureTitle: "PARTNER",
      items: [
        {
          description: "Test Service",
          detailedDescription: "Testing invoice save",
          hsnSac: "999293",
          quantity: 1,
          rate: 1000,
          cgstPercent: 9,
          sgstPercent: 9,
          amount: 1000
        }
      ]
    };

    console.log('\nSaving invoice...');
    const saveRes = await makeRequest('POST', '/api/invoices', invoicePayload);
    console.log('Status:', saveRes.status);
    console.log('Response:', JSON.stringify(saveRes.body, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testInvoiceSave();