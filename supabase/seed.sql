-- ============================================================
-- Seed Data for Multi-Company QR Attendance System
-- Run this AFTER schema.sql
-- ============================================================

-- NOTE: Before running this, create a Super Admin user in Supabase Auth
-- (Authentication > Users > Add User) with your desired email/password.
-- Then replace the UUID below with the auth user's ID.

-- Example: Insert super admin record
-- Replace 'YOUR-AUTH-USER-UUID' with the actual Supabase Auth user ID
-- Replace 'admin@example.com' with your actual email

-- INSERT INTO admin_users (id, email, name, role, company_id, status)
-- VALUES (
--   'YOUR-AUTH-USER-UUID',
--   'admin@example.com',
--   'Super Admin',
--   'super_admin',
--   NULL,
--   'active'
-- );

-- Example: Insert a sample company
-- INSERT INTO companies (company_name, company_slug, status)
-- VALUES ('Acme Corporation', 'acme-corp', 'active');

-- Example: Insert default settings for the company
-- INSERT INTO settings (company_id, office_start_time, office_end_time, late_after_time)
-- SELECT id, '10:00', '19:00', '10:15' FROM companies WHERE company_slug = 'acme-corp';
