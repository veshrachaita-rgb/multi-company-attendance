'use client';

import { useState, useEffect } from 'react';

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCompany, setEditCompany] = useState(null);
  const [form, setForm] = useState({ companyName: '', companySlug: '', status: 'active' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Admin creation
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', password: '', name: '', companyId: '', role: 'company_admin' });
  const [admins, setAdmins] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [compRes, adminRes] = await Promise.all([
        fetch('/api/admin/companies'),
        fetch('/api/admin/company-admins'),
      ]);
      const compData = await compRes.json();
      setCompanies(compData.companies || []);
      if (adminRes.ok) {
        const adminData = await adminRes.json();
        setAdmins(adminData.admins || []);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  function openAdd() {
    setEditCompany(null);
    setForm({ companyName: '', companySlug: '', status: 'active' });
    setError('');
    setShowModal(true);
  }

  function openEdit(company) {
    setEditCompany(company);
    setForm({
      companyName: company.company_name,
      companySlug: company.company_slug,
      status: company.status,
    });
    setError('');
    setShowModal(true);
  }

  function generateSlug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const url = '/api/admin/companies';
      const method = editCompany ? 'PUT' : 'POST';
      const body = editCompany
        ? { id: editCompany.id, ...form }
        : form;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save');
      } else {
        setShowModal(false);
        loadData();
      }
    } catch {
      setError('Network error');
    }
    setSaving(false);
  }

  async function handleCreateAdmin(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/admin/company-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminForm),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create admin');
      } else {
        setShowAdminModal(false);
        setAdminForm({ email: '', password: '', name: '', companyId: '', role: 'company_admin' });
        loadData();
      }
    } catch {
      setError('Network error');
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="loading" style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Companies</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openAdd}>+ Add Company</button>
          <button className="btn btn-outline" onClick={() => { setError(''); setShowAdminModal(true); }}>
            + Create Admin
          </button>
        </div>
      </div>

      {/* Companies Table */}
      <div className="table-container mb-lg">
        <table className="table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: '500' }}>{c.company_name}</td>
                <td><code style={{ fontSize: '0.8125rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{c.company_slug}</code></td>
                <td>
                  <span className={`badge badge-${c.status}`}>{c.status}</span>
                </td>
                <td className="text-secondary">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                <td>
                  <button className="btn btn-sm btn-outline" onClick={() => openEdit(c)}>Edit</button>
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center text-muted" style={{ padding: '2rem' }}>
                  No companies yet. Click &quot;Add Company&quot; to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Admins Table */}
      <div className="card">
        <div className="card-header">
          <h3>Admin Users</h3>
        </div>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Company</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: '500' }}>{a.name}</td>
                  <td className="text-secondary">{a.email}</td>
                  <td>
                    <span className={`badge ${a.role === 'super_admin' ? 'badge-leave' : 'badge-present'}`}>
                      {a.role === 'super_admin' ? 'Super Admin' : 'Company Admin'}
                    </span>
                  </td>
                  <td>{a.companies?.company_name || '-'}</td>
                  <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: '2rem' }}>
                    No admin users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Company Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editCompany ? 'Edit Company' : 'Add Company'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input
                    className="form-input"
                    value={form.companyName}
                    onChange={e => {
                      setForm({
                        ...form,
                        companyName: e.target.value,
                        companySlug: editCompany ? form.companySlug : generateSlug(e.target.value),
                      });
                    }}
                    placeholder="e.g. Acme Corporation"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">URL Slug</label>
                  <input
                    className="form-input"
                    value={form.companySlug}
                    onChange={e => setForm({ ...form, companySlug: e.target.value })}
                    placeholder="e.g. acme-corp"
                    pattern="[a-z0-9-]+"
                    title="Only lowercase letters, numbers and hyphens"
                    required
                  />
                  <small className="text-muted">QR will open: /scan/{form.companySlug || 'slug'}</small>
                </div>
                {editCompany && (
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
                  {saving ? 'Saving...' : editCompany ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Admin Modal */}
      {showAdminModal && (
        <div className="modal-overlay" onClick={() => setShowAdminModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Admin User</h3>
              <button className="modal-close" onClick={() => setShowAdminModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateAdmin}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    className="form-input"
                    value={adminForm.name}
                    onChange={e => setAdminForm({ ...adminForm, name: e.target.value })}
                    placeholder="Admin name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={adminForm.email}
                    onChange={e => setAdminForm({ ...adminForm, email: e.target.value })}
                    placeholder="admin@company.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-input"
                    value={adminForm.password}
                    onChange={e => setAdminForm({ ...adminForm, password: e.target.value })}
                    placeholder="Minimum 6 characters"
                    minLength={6}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={adminForm.role}
                    onChange={e => setAdminForm({ ...adminForm, role: e.target.value })}
                  >
                    <option value="company_admin">Company Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                {adminForm.role === 'company_admin' && (
                  <div className="form-group">
                    <label className="form-label">Assigned Company</label>
                    <select
                      className="form-select"
                      value={adminForm.companyId}
                      onChange={e => setAdminForm({ ...adminForm, companyId: e.target.value })}
                      required
                    >
                      <option value="">Select Company</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.company_name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAdminModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
