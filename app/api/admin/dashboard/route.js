import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/utils/auth';
import { getISTDateString } from '@/lib/utils/timezone';

export async function GET(request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || admin.company_id;
    const todayIST = getISTDateString();

    const supabase = createAdminClient();

    // Get company(ies) for the admin
    let companies = [];
    if (admin.role === 'super_admin') {
      const { data } = await supabase.from('companies').select('*').eq('status', 'active').order('company_name');
      companies = data || [];
    } else {
      const { data } = await supabase.from('companies').select('*').eq('id', admin.company_id);
      companies = data || [];
    }

    // Calculate stats for the selected company or all companies
    const targetCompanyIds = companyId
      ? [companyId]
      : companies.map(c => c.id);

    let totalStaff = 0;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let leaveCount = 0;
    let pendingCount = 0;
    let todayAttendance = [];

    for (const cId of targetCompanyIds) {
      // Get active staff count
      const { count: staffCount } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', cId)
        .eq('status', 'active');

      totalStaff += staffCount || 0;

      // Get today's attendance
      const { data: todayData } = await supabase
        .from('attendance')
        .select('*, staff(name, employee_code)')
        .eq('company_id', cId)
        .eq('date', todayIST);

      const records = todayData || [];
      todayAttendance = todayAttendance.concat(records);

      // Count statuses
      records.forEach(r => {
        switch (r.status) {
          case 'Present': presentCount++; break;
          case 'Late': lateCount++; break;
          case 'Leave': leaveCount++; break;
          case 'Pending Checkout': pendingCount++; break;
          case 'Half Day': presentCount++; break;
        }
      });
    }

    // Staff without any attendance record today = absent (minus those on leave)
    const staffWithAttendance = todayAttendance.length;
    absentCount = totalStaff - staffWithAttendance;
    if (absentCount < 0) absentCount = 0;

    return NextResponse.json({
      companies,
      stats: {
        totalStaff,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        leave: leaveCount,
        pendingCheckout: pendingCount,
      },
      todayAttendance,
      admin: {
        name: admin.name,
        role: admin.role,
        companyId: admin.company_id,
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
