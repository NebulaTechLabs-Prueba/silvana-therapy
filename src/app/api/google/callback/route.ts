import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens, saveTokens } from '@/lib/adapters/google-auth';

export async function GET(request: NextRequest) {
  // Usar NEXT_PUBLIC_ADMIN_URL en vez de request.url porque en modo standalone
  // detrás de un proxy, request.url resuelve a la dirección interna (0.0.0.0:3000)
  // y no al host público que ve el navegador.
  const adminBase = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3000';

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', adminBase));

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  const dashboard = new URL('/admin/dashboard', adminBase);

  if (error) {
    dashboard.searchParams.set('google', 'error');
    dashboard.searchParams.set('reason', error);
    return NextResponse.redirect(dashboard);
  }
  if (!code) {
    dashboard.searchParams.set('google', 'error');
    dashboard.searchParams.set('reason', 'missing_code');
    return NextResponse.redirect(dashboard);
  }

  const cookieState = request.cookies.get('google_oauth_state')?.value;
  if (!cookieState || cookieState !== state) {
    dashboard.searchParams.set('google', 'error');
    dashboard.searchParams.set('reason', 'state_mismatch');
    return NextResponse.redirect(dashboard);
  }

  try {
    const { tokens, email } = await exchangeCodeForTokens(code);
    await saveTokens({ tokens, email });
    dashboard.searchParams.set('google', 'connected');
  } catch (e: unknown) {
    dashboard.searchParams.set('google', 'error');
    dashboard.searchParams.set('reason', (e as Error).message.slice(0, 120));
  }

  const res = NextResponse.redirect(dashboard);
  res.cookies.delete('google_oauth_state');
  return res;
}
