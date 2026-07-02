import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/utils/auth';

export async function GET() {
  try {
    await requireSuperAdmin();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('admin_users')
      .select('*, companies(company_name, company_slug)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ admins: data || [] });
  } catch (err) {
    console.error('Company admins GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await requireSuperAdmin();
    const { email, password, name, companyId, role } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    const adminRole = role || 'company_admin';
    if (adminRole === 'company_admin' && !companyId) {
      return NextResponse.json(
        { error: 'Company ID is required for company admins' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('Auth create error:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    // Create admin_users record
    const { data: adminUser, error: insertError } = await supabase
      .from('admin_users')
      .insert({
        id: authData.user.id,
        email,
        name,
        role: adminRole,
        company_id: adminRole === 'super_admin' ? null : companyId,
        status: 'active',
      })
      .select('*, companies(company_name)')
      .single();

    if (insertError) {
      // Rollback: delete the auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw insertError;
    }

    return NextResponse.json({ admin: adminUser }, { status: 201 });
  } catch (err) {
    console.error('Company admins POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    await requireSuperAdmin();
    const { id, name, status, companyId } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const updates = {};
    if (name) updates.name = name;
    if (status) updates.status = status;
    if (companyId !== undefined) updates.company_id = companyId;

    const { data, error } = await supabase
      .from('admin_users')
      .update(updates)
      .eq('id', id)
      .select('*, companies(company_name)')
      .single();

    if (error) throw error;
    return NextResponse.json({ admin: data });
  } catch (err) {
    console.error('Company admins PUT error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
