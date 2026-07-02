import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getISTDateString, formatISTTime, calculateTotalHours, isLate } from '@/lib/utils/timezone';

export async function POST(request) {
  try {
    const { companyId, staffId, action } = await request.json();

    if (!companyId || !staffId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['checkin', 'checkout'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use "checkin" or "checkout".' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const now = new Date();
    const todayIST = getISTDateString();

    // Verify staff belongs to this company and is active
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, name, company_id')
      .eq('id', staffId)
      .eq('company_id', companyId)
      .eq('status', 'active')
      .single();

    if (staffError || !staff) {
      return NextResponse.json(
        { error: 'Staff member not found or inactive.' },
        { status: 404 }
      );
    }

    // Get company settings for late threshold
    const { data: settings } = await supabase
      .from('settings')
      .select('late_after_time')
      .eq('company_id', companyId)
      .single();

    const lateAfterTime = settings?.late_after_time || '10:15';

    // Get device info from user-agent
    const deviceInfo = request.headers.get('user-agent') || '';

    // Check existing attendance for today
    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('staff_id', staffId)
      .eq('company_id', companyId)
      .eq('date', todayIST)
      .single();

    if (action === 'checkin') {
      if (existing) {
        return NextResponse.json(
          { error: 'You have already checked in today.' },
          { status: 409 }
        );
      }

      // Determine if late
      const late = isLate(now, lateAfterTime);
      const status = late ? 'Late' : 'Pending Checkout';

      const { data: attendance, error: insertError } = await supabase
        .from('attendance')
        .insert({
          company_id: companyId,
          staff_id: staffId,
          date: todayIST,
          check_in_time: now.toISOString(),
          status: status,
          device_info: deviceInfo,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Check-in error:', insertError);
        return NextResponse.json(
          { error: 'Failed to mark check-in. Please try again.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: 'Check In marked successfully',
        staffName: staff.name,
        time: now.toISOString(),
        status: status,
      });
    }

    if (action === 'checkout') {
      if (!existing) {
        return NextResponse.json(
          { error: 'Please check in first.' },
          { status: 400 }
        );
      }

      if (existing.check_out_time) {
        return NextResponse.json(
          { error: 'You have already checked out today.' },
          { status: 409 }
        );
      }

      // Calculate total hours
      const totalHours = calculateTotalHours(existing.check_in_time, now);

      // If was late at check-in, keep Late status; otherwise mark Present
      const status = existing.status === 'Late' ? 'Late' : 'Present';

      const { error: updateError } = await supabase
        .from('attendance')
        .update({
          check_out_time: now.toISOString(),
          total_hours: totalHours,
          status: status,
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Check-out error:', updateError);
        return NextResponse.json(
          { error: 'Failed to mark check-out. Please try again.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: 'Check Out marked successfully',
        staffName: staff.name,
        time: now.toISOString(),
        totalHours: totalHours,
        status: status,
      });
    }
  } catch (err) {
    console.error('Attendance API error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
