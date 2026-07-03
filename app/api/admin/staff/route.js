import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/utils/auth';

export async function GET(request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || admin.company_id;

    const supabase = createAdminClient();
    let query = supabase.from('staff').select('*').order('name');

    if (admin.role === 'company_admin') {
      query = query.eq('company_id', admin.company_id);
    } else if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ staff: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, employeeCode, companyId, role } = await request.json();
    const effectiveCompanyId = admin.role === 'company_admin' ? admin.company_id : companyId;

    if (!name || !effectiveCompanyId) {
      return NextResponse.json(
        { error: 'Name and company are required' },
        { status: 400 }
      );
    }

    // Company admin can only add to own company
    if (admin.role === 'company_admin' && companyId && companyId !== admin.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('staff')
      .insert({
        company_id: effectiveCompanyId,
        name,
        employee_code: employeeCode || null,
        role: role || 'Normal Staff',
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Employee code already exists in this company' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ staff: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, name, employeeCode, status, role } = await request.json();
    if (!id) return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });

    const supabase = createAdminClient();

    // Verify company access
    const { data: staffRecord } = await supabase
      .from('staff')
      .select('company_id')
      .eq('id', id)
      .single();

    if (admin.role === 'company_admin' && staffRecord?.company_id !== admin.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (employeeCode !== undefined) updates.employee_code = employeeCode;
    if (status !== undefined) updates.status = status;
    if (role !== undefined) updates.role = role || 'Normal Staff';

    const { data, error } = await supabase
      .from('staff')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ staff: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
