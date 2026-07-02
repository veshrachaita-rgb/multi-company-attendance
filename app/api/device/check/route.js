import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getISTDateString } from '@/lib/utils/timezone';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { deviceId } = await request.json();

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    
    const deviceIdHash = crypto.createHash('sha256').update(deviceId).digest('hex');

    const { data: device, error } = await supabase
      .from('staff_devices')
      .select('staff_id, status, staff (id, name, company_id)')
      .eq('device_id_hash', deviceIdHash)
      .eq('status', 'active')
      .single();

    if (error || !device) {
      return NextResponse.json({ registered: false });
    }

    // Update last_used_at (in background)
    supabase.from('staff_devices')
      .update({ last_used_at: new Date().toISOString() })
      .eq('device_id_hash', deviceIdHash)
      .then();

    // Get today's attendance state
    const todayIST = getISTDateString();
    
    const { data: attendance } = await supabase
      .from('attendance')
      .select('check_in_time, lunch_out_time, lunch_in_time, check_out_time')
      .eq('staff_id', device.staff_id)
      .eq('date', todayIST)
      .single();

    return NextResponse.json({ 
      registered: true, 
      staff: device.staff,
      attendance: attendance || null
    });

  } catch (err) {
    console.error('Device check API error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
