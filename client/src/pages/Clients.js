import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

function Clients() {
  const [clients, setClients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    gstin: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstTreatment: 'Registered',
    primaryContactName: '',
    primaryContactEmail: '',
    primaryContactPhone: ''
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients');
      const data = await response.json();
      setClients(data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingClient 
        ? `/api/clients/${editingClient.id}` 
        : '/api/clients';
      
      const method = editingClient ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        fetchClients();
        closeModal();
      }
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      try {
        await fetch(`/api/clients/${id}`, { method: 'DELETE' });
        fetchClients();
      } catch (error) {
        console.error('Error deleting client:', error);
      }
    }
  };

  const openModal = (client = null) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name || '',
        gstin: client.gstin || '',
        address: client.address || '',
        city: client.city || '',
        state: client.state || '',
        pincode: client.pincode || '',
        gstTreatment: client.gstTreatment || 'Registered',
        primaryContactName: client.primaryContactName || '',
        primaryContactEmail: client.primaryContactEmail || '',
        primaryContactPhone: client.primaryContactPhone || ''
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        gstin: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        gstTreatment: 'Registered',
        primaryContactName: '',
        primaryContactEmail: '',
        primaryContactPhone: ''
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClient(null);
    setFormData({
      name: '',
      gstin: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      gstTreatment: 'Registered',
      primaryContactName: '',
      primaryContactEmail: '',
      primaryContactPhone: ''
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
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Manage your client database</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} />
          Add Client
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>GSTIN</th>
                <th>City</th>
                <th>State</th>
                <th>Pincode</th>
                <th>Contact</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center" style={{ padding: '3rem', color: 'var(--text-light)' }}>
                    No clients found. Add your first client to get started.
                  </td>
                </tr>
              ) : (
                clients.map(client => (
                  <tr key={client.id}>
                    <td style={{ fontWeight: 500 }}>{client.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{client.gstin}</td>
                    <td>{client.city}</td>
                    <td>{client.state}</td>
                    <td>{client.pincode}</td>
                    <td style={{ maxWidth: 200 }}>{client.primaryContactName || client.primaryContactEmail || ''}</td>
                    <td>
                      <div className="flex gap-2">
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '0.5rem 0.75rem' }}
                          onClick={() => openModal(client)}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '0.5rem 0.75rem' }}
                          onClick={() => handleDelete(client.id)}
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
                {editingClient ? 'Edit Client' : 'Add New Client'}
              </h2>
              <button className="modal-close" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">
                    Client Name <span className="required">*</span>
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
                    placeholder="07AAECR1202J2ZP"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea
                    name="address"
                    className="form-textarea"
                    value={formData.address}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input
                      type="text"
                      name="city"
                      className="form-input"
                      value={formData.city}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">State</label>
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
                </div>

                <div className="form-group">
                  <label className="form-label">Pincode</label>
                  <input
                    type="text"
                    name="pincode"
                    className="form-input"
                    value={formData.pincode}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">GST Treatment</label>
                  <select
                    name="gstTreatment"
                    className="form-input"
                    value={formData.gstTreatment}
                    onChange={handleInputChange}
                  >
                    <option value="Registered">Registered - Regular</option>
                    <option value="Composition">Registered - Composition</option>
                    <option value="Unregistered">Unregistered</option>
                    <option value="Consumer">Consumer</option>
                    <option value="SEZ">SEZ / Special</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Primary Contact Name</label>
                  <input
                    type="text"
                    name="primaryContactName"
                    className="form-input"
                    value={formData.primaryContactName}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Primary Contact Email</label>
                  <input
                    type="email"
                    name="primaryContactEmail"
                    className="form-input"
                    value={formData.primaryContactEmail}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Primary Contact Phone</label>
                  <input
                    type="text"
                    name="primaryContactPhone"
                    className="form-input"
                    value={formData.primaryContactPhone}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingClient ? 'Update Client' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Clients;
