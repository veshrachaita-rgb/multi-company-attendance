'use client';

import { useState, useEffect } from 'react';

export default function AdminSettingsPage() {
  const [companies, setCompanies] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [settings, setSettings] = useState({
    companyName: '',
    officeStartTime: '10:00',
    officeEndTime: '19:00',
    lateAfterTime: '10:15',
    accountantStartTime: '10:00',
    accountantEndTime: '19:00',
    accountantLateAfterTime: '10:15',
    officeLatitude: '',
    officeLongitude: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (selectedCompany) loadSettings();
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

  async function loadSettings() {
    try {
      const res = await fetch(`/api/admin/settings?companyId=${selectedCompany}`);
      const data = await res.json();
      if (data.settings) {
        setSettings({
          companyName: data.companyName || '',
          officeStartTime: data.settings.office_start_time || '10:00',
          officeEndTime: data.settings.office_end_time || '19:00',
          lateAfterTime: data.settings.late_after_time || '10:15',
          accountantStartTime: data.settings.accountant_start_time || '10:00',
          accountantEndTime: data.settings.accountant_end_time || '19:00',
          accountantLateAfterTime: data.settings.accountant_late_after_time || '10:15',
          officeLatitude: data.settings.office_latitude || '',
          officeLongitude: data.settings.office_longitude || '',
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, companyId: selectedCompany }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="loading" style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  const isSuperAdmin = admin?.role === 'super_admin';

  return (
    <div>
      <div className="page-header">
        <h1>Office Settings</h1>
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

      <div className="card" style={{ maxWidth: '500px' }}>
        <div className="card-header">
          <h3>Office Hours (Normal Staff)</h3>
        </div>
        <div className="card-body">
          {message && (
            <div className={`alert alert-${message.type}`}>{message.text}</div>
          )}

          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input
                type="text"
                className="form-input"
                value={settings.companyName}
                onChange={e => setSettings({ ...settings, companyName: e.target.value })}
                required
                placeholder="e.g. Acme Corporation"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Office Start Time</label>
              <input
                type="time"
                className="form-input"
                value={settings.officeStartTime}
                onChange={e => setSettings({ ...settings, officeStartTime: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Late After Time</label>
              <input
                type="time"
                className="form-input"
                value={settings.lateAfterTime}
                onChange={e => setSettings({ ...settings, lateAfterTime: e.target.value })}
                required
              />
              <small className="text-muted">Staff checking in after this time will be marked Late</small>
            </div>

            <div className="form-group">
              <label className="form-label">Office End Time</label>
              <input
                type="time"
                className="form-input"
                value={settings.officeEndTime}
                onChange={e => setSettings({ ...settings, officeEndTime: e.target.value })}
                required
              />
            </div>

            <h4 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Accountant Hours</h4>
            <div className="form-group">
              <label className="form-label">Accountant Start Time</label>
              <input
                type="time"
                className="form-input"
                value={settings.accountantStartTime}
                onChange={e => setSettings({ ...settings, accountantStartTime: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Accountant Late After Time</label>
              <input
                type="time"
                className="form-input"
                value={settings.accountantLateAfterTime}
                onChange={e => setSettings({ ...settings, accountantLateAfterTime: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Accountant End Time</label>
              <input
                type="time"
                className="form-input"
                value={settings.accountantEndTime}
                onChange={e => setSettings({ ...settings, accountantEndTime: e.target.value })}
                required
              />
            </div>

            <h4 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Location Settings</h4>

            <div className="form-group">
              <label className="form-label">Office Latitude (GPS)</label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={settings.officeLatitude}
                onChange={e => setSettings({ ...settings, officeLatitude: parseFloat(e.target.value) })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Office Longitude (GPS)</label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={settings.officeLongitude}
                onChange={e => setSettings({ ...settings, officeLongitude: parseFloat(e.target.value) })}
                required
              />
              <small className="text-muted">Staff must be within 50 meters of these coordinates to check in/out.</small>
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
