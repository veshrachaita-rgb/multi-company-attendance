import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: devices, error } = await supabase
      .from('staff_devices')
      .select('*, staff(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 });
    }

    return NextResponse.json({ devices });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { deviceId, status } = await request.json();

    if (!deviceId || !status) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (!['active', 'blocked', 'reset'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { error } = await supabase
      .from('staff_devices')
      .update({ status })
      .eq('id', deviceId);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: 'Failed to update device status' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Device status updated successfully' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
