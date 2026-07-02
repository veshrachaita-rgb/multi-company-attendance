import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getISTDateString, formatISTTime, calculateTotalHours, isLate } from '@/lib/utils/timezone';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const ALLOWED_RADIUS_METERS = 50;

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, action, photoBase64, lat, lng, accuracy } = body;

    if (!deviceId || !action) {
      return NextResponse.json({ error: 'Missing deviceId or action' }, { status: 400 });
    }

    if (!['checkin', 'checkout', 'lunchout', 'lunchin'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const now = new Date();
    const todayIST = getISTDateString();
    
    // Hash device ID to lookup staff
    const deviceIdHash = crypto.createHash('sha256').update(deviceId).digest('hex');

    // Identify staff from device
    const { data: device, error: deviceError } = await supabase
      .from('staff_devices')
      .select('staff_id, company_id, status, staff (name, status)')
      .eq('device_id_hash', deviceIdHash)
      .eq('status', 'active')
      .single();

    if (deviceError || !device || device.staff.status !== 'active') {
      return NextResponse.json({ error: 'Unregistered or blocked device. Please contact admin.' }, { status: 403 });
    }

    const companyId = device.company_id;
    const staffId = device.staff_id;
    const staffName = device.staff.name;

    // Get company settings for late threshold and office location
    const { data: settings } = await supabase
      .from('settings')
      .select('late_after_time, office_latitude, office_longitude')
      .eq('company_id', companyId)
      .single();

    const lateAfterTime = settings?.late_after_time || '10:15';
    const deviceInfo = request.headers.get('user-agent') || '';
    const ipAddress = request.headers.get('x-forwarded-for') || '';

    // GPS & Photo validation for checkin / checkout
    let distanceMeters = null;
    let photoUrl = null;

    if (action === 'checkin' || action === 'checkout') {
      if (!lat || !lng) {
        return NextResponse.json({ error: 'GPS location is required for this action.' }, { status: 400 });
      }
      if (!photoBase64) {
        return NextResponse.json({ error: 'Selfie photo is required for this action.' }, { status: 400 });
      }
      if (!settings?.office_latitude || !settings?.office_longitude) {
        return NextResponse.json({ error: 'Office location is not configured. Please contact admin.' }, { status: 400 });
      }

      distanceMeters = getDistance(lat, lng, settings.office_latitude, settings.office_longitude);
      
      if (distanceMeters > ALLOWED_RADIUS_METERS) {
        return NextResponse.json({ 
          error: `You are ${Math.round(distanceMeters)} meters away. You must be within ${ALLOWED_RADIUS_METERS} meters of the office.` 
        }, { status: 403 });
      }

      // Upload selfie
      try {
        const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `${companyId}/${staffId}/${todayIST}/${action}-${now.getTime()}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from('attendance-selfies')
          .upload(fileName, buffer, {
            contentType: 'image/jpeg',
            upsert: true
          });
          
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage
          .from('attendance-selfies')
          .getPublicUrl(fileName);
          
        photoUrl = publicUrlData.publicUrl;
      } catch (err) {
        console.error("Photo upload error:", err);
        return NextResponse.json({ error: 'Failed to upload selfie photo.' }, { status: 500 });
      }
    }

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
        return NextResponse.json({ error: 'You have already checked in today.' }, { status: 409 });
      }

      const isLateCheckin = isLate(now, lateAfterTime);
      const status = isLateCheckin ? 'Late' : 'Pending Checkout';

      const { error: insertError } = await supabase.from('attendance').insert({
        company_id: companyId,
        staff_id: staffId,
        date: todayIST,
        check_in_time: now.toISOString(),
        status: status,
        device_info: deviceInfo,
        device_id_hash: deviceIdHash,
        ip_address: ipAddress,
        check_in_photo_url: photoUrl,
        check_in_latitude: lat,
        check_in_longitude: lng,
        check_in_location_accuracy: accuracy,
        check_in_distance_meters: distanceMeters
      });

      if (insertError) throw insertError;
      return NextResponse.json({ message: 'Check In marked successfully', staffName, time: now.toISOString(), status });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Please check in first.' }, { status: 400 });
    }

    if (action === 'lunchout') {
      if (existing.lunch_out_time) return NextResponse.json({ error: 'Already marked lunch out.' }, { status: 400 });
      
      const { error: updateError } = await supabase.from('attendance').update({
        lunch_out_time: now.toISOString(),
        device_info: deviceInfo,
      }).eq('id', existing.id);
      
      if (updateError) throw updateError;
      return NextResponse.json({ message: 'Lunch Out marked successfully', staffName });
    }

    if (action === 'lunchin') {
      if (!existing.lunch_out_time) return NextResponse.json({ error: 'Must mark lunch out first.' }, { status: 400 });
      if (existing.lunch_in_time) return NextResponse.json({ error: 'Already marked lunch in.' }, { status: 400 });
      
      // Calculate lunch duration
      const lunchOut = new Date(existing.lunch_out_time);
      const durationMins = Math.round((now.getTime() - lunchOut.getTime()) / 60000);

      const { error: updateError } = await supabase.from('attendance').update({
        lunch_in_time: now.toISOString(),
        lunch_duration_minutes: durationMins,
        device_info: deviceInfo,
      }).eq('id', existing.id);
      
      if (updateError) throw updateError;
      return NextResponse.json({ message: 'Lunch In marked successfully', staffName });
    }

    if (action === 'checkout') {
      if (existing.check_out_time) return NextResponse.json({ error: 'Already checked out today.' }, { status: 400 });
      if (existing.lunch_out_time && !existing.lunch_in_time) {
        return NextResponse.json({ error: 'Must mark Lunch In before Check Out.' }, { status: 400 });
      }

      // Calculate total working hours excluding lunch
      let totalMs = now.getTime() - new Date(existing.check_in_time).getTime();
      if (existing.lunch_duration_minutes) {
        totalMs -= (existing.lunch_duration_minutes * 60000);
      }
      
      const hours = Math.floor(totalMs / 3600000);
      const minutes = Math.floor((totalMs % 3600000) / 60000);
      const totalHoursStr = `${hours}h ${minutes}m`;

      const status = existing.status === 'Late' ? 'Late' : 'Present';

      const { error: updateError } = await supabase.from('attendance').update({
        check_out_time: now.toISOString(),
        total_hours: totalHoursStr,
        status: status,
        check_out_photo_url: photoUrl,
        check_out_latitude: lat,
        check_out_longitude: lng,
        check_out_location_accuracy: accuracy,
        check_out_distance_meters: distanceMeters
      }).eq('id', existing.id);

      if (updateError) throw updateError;
      return NextResponse.json({ message: 'Check Out marked successfully', staffName, time: now.toISOString(), totalHours: totalHoursStr, status });
    }

  } catch (err) {
    console.error('Attendance API error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
