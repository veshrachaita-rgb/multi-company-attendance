import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify company exists and is active
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, company_name')
      .eq('id', companyId)
      .eq('status', 'active')
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Get active staff for this company
    const { data: staffList, error } = await supabase
      .from('staff')
      .select('id, name, employee_code')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('name', { ascending: true });

    if (error) {
      console.error('Staff fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch staff list' },
        { status: 500 }
      );
    }

    return NextResponse.json({ staff: staffList || [] });
  } catch (err) {
    console.error('Staff API error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
