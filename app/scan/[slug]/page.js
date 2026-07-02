'use client';

import { useState, useEffect } from 'react';
import '../scan.css';

export default function ScanPage({ params }) {
  const { slug } = params;
  const [company, setCompany] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // Load company and staff
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch company by slug
        const res = await fetch(`/api/company-by-slug?slug=${slug}`);
        if (!res.ok) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const companyData = await res.json();
        setCompany(companyData.company);

        // Fetch staff for this company
        const staffRes = await fetch(`/api/staff?companyId=${companyData.company.id}`);
        const staffData = await staffRes.json();
        setStaffList(staffData.staff || []);
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    }
    loadData();
  }, [slug]);

  // Live clock (IST)
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const istOptions = { timeZone: 'Asia/Kolkata' };
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          ...istOptions,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString('en-IN', {
          ...istOptions,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleAction(action) {
    if (!selectedStaff) {
      setMessage({ type: 'error', text: 'Please select your name first.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          staffId: selectedStaff,
          action,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: 'success',
          text: data.message,
          detail: data.staffName,
        });
        // Reset selection after success
        setSelectedStaff('');
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    }

    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="scan-page">
        <div className="scan-container">
          <div className="scan-loading">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="scan-page">
        <div className="scan-container">
          <div className="scan-not-found">
            <div className="scan-not-found-icon">🔍</div>
            <h2>Company Not Found</h2>
            <p>The QR code you scanned is invalid or the company is inactive.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scan-page">
      <div className="scan-container">
        <div className="scan-card">
          {/* Header */}
          <div className="scan-header">
            <h1 className="scan-company-name">{company?.company_name}</h1>
            <p className="scan-subtitle">Staff Attendance</p>
          </div>

          {/* Date & Time */}
          <div className="scan-datetime">
            <div className="scan-date">{currentDate}</div>
            <div className="scan-time">{currentTime}</div>
          </div>

          {/* Staff Selection */}
          <div className="scan-form">
            <select
              className="scan-select"
              value={selectedStaff}
              onChange={(e) => {
                setSelectedStaff(e.target.value);
                setMessage(null);
              }}
              disabled={submitting}
            >
              <option value="">— Select Your Name —</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.employee_code ? `(${s.employee_code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="scan-buttons">
            <button
              className="scan-btn scan-btn-checkin"
              onClick={() => handleAction('checkin')}
              disabled={submitting || !selectedStaff}
            >
              <span className="scan-btn-icon">📥</span>
              <span className="scan-btn-text">Check In</span>
            </button>
            <button
              className="scan-btn scan-btn-checkout"
              onClick={() => handleAction('checkout')}
              disabled={submitting || !selectedStaff}
            >
              <span className="scan-btn-icon">📤</span>
              <span className="scan-btn-text">Check Out</span>
            </button>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`scan-message ${
                message.type === 'success'
                  ? 'scan-message-success'
                  : 'scan-message-error'
              }`}
            >
              <div className="scan-message-icon">
                {message.type === 'success' ? '✅' : '⚠️'}
              </div>
              <div className="scan-message-text">{message.text}</div>
              {message.detail && (
                <div className="scan-message-detail">{message.detail}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="scan-footer">
        Powered by QR Attendance System
      </div>
    </div>
  );
}
