import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { buildAuthUrl } from '@/lib/adapters/google-auth';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminBase = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3000';
  if (!user) return NextResponse.redirect(new URL('/login', adminBase));

  const state = randomBytes(16).toString('hex');
  const url = buildAuthUrl(state);

  const res = NextResponse.redirect(url);
  res.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  });
  return res;
}
