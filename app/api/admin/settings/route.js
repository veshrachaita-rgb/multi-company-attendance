import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/utils/auth';

export async function GET(request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || admin.company_id;
    const effectiveCompanyId = admin.role === 'company_admin' ? admin.company_id : companyId;

    if (!effectiveCompanyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('company_id', effectiveCompanyId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return NextResponse.json({
      settings: data || {
        office_start_time: '10:00',
        office_end_time: '19:00',
        late_after_time: '10:15',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { officeStartTime, officeEndTime, lateAfterTime, companyId } = await request.json();
    const effectiveCompanyId = admin.role === 'company_admin' ? admin.company_id : companyId;

    if (!effectiveCompanyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    if (admin.role === 'company_admin' && companyId && companyId !== admin.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('settings')
      .upsert({
        company_id: effectiveCompanyId,
        office_start_time: officeStartTime,
        office_end_time: officeEndTime,
        late_after_time: lateAfterTime,
      }, { onConflict: 'company_id' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ settings: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
