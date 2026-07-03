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
      .select('*, companies(company_name)')
      .eq('company_id', effectiveCompanyId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return NextResponse.json({
      settings: data || {
        office_start_time: '10:00',
        office_end_time: '19:00',
        late_after_time: '10:15',
        accountant_start_time: '10:00',
        accountant_end_time: '19:00',
        accountant_late_after_time: '10:15',
      },
      companyName: data?.companies?.company_name || ''
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { companyName, officeStartTime, officeEndTime, lateAfterTime, accountantStartTime, accountantEndTime, accountantLateAfterTime, companyId, officeLatitude, officeLongitude } = await request.json();
    let effectiveCompanyId = admin.role === 'company_admin' ? admin.company_id : companyId;

    if (admin.role === 'company_admin' && companyId && companyId !== admin.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supabase = createAdminClient();

    if (!effectiveCompanyId) {
      if (!companyName) {
        return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
      }
      
      // Auto-create company
      const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { data: newCompany, error: createErr } = await supabase
        .from('companies')
        .insert({
          company_name: companyName,
          company_slug: companySlug || 'default-slug',
          status: 'active'
        })
        .select()
        .single();
        
      if (createErr) throw createErr;
      effectiveCompanyId = newCompany.id;
      
      // If super_admin, we don't strictly need to assign it to them, but if company_admin, they need it.
      // But if they are the ones creating it, we might want to link them if they don't have one.
      if (admin.role === 'company_admin' && !admin.company_id) {
        await supabase.from('admin_users').update({ company_id: effectiveCompanyId }).eq('id', admin.id);
      }
    } else if (companyName) {
      // Update existing company name
      await supabase
        .from('companies')
        .update({ company_name: companyName })
        .eq('id', effectiveCompanyId);
    }

    const { data, error } = await supabase
      .from('settings')
      .upsert({
        company_id: effectiveCompanyId,
        office_start_time: officeStartTime,
        office_end_time: officeEndTime,
        late_after_time: lateAfterTime,
        accountant_start_time: accountantStartTime,
        accountant_end_time: accountantEndTime,
        accountant_late_after_time: accountantLateAfterTime,
        office_latitude: officeLatitude || null,
        office_longitude: officeLongitude || null,
      }, { onConflict: 'company_id' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ settings: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
