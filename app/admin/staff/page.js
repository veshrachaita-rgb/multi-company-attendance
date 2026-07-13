'use client';

import { useState, useEffect } from 'react';
import { hasCustomTimings, toTimeInput } from '@/lib/utils/timings';

const BLANK_FORM = {
  name: '',
  employeeCode: '',
  status: 'active',
  role: 'Normal Staff',
  customTimings: false,
  startTime: '10:00',
  lateAfterTime: '10:15',
  endTime: '19:00',
};

export default function AdminStaffPage() {
  const [staff, setStaff] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editStaff, setEditStaff] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (selectedCompany) loadStaff();
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

  async function loadStaff() {
    try {
      const res = await fetch(`/api/admin/staff?companyId=${selectedCompany}`);
      const data = await res.json();
      setStaff(data.staff || []);
    } catch (err) {
      console.error(err);
    }
  }

  function openAdd() {
    setEditStaff(null);
    setForm(BLANK_FORM);
    setError('');
    setShowModal(true);
  }

  function openEdit(s) {
    setEditStaff(s);
    setForm({
      name: s.name,
      employeeCode: s.employee_code || '',
      status: s.status,
      role: s.role || 'Normal Staff',
      customTimings: hasCustomTimings(s),
      startTime: toTimeInput(s.start_time) || BLANK_FORM.startTime,
      lateAfterTime: toTimeInput(s.late_after_time) || BLANK_FORM.lateAfterTime,
      endTime: toTimeInput(s.end_time) || BLANK_FORM.endTime,
    });
    setError('');
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const method = editStaff ? 'PUT' : 'POST';
      const { customTimings, startTime, lateAfterTime, endTime, ...fields } = form;
      const timings = customTimings
        ? { startTime, lateAfterTime, endTime }
        : { startTime: null, lateAfterTime: null, endTime: null };
      const body = editStaff
        ? { id: editStaff.id, ...fields, ...timings }
        : { ...fields, ...timings, companyId: selectedCompany };

      const res = await fetch('/api/admin/staff', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save');
      } else {
        setShowModal(false);
        loadStaff();
      }
    } catch {
      setError('Network error');
    }
    setSaving(false);
  }

  async function toggleStatus(s) {
    const newStatus = s.status === 'active' ? 'inactive' : 'active';
    try {
      await fetch('/api/admin/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, status: newStatus }),
      });
      loadStaff();
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return <div className="loading" style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  const isSuperAdmin = admin?.role === 'super_admin';
  const activeCount = staff.filter(s => s.status === 'active').length;
  const inactiveCount = staff.filter(s => s.status === 'inactive').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Staff Management</h1>
          <p className="text-secondary" style={{ marginTop: '0.25rem', fontSize: '0.875rem' }}>
            {activeCount} active, {inactiveCount} inactive
          </p>
        </div>
        <div className="page-actions">
          {isSuperAdmin && companies.length > 1 && (
            <div className="company-selector">
              <label>Company:</label>
              <select
                className="form-select"
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                style={{ minWidth: '180px' }}
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </div>
          )}
          <button className="btn btn-primary" onClick={openAdd}>+ Add Staff</button>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Employee Code</th>
              <th>Role</th>
              <th>Timings</th>
              <th>Status</th>
              <th>Added On</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: '500' }}>{s.name}</td>
                <td><code style={{ fontSize: '0.8125rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{s.employee_code || '-'}</code></td>
                <td><span className="badge" style={{background: '#e2e8f0', color: '#475569'}}>{s.role || 'Normal Staff'}</span></td>
                <td style={{ fontSize: '0.8125rem' }}>
                  {hasCustomTimings(s)
                    ? `${toTimeInput(s.start_time) || '-'} – ${toTimeInput(s.end_time) || '-'}`
                    : <span className="text-muted">Default</span>}
                </td>
                <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                <td className="text-secondary">{new Date(s.created_at).toLocaleDateString('en-IN')}</td>
                <td>
                  <div className="flex gap-sm">
                    <button className="btn btn-sm btn-outline" onClick={() => openEdit(s)}>Edit</button>
                    <button
                      className={`btn btn-sm ${s.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                      onClick={() => toggleStatus(s)}
                      style={{ fontSize: '0.75rem' }}
                    >
                      {s.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center text-muted" style={{ padding: '2rem' }}>
                  No staff members. Click &quot;Add Staff&quot; to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editStaff ? 'Edit Staff' : 'Add Staff'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label className="form-label">Staff Name</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Sandeep Kumar"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Employee Code (optional)</label>
                  <input
                    className="form-input"
                    value={form.employeeCode}
                    onChange={e => setForm({ ...form, employeeCode: e.target.value })}
                    placeholder="e.g. EMP001"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="Normal Staff">Normal Staff</option>
                    <option value="Accountant">Accountant</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.customTimings}
                      onChange={e => setForm({ ...form, customTimings: e.target.checked })}
                    />
                    Use custom timings for this person
                  </label>
                  <small className="text-muted">
                    Leave this off to follow the {form.role === 'Accountant' ? 'Accountant' : 'Office'} Hours set in Settings.
                  </small>
                </div>

                {form.customTimings && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Start Time</label>
                      <input
                        type="time"
                        className="form-input"
                        value={form.startTime}
                        onChange={e => setForm({ ...form, startTime: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Late After Time</label>
                      <input
                        type="time"
                        className="form-input"
                        value={form.lateAfterTime}
                        onChange={e => setForm({ ...form, lateAfterTime: e.target.value })}
                        required
                      />
                      <small className="text-muted">Only this time decides Late. Checking in after it marks them Late.</small>
                    </div>
                    <div className="form-group">
                      <label className="form-label">End Time</label>
                      <input
                        type="time"
                        className="form-input"
                        value={form.endTime}
                        onChange={e => setForm({ ...form, endTime: e.target.value })}
                        required
                      />
                      <small className="text-muted">For reference only. Checking out early never marks anyone Late.</small>
                    </div>
                  </>
                )}

                {editStaff && (
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={form.status}
                      onChange={e => setForm({ ...form, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editStaff ? 'Update' : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
