import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdminUser, requireSuperAdmin } from '@/lib/utils/auth';

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    let query = supabase.from('companies').select('*').order('company_name');

    if (admin.role === 'company_admin') {
      query = query.eq('id', admin.company_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ companies: data || [] });
  } catch (err) {
    console.error('Companies GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await requireSuperAdmin();
    const { companyName, companySlug } = await request.json();

    if (!companyName || !companySlug) {
      return NextResponse.json(
        { error: 'Company name and slug are required' },
        { status: 400 }
      );
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(companySlug)) {
      return NextResponse.json(
        { error: 'Slug must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Create company
    const { data: company, error } = await supabase
      .from('companies')
      .insert({
        company_name: companyName,
        company_slug: companySlug,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A company with this slug already exists' },
          { status: 409 }
        );
      }
      throw error;
    }

    // Create default settings for the company
    await supabase.from('settings').insert({
      company_id: company.id,
      office_start_time: '10:00',
      office_end_time: '19:00',
      late_after_time: '10:15',
    });

    return NextResponse.json({ company }, { status: 201 });
  } catch (err) {
    console.error('Companies POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    await requireSuperAdmin();
    const { id, companyName, companySlug, status } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const updates = {};
    if (companyName) updates.company_name = companyName;
    if (companySlug) updates.company_slug = companySlug;
    if (status) updates.status = status;

    const { data, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ company: data });
  } catch (err) {
    console.error('Companies PUT error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
