import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware handles two concerns:
 * 1. Domain routing — public vs admin subdomain
 * 2. Auth protection — admin routes require authenticated session
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // ─── Refresh Supabase session (keeps cookies alive) ─────
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options as never);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // ─── Admin subdomain protection ─────────────────────────
  const isAdminDomain = hostname.startsWith('admin.');
  const isAdminRoute = pathname.startsWith('/admin');
  const isLoginRoute = pathname === '/login';
  const isApiRoute = pathname.startsWith('/api');
  const isWebhookRoute = pathname.startsWith('/api/webhooks');

  // Webhooks don't need auth (they use their own verification)
  if (isWebhookRoute) {
    return response;
  }

  // API routes for public booking form (no auth needed)
  if (isApiRoute && !pathname.startsWith('/api/admin')) {
    return response;
  }

  // Admin routes: require authentication
  if (isAdminDomain || isAdminRoute) {
    if (!user && !isLoginRoute) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (user && isLoginRoute) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (browser icon)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
