'use client';

import { useState, useEffect } from 'react';

export default function AdminAttendancePage() {
  const [attendance, setAttendance] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    companyId: '',
    date: new Date().toISOString().split('T')[0],
    month: '',
    staffId: '',
    status: '',
  });
  const [filterMode, setFilterMode] = useState('date');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [editForm, setEditForm] = useState({ status: '', remarks: '' });
  const [saving, setSaving] = useState(false);

  // For selfie modal
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageSrc, setModalImageSrc] = useState('');

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (filters.companyId) {
      loadAttendance();
      loadStaff();
    }
  }, [filters.companyId, filters.date, filters.month, filters.staffId, filters.status, filterMode]);

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
      setFilters(f => ({ ...f, companyId: cid }));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function loadAttendance() {
    try {
      const params = new URLSearchParams();
      params.set('companyId', filters.companyId);
      if (filterMode === 'date' && filters.date) params.set('date', filters.date);
      if (filterMode === 'month' && filters.month) params.set('month', filters.month);
      if (filters.staffId) params.set('staffId', filters.staffId);
      if (filters.status) params.set('status', filters.status);

      const res = await fetch(`/api/admin/attendance?${params}`);
      const data = await res.json();
      setAttendance(data.attendance || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadStaff() {
    try {
      const res = await fetch(`/api/admin/staff?companyId=${filters.companyId}`);
      const data = await res.json();
      setStaffList(data.staff || []);
    } catch (err) {
      console.error(err);
    }
  }

  function openEdit(record) {
    setEditRecord(record);
    setEditForm({ status: record.status, remarks: record.remarks || '' });
    setShowEditModal(true);
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editRecord.id, ...editForm }),
      });
      if (res.ok) {
        setShowEditModal(false);
        loadAttendance();
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  function formatTime(timestamp) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function openImage(url) {
    if (!url) return;
    setModalImageSrc(url);
    setShowImageModal(true);
  }

  if (loading) {
    return <div className="loading" style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  const isSuperAdmin = admin?.role === 'super_admin';

  return (
    <div>
      <div className="page-header">
        <h1>Attendance Records</h1>
      </div>

      <div className="filter-bar">
        {isSuperAdmin && companies.length > 1 && (
          <div className="form-group">
            <label className="form-label">Company</label>
            <select className="form-select" value={filters.companyId} onChange={e => setFilters({ ...filters, companyId: e.target.value })}>
              {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">View By</label>
          <select className="form-select" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
            <option value="date">Date</option>
            <option value="month">Month</option>
          </select>
        </div>

        {filterMode === 'date' ? (
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={filters.date} onChange={e => setFilters({ ...filters, date: e.target.value })} />
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">Month</label>
            <input type="month" className="form-input" value={filters.month} onChange={e => setFilters({ ...filters, month: e.target.value })} />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Staff</label>
          <select className="form-select" value={filters.staffId} onChange={e => setFilters({ ...filters, staffId: e.target.value })}>
            <option value="">All Staff</option>
            {staffList.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All Statuses</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
            <option value="Leave">Leave</option>
            <option value="Half Day">Half Day</option>
            <option value="Pending Checkout">Pending Checkout</option>
          </select>
        </div>
      </div>

      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table className="table" style={{ whiteSpace: 'nowrap' }}>
          <thead>
            <tr>
              <th>Staff Name</th>
              <th>Date</th>
              <th>Check In Time</th>
              <th>Check In Selfie</th>
              <th>Check In Location</th>
              <th>Distance (m)</th>
              <th>Lunch Out</th>
              <th>Lunch In</th>
              <th>Lunch Mins</th>
              <th>Check Out Time</th>
              <th>Check Out Selfie</th>
              <th>Check Out Location</th>
              <th>Distance (m)</th>
              <th>Total Hours</th>
              <th>Status</th>
              <th>Remarks</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {attendance.map(record => (
              <tr key={record.id}>
                <td style={{ fontWeight: '500' }}>{record.staff?.name || 'Unknown'}</td>
                <td>{formatDate(record.date)}</td>
                <td>{formatTime(record.check_in_time)}</td>
                <td>
                  {record.check_in_photo_url ? (
                    <img 
                      src={record.check_in_photo_url} 
                      alt="Check In" 
                      style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #ddd' }}
                      onClick={() => openImage(record.check_in_photo_url)}
                    />
                  ) : '-'}
                </td>
                <td>{record.check_in_latitude ? `${record.check_in_latitude.toFixed(5)}, ${record.check_in_longitude.toFixed(5)}` : '-'}</td>
                <td>{record.check_in_distance_meters !== null ? Math.round(record.check_in_distance_meters) : '-'}</td>
                
                <td>{formatTime(record.lunch_out_time)}</td>
                <td>{formatTime(record.lunch_in_time)}</td>
                <td>{record.lunch_duration_minutes || '-'}</td>

                <td>
                  {record.check_out_time
                    ? formatTime(record.check_out_time)
                    : record.status === 'Pending Checkout'
                    ? <span className="text-warning">Pending</span>
                    : '-'}
                </td>
                <td>
                  {record.check_out_photo_url ? (
                    <img 
                      src={record.check_out_photo_url} 
                      alt="Check Out" 
                      style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #ddd' }}
                      onClick={() => openImage(record.check_out_photo_url)}
                    />
                  ) : '-'}
                </td>
                <td>{record.check_out_latitude ? `${record.check_out_latitude.toFixed(5)}, ${record.check_out_longitude.toFixed(5)}` : '-'}</td>
                <td>{record.check_out_distance_meters !== null ? Math.round(record.check_out_distance_meters) : '-'}</td>
                
                <td>{record.total_hours || '-'}</td>
                <td>
                  <span className={`badge badge-${record.status?.toLowerCase().replace(' ', '-') || 'pending'}`}>
                    {record.status}
                  </span>
                </td>
                <td className="text-secondary" style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {record.remarks || '-'}
                </td>
                <td>
                  <button className="btn btn-sm btn-outline" onClick={() => openEdit(record)}>Edit</button>
                </td>
              </tr>
            ))}
            {attendance.length === 0 && (
              <tr>
                <td colSpan="17" className="text-center text-muted" style={{ padding: '2rem' }}>
                  No attendance records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showEditModal && editRecord && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Attendance</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="modal-body">
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
                  <strong>{editRecord.staff?.name}</strong> — {formatDate(editRecord.date)}
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={editForm.status}
                    onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    <option value="Present">Present</option>
                    <option value="Late">Late</option>
                    <option value="Absent">Absent</option>
                    <option value="Leave">Leave</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Pending Checkout">Pending Checkout</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Remarks / Reason</label>
                  <textarea
                    className="form-textarea"
                    value={editForm.remarks}
                    onChange={e => setEditForm({ ...editForm, remarks: e.target.value })}
                    placeholder="Reason for manual correction"
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImageModal && (
        <div className="modal-overlay" onClick={() => setShowImageModal(false)} style={{ zIndex: 9999 }}>
          <div style={{ position: 'relative', background: '#fff', padding: '10px', borderRadius: '8px', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setShowImageModal(false)}
              style={{ position: 'absolute', top: '-15px', right: '-15px', background: '#000', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '16px' }}
            >
              ×
            </button>
            <img src={modalImageSrc} alt="Full Size Selfie" style={{ maxWidth: '100%', maxHeight: 'calc(90vh - 20px)', objectFit: 'contain' }} />
          </div>
        </div>
      )}
    </div>
  );
}
