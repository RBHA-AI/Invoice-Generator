import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { apiFetch } from '../utils/api';

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

function ImportedInvoiceUpload() {
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const uploadFile = useCallback(async (file) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiFetch('/api/imported-invoices/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      navigate(`/imported-invoices/${data.id}/edit`);
    } catch (e) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [navigate]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Upload Invoice</h1>
        <p className="page-subtitle">
          Upload a photo or PDF of an invoice. AI will extract fields for you to review and edit.
        </p>
      </div>

      <div className="card">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 12,
            padding: '3rem 2rem',
            textAlign: 'center',
            background: dragOver ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-secondary, #fafafa)',
            cursor: uploading ? 'wait' : 'pointer'
          }}
          onClick={() => !uploading && document.getElementById('imported-file-input')?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
              e.preventDefault();
              document.getElementById('imported-file-input')?.click();
            }
          }}
        >
          <Upload size={48} style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} />
          <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {uploading ? 'Extracting invoice data…' : 'Drop invoice image or PDF here'}
          </p>
          <p style={{ color: 'var(--text-light)', marginBottom: '1rem' }}>
            JPEG, PNG, WebP, or PDF — max 10 MB
          </p>
          {!uploading && (
            <button type="button" className="btn btn-primary" onClick={(e) => e.stopPropagation()}>
              <label htmlFor="imported-file-input" style={{ cursor: 'pointer', margin: 0 }}>
                Choose file
              </label>
            </button>
          )}
          <input
            id="imported-file-input"
            type="file"
            accept={ACCEPT}
            style={{ display: 'none' }}
            onChange={onFileChange}
            disabled={uploading}
          />
        </div>

        {error && (
          <p style={{ color: '#b91c1c', marginTop: '1rem' }}>{error}</p>
        )}
      </div>
    </div>
  );
}

export default ImportedInvoiceUpload;
