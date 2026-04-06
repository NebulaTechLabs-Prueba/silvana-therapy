import { createClient } from '@supabase/supabase-js';

/**
 * Admin client — bypasses ALL RLS policies.
 * ONLY use in:
 *   - Webhook handlers (Stripe, PayPal)
 *   - Server-side operations that don't have user context
 *   - Background jobs (cron, payment link expiry)
 *
 * NEVER expose this on the client side.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
