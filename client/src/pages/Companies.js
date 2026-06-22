import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { apiFetch } from '../utils/api';

function Companies() {
  const [companies, setCompanies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    state: '',
    signatureTitle: '',
    gstin: '',
    msmeNumber: '',
    email: '',
    phone: '',
    bankName: '',
    bankBranch: '',
    bankAccount: '',
    ifsc: '',
    logo: null
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await apiFetch('/api/companies');
      const data = await response.json();
      setCompanies(data);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingCompany 
        ? `/api/companies/${editingCompany.id}` 
        : '/api/companies';
      
      const method = editingCompany ? 'PUT' : 'POST';
      
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('address', formData.address);
      formDataToSend.append('state', formData.state);
      formDataToSend.append('signatureTitle', formData.signatureTitle);
      formDataToSend.append('gstin', formData.gstin);
      formDataToSend.append('msmeNumber', formData.msmeNumber);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('phone', formData.phone);
      formDataToSend.append('bankName', formData.bankName);
      formDataToSend.append('bankBranch', formData.bankBranch);
      formDataToSend.append('bankAccount', formData.bankAccount);
      formDataToSend.append('ifsc', formData.ifsc);
      if (formData.logo) {
        formDataToSend.append('logo', formData.logo);
      }
      
      const response = await apiFetch(url, {
        method,
        body: formDataToSend
      });
      
      if (response.ok) {
        fetchCompanies();
        closeModal();
      } else {
        console.error('Error updating company:', await response.text());
      }
    } catch (error) {
      console.error('Error saving company:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this company?')) {
      try {
        await apiFetch(`/api/companies/${id}`, { method: 'DELETE' });
        fetchCompanies();
      } catch (error) {
        console.error('Error deleting company:', error);
      }
    }
  };

  const openModal = (company = null) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        name: company.name || '',
        address: company.address || '',
        state: company.state || '',
        signatureTitle: company.signatureTitle || '',
        gstin: company.gstin || '',
        msmeNumber: company.msmeNumber || '',
        email: company.email || '',
        phone: company.phone || '',
        bankName: company.bankName || '',
        bankBranch: company.bankBranch || '',
        bankAccount: company.bankAccount || '',
        ifsc: company.ifsc || '',
        logo: null // Reset file input
      });
    } else {
      setEditingCompany(null);
      setFormData({
        name: '',
        address: '',
        state: '',
        signatureTitle: '',
        gstin: '',
        msmeNumber: '',
        email: '',
        phone: '',
        bankName: '',
        bankBranch: '',
        bankAccount: '',
        ifsc: '',
        logo: null
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCompany(null);
    setFormData({
      name: '',
      address: '',
      state: '',
      signatureTitle: '',
      gstin: '',
      msmeNumber: '',
      email: '',
      phone: '',
      bankName: '',
      bankBranch: '',
      bankAccount: '',
      ifsc: '',
      logo: null
    });
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e) => {
    setFormData({
      ...formData,
      logo: e.target.files[0]
    });
  };

  const filteredCompanies = [...companies]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }))
    .filter((company) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        String(company.name || '').toLowerCase().includes(q) ||
        String(company.gstin || '').toLowerCase().includes(q) ||
        String(company.msmeNumber || '').toLowerCase().includes(q) ||
        String(company.email || '').toLowerCase().includes(q) ||
        String(company.phone || '').toLowerCase().includes(q) ||
        String(company.bankName || '').toLowerCase().includes(q) ||
        String(company.ifsc || '').toLowerCase().includes(q)
      );
    });

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Companies</h1>
          <p className="page-subtitle">Manage your companies</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} />
          Add Company
        </button>
      </div>

      <div className="card">
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search companies by name, GSTIN, MSME, email, phone, bank..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Logo</th>
                <th>Company Name</th>
                <th>GSTIN</th>
                <th>MSME Number</th>
                <th>Email / Phone</th>
                <th>Bank Name</th>
                <th>Branch</th>
                <th>Account</th>
                <th>IFSC</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan="11" className="text-center" style={{ padding: '3rem', color: 'var(--text-light)' }}>
                    {companies.length === 0
                      ? 'No companies found. Add your first company to get started.'
                      : 'No companies match your search.'}
                  </td>
                </tr>
              ) : (
                filteredCompanies.map(company => (
                  <tr key={company.id}>
                    <td>
                      {company.logo ? (
                        <>
                          <img 
                            src={company.logo} 
                            alt={`${company.name} logo`} 
                            style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'block';
                            }}
                          />
                          <div style={{ display: 'none', width: '40px', height: '40px', backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}>
                            <span style={{ fontSize: '10px', color: '#666' }}>No Logo</span>
                          </div>
                        </>
                      ) : (
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}>
                          <span style={{ fontSize: '12px', color: '#666' }}>No Logo</span>
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>{company.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{company.gstin || '-'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{company.msmeNumber || '-'}</td>
                    <td>
                      <div>{company.email || '-'}</div>
                      <div style={{ fontSize: '0.875rem', color: '#666' }}>{company.phone || '-'}</div>
                    </td>
                    <td>{company.bankName || '-'}</td>
                    <td>{company.bankBranch || '-'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{company.bankAccount || '-'}</td>
                    <td>{company.ifsc || '-'}</td>
                    <td style={{ maxWidth: 250, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {company.address || '-'}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '0.5rem 0.75rem' }}
                          onClick={() => openModal(company)}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '0.5rem 0.75rem' }}
                          onClick={() => handleDelete(company.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingCompany ? 'Edit Company' : 'Add New Company'}
              </h2>
              <button className="modal-close" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">
                    Company Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    className="form-input"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">GSTIN</label>
                  <input
                    type="text"
                    name="gstin"
                    className="form-input"
                    value={formData.gstin}
                    onChange={handleInputChange}
                    placeholder="07AAQFR3892K1ZE"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">MSME Number</label>
                  <input
                    type="text"
                    name="msmeNumber"
                    className="form-input"
                    value={formData.msmeNumber}
                    onChange={handleInputChange}
                    placeholder="UDYAM-DL-01-0123456"
                  />
                </div>

                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      name="email"
                      className="form-input"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="company@example.com"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      className="form-input"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <input
                    type="text"
                    name="bankName"
                    className="form-input"
                    value={formData.bankName}
                    onChange={handleInputChange}
                    placeholder="HDFC BANK LIMITED"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Branch</label>
                  <input
                    type="text"
                    name="bankBranch"
                    className="form-input"
                    value={formData.bankBranch}
                    onChange={handleInputChange}
                    placeholder="Branch address"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Account Number</label>
                  <input
                    type="text"
                    name="bankAccount"
                    className="form-input"
                    value={formData.bankAccount}
                    onChange={handleInputChange}
                    placeholder="50200003760432"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">IFSC Code</label>
                  <input
                    type="text"
                    name="ifsc"
                    className="form-input"
                    value={formData.ifsc}
                    onChange={handleInputChange}
                    placeholder="HDFC0000440"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea
                    name="address"
                    className="form-textarea"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Complete address of the company"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">State / UT</label>
                  <select
                    name="state"
                    className="form-input"
                    value={formData.state}
                    onChange={handleInputChange}
                  >
                    <option value="">Select state</option>
                    <option value="Andhra Pradesh">Andhra Pradesh</option>
                    <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                    <option value="Assam">Assam</option>
                    <option value="Bihar">Bihar</option>
                    <option value="Chhattisgarh">Chhattisgarh</option>
                    <option value="Goa">Goa</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Haryana">Haryana</option>
                    <option value="Himachal Pradesh">Himachal Pradesh</option>
                    <option value="Jharkhand">Jharkhand</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Kerala">Kerala</option>
                    <option value="Madhya Pradesh">Madhya Pradesh</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Manipur">Manipur</option>
                    <option value="Meghalaya">Meghalaya</option>
                    <option value="Mizoram">Mizoram</option>
                    <option value="Nagaland">Nagaland</option>
                    <option value="Odisha">Odisha</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Rajasthan">Rajasthan</option>
                    <option value="Sikkim">Sikkim</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Telangana">Telangana</option>
                    <option value="Tripura">Tripura</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="Uttarakhand">Uttarakhand</option>
                    <option value="West Bengal">West Bengal</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Puducherry">Puducherry</option>
                    <option value="Chandigarh">Chandigarh</option>
                    <option value="Andaman and Nicobar Islands">Andaman and Nicobar Islands</option>
                    <option value="Dadra and Nagar Haveli and Daman and Diu">Dadra and Nagar Haveli and Daman and Diu</option>
                    <option value="Lakshadweep">Lakshadweep</option>
                    <option value="Ladakh">Ladakh</option>
                    <option value="Jammu and Kashmir">Jammu and Kashmir</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Signature Title</label>
                  <input
                    type="text"
                    name="signatureTitle"
                    className="form-input"
                    value={formData.signatureTitle}
                    onChange={handleInputChange}
                    placeholder="PARTNER / AUTHORISED SIGNATORY / DIRECTOR"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Company Logo</label>
                  <input
                    key={editingCompany ? editingCompany.id : 'new'}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="form-input"
                  />
                  {editingCompany && editingCompany.logo && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <img 
                        src={editingCompany.logo} 
                        alt="Current logo" 
                        style={{ width: '100px', height: '100px', objectFit: 'contain', border: '1px solid #ddd', borderRadius: '4px' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'block';
                        }}
                      />
                      <div style={{ display: 'none', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px', textAlign: 'center' }}>
                        Current logo file not found
                      </div>
                      <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                        Upload a new logo to replace the current one
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCompany ? 'Update Company' : 'Add Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Companies;
