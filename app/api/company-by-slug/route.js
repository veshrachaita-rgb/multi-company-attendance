import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: company, error } = await supabase
      .from('companies')
      .select('id, company_name, company_slug, status')
      .eq('company_slug', slug)
      .eq('status', 'active')
      .single();

    if (error || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json({ company });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
