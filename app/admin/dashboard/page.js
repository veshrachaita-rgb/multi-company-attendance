'use client';

import { useState, useEffect } from 'react';

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState('');

  useEffect(() => {
    loadDashboard();
  }, [selectedCompany]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const url = selectedCompany
        ? `/api/admin/dashboard?companyId=${selectedCompany}`
        : '/api/admin/dashboard';
      const res = await fetch(url);
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error('Dashboard error:', err);
    }
    setLoading(false);
  }

  if (loading && !data) {
    return <div className="loading" style={{ padding: '2rem', textAlign: 'center' }}>Loading dashboard...</div>;
  }

  const stats = data?.stats || {};
  const isSuperAdmin = data?.admin?.role === 'super_admin';

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        {isSuperAdmin && data?.companies?.length > 0 && (
          <div className="company-selector">
            <label>Company:</label>
            <select
              className="form-select"
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              style={{ minWidth: '200px' }}
            >
              <option value="">All Companies</option>
              {data.companies.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-icon-total">👥</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalStaff || 0}</div>
            <div className="stat-label">Total Staff</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-present">✅</div>
          <div className="stat-info">
            <div className="stat-value">{stats.present || 0}</div>
            <div className="stat-label">Present</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-absent">❌</div>
          <div className="stat-info">
            <div className="stat-value">{stats.absent || 0}</div>
            <div className="stat-label">Absent</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-late">⏰</div>
          <div className="stat-info">
            <div className="stat-value">{stats.late || 0}</div>
            <div className="stat-label">Late</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-leave">🏖️</div>
          <div className="stat-info">
            <div className="stat-value">{stats.leave || 0}</div>
            <div className="stat-label">On Leave</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-pending">⏳</div>
          <div className="stat-info">
            <div className="stat-value">{stats.pendingCheckout || 0}</div>
            <div className="stat-label">Pending Checkout</div>
          </div>
        </div>
      </div>

      {/* Today's Attendance Table */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h3>Today&apos;s Attendance</h3>
        </div>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Total Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(!data?.todayAttendance || data.todayAttendance.length === 0) ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: '2rem' }}>
                    No attendance records for today
                  </td>
                </tr>
              ) : (
                data.todayAttendance.map((record) => (
                  <tr key={record.id}>
                    <td style={{ fontWeight: '500' }}>{record.staff?.name || 'Unknown'}</td>
                    <td>
                      {record.check_in_time
                        ? new Date(record.check_in_time).toLocaleTimeString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : '-'}
                    </td>
                    <td>
                      {record.check_out_time
                        ? new Date(record.check_out_time).toLocaleTimeString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : record.status === 'Pending Checkout'
                        ? 'Pending'
                        : '-'}
                    </td>
                    <td>{record.total_hours || '-'}</td>
                    <td>
                      <span className={`badge badge-${record.status?.toLowerCase().replace(' ', '-') || 'pending'}`}>
                        {record.status}
                      </span>
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
