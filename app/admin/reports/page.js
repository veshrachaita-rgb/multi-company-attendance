'use client';

import { useState, useEffect } from 'react';

export default function AdminReportsPage() {
  const [report, setReport] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({
    companyId: '',
    month: new Date().toISOString().slice(0, 7),
    staffId: '',
  });

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (filters.companyId && filters.month) {
      loadReport();
      loadStaff();
    }
  }, [filters.companyId, filters.month, filters.staffId]);

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

  async function loadReport() {
    try {
      const params = new URLSearchParams({
        month: filters.month,
        companyId: filters.companyId,
      });
      if (filters.staffId) params.set('staffId', filters.staffId);

      const res = await fetch(`/api/admin/reports?${params}`);
      const data = await res.json();
      setReport(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadStaff() {
    try {
      const res = await fetch(`/api/admin/staff?companyId=${filters.companyId}`);
      const data = await res.json();
      setStaffList((data.staff || []).filter(s => s.status === 'active'));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        month: filters.month,
        companyId: filters.companyId,
        export: 'excel',
      });
      if (filters.staffId) params.set('staffId', filters.staffId);

      const res = await fetch(`/api/admin/reports?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const contentDisposition = res.headers.get('Content-Disposition');
        const filename = contentDisposition
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
          : `Attendance_${filters.month}.xlsx`;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export error:', err);
    }
    setExporting(false);
  }

  if (loading) {
    return <div className="loading" style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  const isSuperAdmin = admin?.role === 'super_admin';
  const monthLabel = filters.month
    ? new Date(filters.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Monthly Reports</h1>
          {report?.companyName && (
            <p className="text-secondary" style={{ marginTop: '0.25rem', fontSize: '0.875rem' }}>
              {report.companyName} — {monthLabel}
            </p>
          )}
        </div>
        <div className="page-actions">
          <button
            className="btn btn-success"
            onClick={handleExport}
            disabled={exporting || !report?.report?.length}
          >
            {exporting ? '⏳ Exporting...' : '📥 Export Excel'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        {isSuperAdmin && companies.length > 1 && (
          <div className="form-group">
            <label className="form-label">Company</label>
            <select
              className="form-select"
              value={filters.companyId}
              onChange={e => setFilters({ ...filters, companyId: e.target.value })}
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Month</label>
          <input
            type="month"
            className="form-input"
            value={filters.month}
            onChange={e => setFilters({ ...filters, month: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Staff</label>
          <select
            className="form-select"
            value={filters.staffId}
            onChange={e => setFilters({ ...filters, staffId: e.target.value })}
          >
            <option value="">All Staff</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Report Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Employee Code</th>
              <th>Staff Name</th>
              <th>Present</th>
              <th>Late</th>
              <th>Absent</th>
              <th>Leave</th>
              <th>Total Hours</th>
            </tr>
          </thead>
          <tbody>
            {report?.report?.map((r, i) => (
              <tr key={i}>
                <td><code style={{ fontSize: '0.8125rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{r.employeeCode}</code></td>
                <td style={{ fontWeight: '500' }}>{r.staffName}</td>
                <td>
                  <span className="badge badge-present">{r.daysPresent}</span>
                </td>
                <td>
                  <span className={`badge ${r.daysLate > 0 ? 'badge-late' : 'badge-pending'}`}>{r.daysLate}</span>
                </td>
                <td>
                  <span className={`badge ${r.daysAbsent > 0 ? 'badge-absent' : 'badge-pending'}`}>{r.daysAbsent}</span>
                </td>
                <td>
                  <span className={`badge ${r.daysLeave > 0 ? 'badge-leave' : 'badge-pending'}`}>{r.daysLeave}</span>
                </td>
                <td style={{ fontWeight: '500' }}>{r.totalHours}</td>
              </tr>
            )) || null}
            {(!report?.report || report.report.length === 0) && (
              <tr>
                <td colSpan="7" className="text-center text-muted" style={{ padding: '2rem' }}>
                  No report data available. Select a month and company.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
