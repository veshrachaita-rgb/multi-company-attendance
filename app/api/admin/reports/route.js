import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/utils/auth';
import * as XLSX from 'xlsx';

export async function GET(request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM
    const companyId = searchParams.get('companyId') || admin.company_id;
    const exportExcel = searchParams.get('export') === 'excel';
    const staffId = searchParams.get('staffId');

    if (!month) {
      return NextResponse.json({ error: 'Month parameter required (YYYY-MM)' }, { status: 400 });
    }

    const effectiveCompanyId = admin.role === 'company_admin' ? admin.company_id : companyId;
    if (!effectiveCompanyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    // Verify company access
    if (admin.role === 'company_admin' && companyId && companyId !== admin.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supabase = createAdminClient();

    // Get the date range for the month
    const [year, mon] = month.split('-').map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    const startDate = `${month}-01`;
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    // Get staff list
    let staffQuery = supabase
      .from('staff')
      .select('id, name, employee_code')
      .eq('company_id', effectiveCompanyId)
      .eq('status', 'active')
      .order('name');

    if (staffId) staffQuery = staffQuery.eq('id', staffId);

    const { data: staffList } = await staffQuery;

    // Get attendance records for the month
    let attQuery = supabase
      .from('attendance')
      .select('*')
      .eq('company_id', effectiveCompanyId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (staffId) attQuery = attQuery.eq('staff_id', staffId);

    const { data: attendanceRecords } = await attQuery;
    const records = attendanceRecords || [];

    // Get company name
    const { data: company } = await supabase
      .from('companies')
      .select('company_name')
      .eq('id', effectiveCompanyId)
      .single();

    // Build report data per staff
    const report = (staffList || []).map(s => {
      const staffRecords = records.filter(r => r.staff_id === s.id);
      const present = staffRecords.filter(r => r.status === 'Present' || r.status === 'Half Day').length;
      const late = staffRecords.filter(r => r.status === 'Late').length;
      const leave = staffRecords.filter(r => r.status === 'Leave').length;
      const absent = lastDay - present - late - leave - staffRecords.filter(r => r.status === 'Pending Checkout').length;

      // Calculate total hours
      let totalMinutes = 0;
      staffRecords.forEach(r => {
        if (r.total_hours) {
          const match = r.total_hours.match(/(\d+)h\s*(\d+)m/);
          if (match) {
            totalMinutes += parseInt(match[1]) * 60 + parseInt(match[2]);
          }
        }
      });
      const totalHours = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;

      return {
        staffName: s.name,
        employeeCode: s.employee_code || '-',
        daysPresent: present,
        daysLate: late,
        daysAbsent: absent < 0 ? 0 : absent,
        daysLeave: leave,
        totalHours,
        records: staffRecords,
      };
    });

    if (exportExcel) {
      // Generate Excel file
      const worksheetData = report.map(r => ({
        'Employee Code': r.employeeCode,
        'Staff Name': r.staffName,
        'Days Present': r.daysPresent,
        'Days Late': r.daysLate,
        'Days Absent': r.daysAbsent,
        'Days Leave': r.daysLeave,
        'Total Hours': r.totalHours,
      }));

      // Create detailed sheet
      const detailData = [];
      report.forEach(r => {
        r.records.forEach(rec => {
          detailData.push({
            'Staff Name': r.staffName,
            'Employee Code': r.employeeCode,
            'Date': rec.date,
            'Check In': rec.check_in_time ? new Date(rec.check_in_time).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-',
            'Check Out': rec.check_out_time ? new Date(rec.check_out_time).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-',
            'Total Hours': rec.total_hours || '-',
            'Status': rec.status,
            'Remarks': rec.remarks || '',
          });
        });
      });

      const wb = XLSX.utils.book_new();
      
      // Summary sheet
      const ws1 = XLSX.utils.json_to_sheet(worksheetData);
      ws1['!cols'] = [
        { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 10 },
        { wch: 12 }, { wch: 10 }, { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

      // Detail sheet
      const ws2 = XLSX.utils.json_to_sheet(detailData);
      ws2['!cols'] = [
        { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 25 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Detail');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const companyName = company?.company_name || 'company';
      const filename = `${companyName.replace(/\s+/g, '_')}_Attendance_${month}.xlsx`;

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({
      month,
      companyName: company?.company_name || '',
      report,
    });
  } catch (err) {
    console.error('Reports error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
