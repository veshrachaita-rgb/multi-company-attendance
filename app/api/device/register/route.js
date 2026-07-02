import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { companyId, staffId, deviceId, deviceLabel, browserInfo } = await request.json();

    if (!companyId || !staffId || !deviceId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    
    // Hash the device ID for secure storage
    const deviceIdHash = crypto.createHash('sha256').update(deviceId).digest('hex');

    // Check if staff already has an active device
    const { data: existingDevice } = await supabase
      .from('staff_devices')
      .select('id')
      .eq('staff_id', staffId)
      .eq('status', 'active')
      .single();

    if (existingDevice) {
      return NextResponse.json(
        { error: 'This staff member already has a registered phone.' },
        { status: 400 }
      );
    }

    // Register new device
    const { error: insertError } = await supabase
      .from('staff_devices')
      .insert({
        company_id: companyId,
        staff_id: staffId,
        device_id_hash: deviceIdHash,
        device_label: deviceLabel || 'Unknown Device',
        browser_info: browserInfo || '',
        status: 'active'
      });

    if (insertError) {
      console.error('Device registration error:', insertError);
      return NextResponse.json(
        { error: 'Failed to register device.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Device registered successfully.' });

  } catch (err) {
    console.error('Device register API error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
