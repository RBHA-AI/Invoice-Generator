import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

function Companies() {
  const [companies, setCompanies] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    gstin: '',
    msmeNumber: ''
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/companies');
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
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        fetchCompanies();
        closeModal();
      }
    } catch (error) {
      console.error('Error saving company:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this company?')) {
      try {
        await fetch(`/api/companies/${id}`, { method: 'DELETE' });
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
        gstin: company.gstin || '',
        msmeNumber: company.msmeNumber || ''
      });
    } else {
      setEditingCompany(null);
      setFormData({
        name: '',
        address: '',
        gstin: '',
        msmeNumber: ''
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
      gstin: '',
      msmeNumber: ''
    });
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

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
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Company Name</th>
                <th>GSTIN</th>
                <th>MSME Number</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center" style={{ padding: '3rem', color: 'var(--text-light)' }}>
                    No companies found. Add your first company to get started.
                  </td>
                </tr>
              ) : (
                companies.map(company => (
                  <tr key={company.id}>
                    <td style={{ fontWeight: 500 }}>{company.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{company.gstin || '-'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{company.msmeNumber || '-'}</td>
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
