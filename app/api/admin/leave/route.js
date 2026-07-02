import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/utils/auth';
import { getDateRange } from '@/lib/utils/timezone';

export async function GET(request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || admin.company_id;

    const supabase = createAdminClient();
    let query = supabase
      .from('leaves')
      .select('*, staff(name, employee_code)')
      .order('from_date', { ascending: false });

    if (admin.role === 'company_admin') {
      query = query.eq('company_id', admin.company_id);
    } else if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ leaves: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { staffId, fromDate, toDate, leaveType, reason, companyId } = await request.json();
    const effectiveCompanyId = admin.role === 'company_admin' ? admin.company_id : companyId;

    if (!staffId || !fromDate || !toDate || !leaveType || !effectiveCompanyId) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Verify company access
    if (admin.role === 'company_admin' && companyId && companyId !== admin.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supabase = createAdminClient();

    // Verify staff belongs to company
    const { data: staff } = await supabase
      .from('staff')
      .select('id, name')
      .eq('id', staffId)
      .eq('company_id', effectiveCompanyId)
      .single();

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found in this company' }, { status: 404 });
    }

    // Create leave record
    const { data: leave, error: leaveError } = await supabase
      .from('leaves')
      .insert({
        company_id: effectiveCompanyId,
        staff_id: staffId,
        from_date: fromDate,
        to_date: toDate,
        leave_type: leaveType,
        reason: reason || '',
        status: 'approved',
      })
      .select()
      .single();

    if (leaveError) throw leaveError;

    // Create or update attendance records for each date in range
    const dates = getDateRange(fromDate, toDate);
    for (const date of dates) {
      // Check if attendance record exists
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('company_id', effectiveCompanyId)
        .eq('staff_id', staffId)
        .eq('date', date)
        .single();

      if (existing) {
        // Update existing record to Leave
        await supabase
          .from('attendance')
          .update({ status: 'Leave', remarks: `${leaveType}: ${reason || ''}` })
          .eq('id', existing.id);
      } else {
        // Insert new record as Leave
        await supabase.from('attendance').insert({
          company_id: effectiveCompanyId,
          staff_id: staffId,
          date: date,
          status: 'Leave',
          remarks: `${leaveType}: ${reason || ''}`,
        });
      }
    }

    return NextResponse.json({ leave }, { status: 201 });
  } catch (err) {
    console.error('Leave POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Leave ID required' }, { status: 400 });

    const supabase = createAdminClient();

    // Get leave record for company check and date range
    const { data: leave } = await supabase
      .from('leaves')
      .select('*')
      .eq('id', id)
      .single();

    if (!leave) return NextResponse.json({ error: 'Leave not found' }, { status: 404 });

    if (admin.role === 'company_admin' && leave.company_id !== admin.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Cancel the leave
    await supabase
      .from('leaves')
      .update({ status: 'cancelled' })
      .eq('id', id);

    // Remove Leave status from attendance records in the date range
    const dates = getDateRange(leave.from_date, leave.to_date);
    for (const date of dates) {
      const { data: att } = await supabase
        .from('attendance')
        .select('id, check_in_time')
        .eq('company_id', leave.company_id)
        .eq('staff_id', leave.staff_id)
        .eq('date', date)
        .eq('status', 'Leave')
        .single();

      if (att && !att.check_in_time) {
        // Delete the leave-only attendance record
        await supabase.from('attendance').delete().eq('id', att.id);
      }
    }

    return NextResponse.json({ message: 'Leave cancelled successfully' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
