'use client';

import { useState, useEffect, useRef } from 'react';

export default function AdminQRPage() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [admin, setAdmin] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [scanUrl, setScanUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const dashRes = await fetch('/api/admin/dashboard');
        const dashData = await dashRes.json();
        setAdmin(dashData.admin);

        const compRes = await fetch('/api/admin/companies');
        const compData = await compRes.json();
        setCompanies(compData.companies || []);

        // Auto-select company for company admin
        if (dashData.admin.role === 'company_admin' && dashData.admin.companyId) {
          setSelectedCompany(dashData.admin.companyId);
        } else if (compData.companies?.length > 0) {
          setSelectedCompany(compData.companies[0].id);
        }
      } catch (err) {
        console.error('QR page error:', err);
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedCompany || companies.length === 0) return;

    const company = companies.find(c => c.id === selectedCompany);
    if (!company) return;

    const appUrl = window.location.origin;
    const url = `${appUrl}/scan/${company.company_slug}`;
    setScanUrl(url);

    // Generate QR using the qrcode library
    import('qrcode').then(QRCode => {
      QRCode.toDataURL(url, {
        width: 600,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      }).then(dataUrl => {
        setQrDataUrl(dataUrl);
      });
    });
  }, [selectedCompany, companies]);

  function handleDownload() {
    if (!qrDataUrl) return;
    const company = companies.find(c => c.id === selectedCompany);
    const link = document.createElement('a');
    link.download = `QR_${company?.company_slug || 'attendance'}.png`;
    link.href = qrDataUrl;
    link.click();
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return <div className="loading" style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  const isSuperAdmin = admin?.role === 'super_admin';
  const company = companies.find(c => c.id === selectedCompany);

  return (
    <div>
      <div className="page-header">
        <h1>QR Code</h1>
        {isSuperAdmin && companies.length > 1 && (
          <div className="company-selector no-print">
            <label>Company:</label>
            <select
              className="form-select"
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              style={{ minWidth: '200px' }}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="qr-container">
        <div className="qr-card">
          <h2 style={{ marginBottom: '0.5rem' }}>{company?.company_name || 'Company'}</h2>
          <p className="text-secondary" style={{ marginBottom: '1.5rem' }}>
            Scan this QR code to mark attendance
          </p>

          {qrDataUrl ? (
            <div className="qr-image">
              <img src={qrDataUrl} alt="QR Code for attendance" />
            </div>
          ) : (
            <div className="loading" style={{ padding: '2rem' }}>Generating QR...</div>
          )}

          <div className="qr-url no-print">
            {scanUrl}
          </div>

          <div className="qr-actions no-print">
            <button className="btn btn-primary" onClick={handleDownload}>
              ⬇️ Download QR
            </button>
            <button className="btn btn-outline" onClick={handlePrint}>
              🖨️ Print QR
            </button>
          </div>
        </div>

        <div className="no-print" style={{
          background: 'var(--color-info-light)',
          border: '1px solid #bfdbfe',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-lg)',
          fontSize: '0.875rem',
          color: 'var(--color-info)',
          width: '100%',
        }}>
          <strong>📌 Instructions:</strong>
          <ol style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', lineHeight: '1.8' }}>
            <li>Download or print this QR code</li>
            <li>Stick it at the office door entrance</li>
            <li>Staff scan the QR with their phone camera</li>
            <li>The attendance page opens in the browser</li>
            <li>Staff select their name and tap Check In / Check Out</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
