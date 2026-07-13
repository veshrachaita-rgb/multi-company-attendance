-- ============================================================
-- Multi-Company QR Attendance System — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. COMPANIES
-- ============================================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  company_slug TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_slug ON companies(company_slug);
CREATE INDEX idx_companies_status ON companies(status);

-- ============================================================
-- 2. ADMIN USERS
-- ============================================================
CREATE TABLE admin_users (
  id UUID PRIMARY KEY, -- matches Supabase Auth user id
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'company_admin')),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_users_role ON admin_users(role);
CREATE INDEX idx_admin_users_company ON admin_users(company_id);

-- ============================================================
-- 3. STAFF
-- ============================================================
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  employee_code TEXT,
  role TEXT DEFAULT 'Normal Staff',
  -- NULL means inherit the timings for this staff member's role from settings
  start_time TIME,
  end_time TIME,
  late_after_time TIME,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, employee_code)
);

CREATE INDEX idx_staff_company ON staff(company_id);
CREATE INDEX idx_staff_status ON staff(status);
CREATE INDEX idx_staff_company_status ON staff(company_id, status);

-- ============================================================
-- 4. ATTENDANCE
-- ============================================================
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  total_hours TEXT,
  status TEXT NOT NULL DEFAULT 'Pending Checkout' CHECK (status IN ('Present', 'Late', 'Absent', 'Leave', 'Half Day', 'Pending Checkout')),
  remarks TEXT,
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, staff_id, date)
);

CREATE INDEX idx_attendance_company ON attendance(company_id);
CREATE INDEX idx_attendance_staff ON attendance(staff_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_status ON attendance(status);
CREATE INDEX idx_attendance_company_date ON attendance(company_id, date);

-- ============================================================
-- 5. LEAVES
-- ============================================================
CREATE TABLE leaves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('Paid Leave', 'Unpaid Leave', 'Sick Leave', 'Casual Leave', 'Other')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leaves_company ON leaves(company_id);
CREATE INDEX idx_leaves_staff ON leaves(staff_id);
CREATE INDEX idx_leaves_dates ON leaves(from_date, to_date);

-- ============================================================
-- 6. HOLIDAYS
-- ============================================================
CREATE TABLE holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, date)
);

CREATE INDEX idx_holidays_company ON holidays(company_id);
CREATE INDEX idx_holidays_date ON holidays(date);

-- ============================================================
-- 7. SETTINGS (one row per company)
-- ============================================================
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  office_start_time TIME DEFAULT '10:00',
  office_end_time TIME DEFAULT '19:00',
  late_after_time TIME DEFAULT '10:15',
  accountant_start_time TIME DEFAULT '10:00',
  accountant_end_time TIME DEFAULT '19:00',
  accountant_late_after_time TIME DEFAULT '10:15',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settings_company ON settings(company_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Helper function: get admin role
CREATE OR REPLACE FUNCTION get_admin_role()
RETURNS TEXT AS $$
  SELECT role FROM admin_users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function: get admin company_id
CREATE OR REPLACE FUNCTION get_admin_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM admin_users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ---- COMPANIES ----
-- Public: read active companies (for scan page slug lookup)
CREATE POLICY "Public can read active companies"
  ON companies FOR SELECT
  USING (status = 'active');

-- Admin: super_admin can do everything
CREATE POLICY "Super admin full access to companies"
  ON companies FOR ALL
  USING (get_admin_role() = 'super_admin')
  WITH CHECK (get_admin_role() = 'super_admin');

-- ---- ADMIN USERS ----
CREATE POLICY "Super admin full access to admin_users"
  ON admin_users FOR ALL
  USING (get_admin_role() = 'super_admin')
  WITH CHECK (get_admin_role() = 'super_admin');

CREATE POLICY "Admin can read own record"
  ON admin_users FOR SELECT
  USING (id = auth.uid());

-- ---- STAFF ----
-- Public: read active staff (for scan page dropdown, filtered by company in API)
CREATE POLICY "Public can read active staff"
  ON staff FOR SELECT
  USING (status = 'active');

-- Super admin: full access
CREATE POLICY "Super admin full access to staff"
  ON staff FOR ALL
  USING (get_admin_role() = 'super_admin')
  WITH CHECK (get_admin_role() = 'super_admin');

-- Company admin: own company only
CREATE POLICY "Company admin manages own staff"
  ON staff FOR ALL
  USING (
    get_admin_role() = 'company_admin' 
    AND company_id = get_admin_company_id()
  )
  WITH CHECK (
    get_admin_role() = 'company_admin' 
    AND company_id = get_admin_company_id()
  );

-- ---- ATTENDANCE ----
-- Public: insert only (for check-in/check-out via API)
CREATE POLICY "Public can insert attendance"
  ON attendance FOR INSERT
  WITH CHECK (true);

-- Public: can read own attendance for validation
CREATE POLICY "Public can read attendance"
  ON attendance FOR SELECT
  USING (true);

-- Public: can update attendance for checkout
CREATE POLICY "Public can update attendance"
  ON attendance FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Super admin: full access
CREATE POLICY "Super admin full access to attendance"
  ON attendance FOR ALL
  USING (get_admin_role() = 'super_admin')
  WITH CHECK (get_admin_role() = 'super_admin');

-- Company admin: own company only
CREATE POLICY "Company admin manages own attendance"
  ON attendance FOR ALL
  USING (
    get_admin_role() = 'company_admin' 
    AND company_id = get_admin_company_id()
  )
  WITH CHECK (
    get_admin_role() = 'company_admin' 
    AND company_id = get_admin_company_id()
  );

-- ---- LEAVES ----
CREATE POLICY "Super admin full access to leaves"
  ON leaves FOR ALL
  USING (get_admin_role() = 'super_admin')
  WITH CHECK (get_admin_role() = 'super_admin');

CREATE POLICY "Company admin manages own leaves"
  ON leaves FOR ALL
  USING (
    get_admin_role() = 'company_admin' 
    AND company_id = get_admin_company_id()
  )
  WITH CHECK (
    get_admin_role() = 'company_admin' 
    AND company_id = get_admin_company_id()
  );

-- ---- HOLIDAYS ----
CREATE POLICY "Public can read holidays"
  ON holidays FOR SELECT
  USING (true);

CREATE POLICY "Super admin full access to holidays"
  ON holidays FOR ALL
  USING (get_admin_role() = 'super_admin')
  WITH CHECK (get_admin_role() = 'super_admin');

CREATE POLICY "Company admin manages own holidays"
  ON holidays FOR ALL
  USING (
    get_admin_role() = 'company_admin' 
    AND company_id = get_admin_company_id()
  )
  WITH CHECK (
    get_admin_role() = 'company_admin' 
    AND company_id = get_admin_company_id()
  );

-- ---- SETTINGS ----
-- Public: read settings (for scan page to determine late threshold)
CREATE POLICY "Public can read settings"
  ON settings FOR SELECT
  USING (true);

CREATE POLICY "Super admin full access to settings"
  ON settings FOR ALL
  USING (get_admin_role() = 'super_admin')
  WITH CHECK (get_admin_role() = 'super_admin');

CREATE POLICY "Company admin manages own settings"
  ON settings FOR ALL
  USING (
    get_admin_role() = 'company_admin' 
    AND company_id = get_admin_company_id()
  )
  WITH CHECK (
    get_admin_role() = 'company_admin' 
    AND company_id = get_admin_company_id()
  );

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leaves_updated_at
  BEFORE UPDATE ON leaves
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
