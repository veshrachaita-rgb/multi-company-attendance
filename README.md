# Multi-Company QR Attendance System

A website-based QR attendance system for multiple companies. Staff scan a printed QR code, select their name, and tap Check In / Check Out. Admins manage staff, attendance, leaves, and reports.

## Tech Stack

- **Next.js 14** (App Router)
- **Supabase** (PostgreSQL + Auth)
- **Vercel** (Deployment)
- **QR Code** generation with `qrcode` npm package
- **Excel Export** with `xlsx` (SheetJS)

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the SQL Editor, run the contents of `supabase/schema.sql`
3. Copy your project URL, anon key, and service role key

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Create Super Admin

1. In Supabase Dashboard → Authentication → Users → Add User
2. Create a user with your email and password
3. Copy the user's UUID
4. In SQL Editor, run:

```sql
INSERT INTO admin_users (id, email, name, role, company_id, status)
VALUES (
  'paste-user-uuid-here',
  'your@email.com',
  'Super Admin',
  'super_admin',
  NULL,
  'active'
);
```

### 4. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel project settings
4. Update `NEXT_PUBLIC_APP_URL` to your production URL
5. Deploy

## Usage Flow

### Super Admin
1. Login at `/admin/login`
2. Create companies at `/admin/companies`
3. Create company admins
4. Each company gets its own QR code and scan URL

### Company Admin
1. Login at `/admin/login`
2. Add staff at `/admin/staff`
3. Print QR code from `/admin/qr`
4. Stick QR at office door
5. View attendance at `/admin/attendance`
6. Manage leaves at `/admin/leave`
7. Export reports at `/admin/reports`

### Staff
1. Scan printed QR code with phone camera
2. Website opens at `/scan/company-slug`
3. Select name from dropdown
4. Tap Check In or Check Out
5. Done!

## Pages

| Page | URL | Access |
|------|-----|--------|
| Staff Scan | `/scan/{company-slug}` | Public |
| Admin Login | `/admin/login` | Public |
| Dashboard | `/admin/dashboard` | Admin |
| Companies | `/admin/companies` | Super Admin |
| QR Code | `/admin/qr` | Admin |
| Staff | `/admin/staff` | Admin |
| Attendance | `/admin/attendance` | Admin |
| Leave | `/admin/leave` | Admin |
| Reports | `/admin/reports` | Admin |
| Settings | `/admin/settings` | Admin |

## Database Tables

1. `companies` - Multi-tenant company records
2. `admin_users` - Super admins and company admins
3. `staff` - Staff members (per company)
4. `attendance` - Daily attendance records
5. `leaves` - Leave records
6. `holidays` - Company holidays
7. `settings` - Office hours per company
