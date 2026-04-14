import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import { getGoogleIntegrationStatus } from '@/lib/adapters/google-auth';

export const metadata = {
  title: 'Dashboard — Lda. Silvana López',
};

/**
 * Dashboard Page (Server Component)
 * ─────────────────────────────────────────────────────────────
 * - Double-checks auth on every request
 * - Fetches user, settings, services, invoices, bookings, payment methods
 * - Passes everything to the client-side dashboard
 */
export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const userName = (user.user_metadata?.full_name as string) || undefined;

  // Fetch all dashboard data in parallel
  const [settingsRes, servicesRes, invoicesRes, bookingsRes, paymentMethodsRes, linksRes, availablePayLinksRes, exceptionsRes, exceptionDatesRes] = await Promise.all([
    supabase.from('admin_settings').select('*').limit(1).single(),
    supabase.from('services').select('*').order('sort_order'),
    supabase.from('invoices').select('*').order('fecha', { ascending: false }),
    supabase
      .from('bookings')
      .select('*, client:clients(*), service:services(id, name, duration_min, price, is_free), payment_links(*)')
      .order('preferred_date', { ascending: true }),
    supabase.from('payment_methods').select('*').order('prioridad'),
    supabase.from('admin_links').select('*').order('sort_order'),
    supabase.from('payment_links').select('*').is('booking_id', null).eq('status', 'active').order('created_at', { ascending: false }),
    supabase.from('availability_exceptions').select('*').order('created_at', { ascending: false }),
    supabase.from('availability_exception_dates').select('*'),
  ]);

  const googleStatus = await getGoogleIntegrationStatus().catch(() => ({ connected: false }));

  const datesByExc: Record<string, string[]> = {};
  (exceptionDatesRes.data ?? []).forEach((r: { exception_id: string; date: string }) => {
    (datesByExc[r.exception_id] ||= []).push(r.date);
  });
  const exceptions = (exceptionsRes.data ?? []).map((e: Record<string, unknown>) => ({
    ...e,
    dates: datesByExc[e.id as string] || [],
  }));

  return (
    <DashboardClient
      userEmail={user.email || ''}
      userName={userName}
      initialSettings={settingsRes.data}
      initialServices={servicesRes.data ?? []}
      initialInvoices={invoicesRes.data ?? []}
      initialBookings={bookingsRes.data ?? []}
      initialPaymentMethods={paymentMethodsRes.data ?? []}
      initialLinks={linksRes.data ?? []}
      availablePaymentLinks={availablePayLinksRes.data ?? []}
      initialExceptions={exceptions}
      googleStatus={googleStatus}
    />
  );
}
