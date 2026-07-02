'use client';

import { useState, useEffect } from 'react';

const LEAVE_TYPES = ['Paid Leave', 'Unpaid Leave', 'Sick Leave', 'Casual Leave', 'Other'];

export default function AdminLeavePage() {
  const [leaves, setLeaves] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    staffId: '',
    fromDate: '',
    toDate: '',
    leaveType: 'Casual Leave',
    reason: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      loadLeaves();
      loadStaff();
    }
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

  async function loadLeaves() {
    try {
      const res = await fetch(`/api/admin/leave?companyId=${selectedCompany}`);
      const data = await res.json();
      setLeaves(data.leaves || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadStaff() {
    try {
      const res = await fetch(`/api/admin/staff?companyId=${selectedCompany}`);
      const data = await res.json();
      setStaffList((data.staff || []).filter(s => s.status === 'active'));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, companyId: selectedCompany }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add leave');
      } else {
        setShowModal(false);
        setForm({ staffId: '', fromDate: '', toDate: '', leaveType: 'Casual Leave', reason: '' });
        loadLeaves();
      }
    } catch {
      setError('Network error');
    }
    setSaving(false);
  }

  async function handleCancel(id) {
    if (!confirm('Are you sure you want to cancel this leave?')) return;
    try {
      const res = await fetch(`/api/admin/leave?id=${id}`, { method: 'DELETE' });
      if (res.ok) loadLeaves();
    } catch (err) {
      console.error(err);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  if (loading) {
    return <div className="loading" style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  const isSuperAdmin = admin?.role === 'super_admin';

  return (
    <div>
      <div className="page-header">
        <h1>Leave Management</h1>
        <div className="page-actions">
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
          <button className="btn btn-primary" onClick={() => { setError(''); setShowModal(true); }}>
            + Add Leave
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Staff Name</th>
              <th>From</th>
              <th>To</th>
              <th>Leave Type</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map(l => (
              <tr key={l.id}>
                <td style={{ fontWeight: '500' }}>{l.staff?.name || 'Unknown'}</td>
                <td>{formatDate(l.from_date)}</td>
                <td>{formatDate(l.to_date)}</td>
                <td>
                  <span className="badge badge-leave">{l.leave_type}</span>
                </td>
                <td className="text-secondary" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {l.reason || '-'}
                </td>
                <td>
                  <span className={`badge ${l.status === 'approved' ? 'badge-present' : 'badge-absent'}`}>
                    {l.status}
                  </span>
                </td>
                <td>
                  {l.status === 'approved' && (
                    <button className="btn btn-sm btn-danger" onClick={() => handleCancel(l.id)}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {leaves.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center text-muted" style={{ padding: '2rem' }}>
                  No leave records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Leave Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Leave</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label className="form-label">Staff</label>
                  <select
                    className="form-select"
                    value={form.staffId}
                    onChange={e => setForm({ ...form, staffId: e.target.value })}
                    required
                  >
                    <option value="">Select Staff</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">From Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.fromDate}
                    onChange={e => setForm({ ...form, fromDate: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">To Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.toDate}
                    onChange={e => setForm({ ...form, toDate: e.target.value })}
                    min={form.fromDate}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Leave Type</label>
                  <select
                    className="form-select"
                    value={form.leaveType}
                    onChange={e => setForm({ ...form, leaveType: e.target.value })}
                    required
                  >
                    {LEAVE_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reason</label>
                  <textarea
                    className="form-textarea"
                    value={form.reason}
                    onChange={e => setForm({ ...form, reason: e.target.value })}
                    placeholder="e.g. Personal work"
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Add Leave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
