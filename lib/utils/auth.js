import { createClient } from '@/lib/supabase/server';

/**
 * Get the current authenticated admin user with role and company info
 * Returns null if not authenticated or not an admin
 */
export async function getAdminUser() {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: adminUser, error } = await supabase
    .from('admin_users')
    .select('*, companies(company_name, company_slug)')
    .eq('id', user.id)
    .eq('status', 'active')
    .single();

  if (error || !adminUser) return null;
  return adminUser;
}

/**
 * Check if current user is a super admin
 * Throws an error with appropriate message if not
 */
export async function requireSuperAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new Error('Authentication required');
  if (admin.role !== 'super_admin') throw new Error('Super Admin access required');
  return admin;
}

/**
 * Check if current user has access to a specific company
 * Super admins have access to all companies
 * Company admins only have access to their assigned company
 */
export async function requireCompanyAccess(companyId) {
  const admin = await getAdminUser();
  if (!admin) throw new Error('Authentication required');
  if (admin.role === 'super_admin') return admin;
  if (admin.company_id !== companyId) throw new Error('Access denied to this company');
  return admin;
}

/**
 * Get the company_id for the current admin
 * For super_admin, requires explicit companyId parameter
 * For company_admin, returns their assigned company_id
 */
export async function getEffectiveCompanyId(requestedCompanyId) {
  const admin = await getAdminUser();
  if (!admin) throw new Error('Authentication required');
  
  if (admin.role === 'super_admin') {
    return requestedCompanyId || null; // null means all companies
  }
  
  return admin.company_id;
}
