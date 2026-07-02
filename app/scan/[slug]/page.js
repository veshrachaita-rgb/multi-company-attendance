'use client';

import { useState, useEffect, useRef, use } from 'react';
import '../scan.css';

function generateDeviceId() {
  return 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default function ScanPage(props) {
  const params = use(props.params);
  const { slug } = params;
  
  const [company, setCompany] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  
  const [deviceId, setDeviceId] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [registeredStaff, setRegisteredStaff] = useState(null);
  
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [notFound, setNotFound] = useState(false);
  
  // Camera & GPS state
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  
  useEffect(() => {
    // Get or create device ID
    let storedId = localStorage.getItem('attendance_device_id');
    if (!storedId) {
      storedId = generateDeviceId();
      localStorage.setItem('attendance_device_id', storedId);
    }
    setDeviceId(storedId);
    
    async function loadData() {
      try {
        const res = await fetch(`/api/company-by-slug?slug=${slug}`);
        if (!res.ok) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const companyData = await res.json();
        setCompany(companyData.company);

        // Check if device is registered
        const devRes = await fetch('/api/device/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: storedId })
        });
        const devData = await devRes.json();
        
        if (devData.registered && devData.staff) {
          setIsRegistered(true);
          setRegisteredStaff(devData.staff);
        } else {
          // If not registered, load all staff so they can register
          const staffRes = await fetch(`/api/staff?companyId=${companyData.company.id}`);
          const staffData = await staffRes.json();
          setStaffList(staffData.staff || []);
        }
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    }
    loadData();
  }, [slug]);

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const istOptions = { timeZone: 'Asia/Kolkata' };
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          ...istOptions, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString('en-IN', {
          ...istOptions, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
      );
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup camera stream
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  async function registerDevice() {
    if (!selectedStaff) {
      setMessage({ type: 'error', text: 'Please select your name first.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const browserInfo = navigator.userAgent;
      let label = 'Browser';
      if (/android/i.test(browserInfo)) label = 'Android Phone';
      if (/iphone|ipad|ipod/i.test(browserInfo)) label = 'iPhone';

      const res = await fetch('/api/device/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          staffId: selectedStaff,
          deviceId,
          deviceLabel: label,
          browserInfo
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Phone registered successfully!' });
        // Reload page to enter registered flow
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' });
    }
    setSubmitting(false);
  }

  async function startAttendanceAction(action) {
    setMessage(null);
    if (action === 'lunchout' || action === 'lunchin') {
      // Lunch doesn't need GPS or camera, execute directly
      executeAttendanceAction(action, null, null, null, null);
      return;
    }

    // CheckIn/CheckOut need Camera & GPS
    setPendingAction(action);
    setSubmitting(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported (requires HTTPS or secure browser).');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setSubmitting(false);
    } catch (err) {
      setMessage({ type: 'error', text: `Camera Error: ${err.message}` });
      setSubmitting(false);
      setPendingAction(null);
    }
  }

  function captureAndSubmit() {
    if (!videoRef.current || !canvasRef.current || !pendingAction) return;
    setSubmitting(true);

    // Capture photo
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoBase64 = canvas.toDataURL('image/jpeg', 0.7);

    // Stop camera
    stopCamera();

    // Get GPS
    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'Geolocation is not supported by this browser.' });
      setSubmitting(false);
      setPendingAction(null);
      return;
    }

    setMessage({ type: 'success', text: 'Getting GPS location...' });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        executeAttendanceAction(pendingAction, photoBase64, latitude, longitude, accuracy);
      },
      (error) => {
        setMessage({ type: 'error', text: `GPS Error: ${error.message}` });
        setSubmitting(false);
        setPendingAction(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function executeAttendanceAction(action, photoBase64, lat, lng, accuracy) {
    setSubmitting(true);
    setMessage({ type: 'success', text: 'Verifying and saving...' });
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          action,
          photoBase64,
          lat,
          lng,
          accuracy
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: 'success',
          text: data.message,
          detail: data.status ? `Status: ${data.status}` : undefined
        });
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
    setSubmitting(false);
    setPendingAction(null);
  }

  if (loading) {
    return (
      <div className="scan-page">
        <div className="scan-container">
          <div className="scan-loading"><div className="spinner"></div><p>Loading...</p></div>
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
          <div className="scan-header">
            <h1 className="scan-company-name">{company?.company_name}</h1>
            <p className="scan-subtitle">Staff Attendance</p>
          </div>

          <div className="scan-datetime">
            <div className="scan-date">{currentDate}</div>
            <div className="scan-time">{currentTime}</div>
          </div>

          {!isRegistered ? (
            <div className="scan-form">
              <div style={{ marginBottom: '1rem', color: '#dc2626', fontSize: '0.9rem', fontWeight: 500, textAlign: 'center' }}>
                This phone is not registered. Register to mark attendance.
              </div>
              <select
                className="scan-select"
                value={selectedStaff}
                onChange={(e) => { setSelectedStaff(e.target.value); setMessage(null); }}
                disabled={submitting}
              >
                <option value="">— Select Your Name —</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.employee_code ? `(${s.employee_code})` : ''}
                  </option>
                ))}
              </select>
              <button 
                className="scan-btn" 
                style={{ background: '#4f46e5', color: '#fff', marginTop: '1rem' }}
                onClick={registerDevice}
                disabled={submitting || !selectedStaff}
              >
                {submitting ? 'Registering...' : 'Register This Phone'}
              </button>
            </div>
          ) : (
            <div className="scan-form">
              <div style={{ marginBottom: '1rem', color: '#16a34a', fontSize: '1rem', fontWeight: 'bold', textAlign: 'center' }}>
                Registered to: {registeredStaff?.name}
              </div>

              {cameraActive ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    style={{ width: '100%', maxWidth: '300px', borderRadius: '8px', border: '2px solid #e5e7eb', marginBottom: '1rem', transform: 'scaleX(-1)' }} 
                  />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                    <button className="scan-btn" style={{ flex: 1, background: '#16a34a', color: '#fff' }} onClick={captureAndSubmit} disabled={submitting}>
                      📸 Capture & Submit
                    </button>
                    <button className="scan-btn btn-outline" style={{ flex: 1 }} onClick={stopCamera} disabled={submitting}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="scan-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="scan-btn scan-btn-checkin" onClick={() => startAttendanceAction('checkin')} disabled={submitting}>
                      📥 Check In
                    </button>
                    <button className="scan-btn scan-btn-checkout" onClick={() => startAttendanceAction('checkout')} disabled={submitting}>
                      📤 Check Out
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="scan-btn" style={{ flex: 1, background: '#f59e0b', color: '#fff' }} onClick={() => startAttendanceAction('lunchout')} disabled={submitting}>
                      🍔 Lunch Out
                    </button>
                    <button className="scan-btn" style={{ flex: 1, background: '#10b981', color: '#fff' }} onClick={() => startAttendanceAction('lunchin')} disabled={submitting}>
                      💼 Lunch In
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {message && (
            <div className={`scan-message ${message.type === 'success' ? 'scan-message-success' : 'scan-message-error'}`} style={{ marginTop: '1rem' }}>
              <div className="scan-message-icon">{message.type === 'success' ? '✅' : '⚠️'}</div>
              <div className="scan-message-text">{message.text}</div>
              {message.detail && <div className="scan-message-detail">{message.detail}</div>}
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
