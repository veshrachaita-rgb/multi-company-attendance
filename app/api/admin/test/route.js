export async function GET(request) {
  const { getAdminUser } = await import('@/lib/utils/auth');
  const admin = await getAdminUser();
  return Response.json({ admin });
}
