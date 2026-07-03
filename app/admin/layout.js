'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import './admin.css';

const NAV_ITEMS = {
  super_admin: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { section: 'Management' },
    { label: 'Companies', href: '/admin/companies', icon: '🏢' },
    { label: 'QR Codes', href: '/admin/qr', icon: '📱' },
    { label: 'Staff', href: '/admin/staff', icon: '👥' },
    { label: 'Devices', href: '/admin/devices', icon: '📱' },
    { section: 'Attendance' },
    { label: 'Attendance', href: '/admin/attendance', icon: '📋' },
    { label: 'Leave', href: '/admin/leave', icon: '🏖️' },
    { label: 'Reports', href: '/admin/reports', icon: '📈' },
    { section: 'Settings' },
    { label: 'Settings', href: '/admin/settings', icon: '⚙️' },
  ],
  company_admin: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { section: 'Management' },
    { label: 'QR Code', href: '/admin/qr', icon: '📱' },
    { label: 'Staff', href: '/admin/staff', icon: '👥' },
    { label: 'Devices', href: '/admin/devices', icon: '📱' },
    { section: 'Attendance' },
    { label: 'Attendance', href: '/admin/attendance', icon: '📋' },
    { label: 'Leave', href: '/admin/leave', icon: '🏖️' },
    { label: 'Reports', href: '/admin/reports', icon: '📈' },
    { section: 'Settings' },
    { label: 'Settings', href: '/admin/settings', icon: '⚙️' },
  ],
};

export default function AdminLayout({ children }) {
  const [admin, setAdmin] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/admin/login') return;
    
    async function loadAdmin() {
      try {
        const res = await fetch('/api/admin/dashboard');
        if (res.ok) {
          const data = await res.json();
          setAdmin(data.admin);
        } else {
          router.push('/admin/login');
        }
      } catch {
        router.push('/admin/login');
      }
      setLoading(false);
    }
    loadAdmin();
  }, [router, pathname]);

  // Skip layout for login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }


  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-bg)',
      }}>
        <div className="spinner" style={{ borderColor: '#e2e8f0', borderTopColor: '#4f46e5' }}></div>
      </div>
    );
  }

  const navItems = NAV_ITEMS[admin?.role] || NAV_ITEMS.company_admin;

  return (
    <div className="admin-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">📋 QR Attendance</div>
          <div className="sidebar-role">
            {admin?.role === 'super_admin' ? 'Super Admin' : 'Company Admin'}
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, i) =>
            item.section ? (
              <div key={i} className="sidebar-section">{item.section}</div>
            ) : (
              <Link
                key={i}
                href={item.href}
                className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {admin?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div>
              <div className="sidebar-user-name">{admin?.name || 'Admin'}</div>
              <div className="sidebar-user-email">{admin?.email || ''}</div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <div className="admin-topbar">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
          <div className="admin-topbar-title">
            {navItems.find(i => i.href === pathname)?.label || 'Admin'}
          </div>
          <div />
        </div>
        <div className="admin-content">
          {children}
        </div>
      </main>
    </div>
  );
}
