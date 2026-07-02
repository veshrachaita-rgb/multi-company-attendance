'use client';

import { useState, useEffect } from 'react';

export default function AdminDevicesPage() {
  const [companies, setCompanies] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (selectedCompany) loadDevices();
  }, [selectedCompany]);

  async function loadInitial() {
    try {
      const [dashRes, compRes] = await Promise.all([
        fetch('/api/admin/dashboard'),
        fetch('/api/admin/companies'),
      ]);
      const dashData = await dashRes.json();
      const compData = await compRes.json();
      setAdmin(dashData.admin);
      setCompanies(compData.companies || []);
      const cid = dashData.admin.role === 'company_admin'
        ? dashData.admin.companyId
        : compData.companies?.[0]?.id || '';
      setSelectedCompany(cid);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function loadDevices() {
    try {
      const res = await fetch(`/api/admin/devices?companyId=${selectedCompany}`);
      const data = await res.json();
      if (data.devices) {
        setDevices(data.devices);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function updateStatus(deviceId, newStatus) {
    if (!confirm(`Are you sure you want to ${newStatus} this device?`)) return;
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, status: newStatus }),
      });
      if (res.ok) {
        loadDevices();
      } else {
        alert('Failed to update device.');
      }
    } catch (err) {
      alert('Error updating device.');
    }
  }

  if (loading) return <div className="loading" style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;

  const isSuperAdmin = admin?.role === 'super_admin';

  return (
    <div>
      <div className="page-header">
        <h1>Device Management</h1>
        {isSuperAdmin && companies.length > 1 && (
          <div className="company-selector">
            <label>Company:</label>
            <select
              className="form-select"
              value={selectedCompany}
              onChange={e => setSelectedCompany(e.target.value)}
              style={{ minWidth: '180px' }}
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Registered Staff Devices</h3>
        </div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Device Info</th>
                <th>Registered At</th>
                <th>Last Used</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center' }}>No devices registered yet.</td>
                </tr>
              ) : (
                devices.map(device => (
                  <tr key={device.id}>
                    <td>{device.staff?.name || 'Unknown'}</td>
                    <td>
                      <div><strong>{device.device_label}</strong></div>
                      <small className="text-muted" style={{ display: 'block', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={device.browser_info}>
                        {device.browser_info}
                      </small>
                    </td>
                    <td>{new Date(device.registered_at).toLocaleString()}</td>
                    <td>{new Date(device.last_used_at).toLocaleString()}</td>
                    <td>
                      <span className={`badge badge-${
                        device.status === 'active' ? 'success' : 
                        device.status === 'blocked' ? 'danger' : 'warning'
                      }`}>
                        {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                      </span>
                    </td>
                    <td>
                      {device.status === 'active' && (
                        <>
                          <button 
                            className="btn btn-sm btn-outline"
                            style={{ marginRight: '0.5rem', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                            onClick={() => updateStatus(device.id, 'blocked')}
                          >
                            Block
                          </button>
                          <button 
                            className="btn btn-sm btn-outline"
                            onClick={() => updateStatus(device.id, 'reset')}
                          >
                            Reset
                          </button>
                        </>
                      )}
                      {device.status === 'blocked' && (
                        <button 
                          className="btn btn-sm btn-outline"
                          onClick={() => updateStatus(device.id, 'reset')}
                        >
                          Reset
                        </button>
                      )}
                      {device.status === 'reset' && (
                        <span className="text-muted"><small>Ready for new registration</small></span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
