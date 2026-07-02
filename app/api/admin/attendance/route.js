import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/utils/auth';
import { getISTDateString } from '@/lib/utils/timezone';

export async function GET(request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const month = searchParams.get('month'); // YYYY-MM
    const staffId = searchParams.get('staffId');
    const status = searchParams.get('status');
    const companyId = searchParams.get('companyId') || admin.company_id;

    const supabase = createAdminClient();

    let query = supabase
      .from('attendance')
      .select('*, staff(name, employee_code)')
      .order('date', { ascending: false })
      .order('check_in_time', { ascending: false });

    // Company scoping
    if (admin.role === 'company_admin') {
      query = query.eq('company_id', admin.company_id);
    } else if (companyId) {
      query = query.eq('company_id', companyId);
    }

    // Filters
    if (date) {
      query = query.eq('date', date);
    } else if (month) {
      const startDate = `${month}-01`;
      const [year, mon] = month.split('-').map(Number);
      const lastDay = new Date(year, mon, 0).getDate();
      const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
      query = query.gte('date', startDate).lte('date', endDate);
    }

    if (staffId) query = query.eq('staff_id', staffId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ attendance: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, status, remarks } = await request.json();
    if (!id) return NextResponse.json({ error: 'Attendance ID required' }, { status: 400 });

    const supabase = createAdminClient();

    // Verify company access
    const { data: record } = await supabase
      .from('attendance')
      .select('company_id')
      .eq('id', id)
      .single();

    if (admin.role === 'company_admin' && record?.company_id !== admin.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const updates = {};
    if (status) updates.status = status;
    if (remarks !== undefined) updates.remarks = remarks;

    const { data, error } = await supabase
      .from('attendance')
      .update(updates)
      .eq('id', id)
      .select('*, staff(name, employee_code)')
      .single();

    if (error) throw error;
    return NextResponse.json({ attendance: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
