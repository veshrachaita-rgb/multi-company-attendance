-- ============================================================
-- MIGRATION: One Phone Registration, Lunch, GPS, & Selfies
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create staff_devices table
CREATE TABLE staff_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  device_id_hash TEXT NOT NULL,
  device_label TEXT,
  browser_info TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'reset')),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_id_hash)
);

CREATE INDEX idx_staff_devices_company ON staff_devices(company_id);
CREATE INDEX idx_staff_devices_staff ON staff_devices(staff_id);
CREATE INDEX idx_staff_devices_hash ON staff_devices(device_id_hash);

-- Enable RLS
ALTER TABLE staff_devices ENABLE ROW LEVEL SECURITY;

-- 2. Update attendance table
ALTER TABLE attendance 
  ADD COLUMN IF NOT EXISTS lunch_out_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lunch_in_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lunch_duration_minutes INT,
  ADD COLUMN IF NOT EXISTS check_in_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS check_out_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS check_in_latitude FLOAT,
  ADD COLUMN IF NOT EXISTS check_in_longitude FLOAT,
  ADD COLUMN IF NOT EXISTS check_in_location_accuracy FLOAT,
  ADD COLUMN IF NOT EXISTS check_in_distance_meters FLOAT,
  ADD COLUMN IF NOT EXISTS check_out_latitude FLOAT,
  ADD COLUMN IF NOT EXISTS check_out_longitude FLOAT,
  ADD COLUMN IF NOT EXISTS check_out_location_accuracy FLOAT,
  ADD COLUMN IF NOT EXISTS check_out_distance_meters FLOAT,
  ADD COLUMN IF NOT EXISTS device_id_hash TEXT,
  ADD COLUMN IF NOT EXISTS browser_info TEXT,
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- 3. Update settings table
ALTER TABLE settings 
  ADD COLUMN IF NOT EXISTS office_latitude FLOAT,
  ADD COLUMN IF NOT EXISTS office_longitude FLOAT;

-- 4. Create attendance-selfies storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attendance-selfies', 'attendance-selfies', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for attendance-selfies
-- Anyone can upload (since check in is public)
CREATE POLICY "Public Upload Selfies" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'attendance-selfies');

-- Anyone can view
CREATE POLICY "Public View Selfies" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'attendance-selfies');

-- 5. Add role to staff and accountant timings to settings
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Normal Staff';

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS accountant_start_time TIME DEFAULT '10:00',
  ADD COLUMN IF NOT EXISTS accountant_end_time TIME DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS accountant_late_after_time TIME DEFAULT '10:15';

-- 6. Per-person timings. NULL means the staff member inherits the timings for
-- their role from the settings table.
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS late_after_time TIME;
