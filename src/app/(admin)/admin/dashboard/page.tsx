import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

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
  const [settingsRes, servicesRes, invoicesRes, bookingsRes, paymentMethodsRes] = await Promise.all([
    supabase.from('admin_settings').select('*').limit(1).single(),
    supabase.from('services').select('*').order('sort_order'),
    supabase.from('invoices').select('*').order('fecha', { ascending: false }),
    supabase
      .from('bookings')
      .select('*, client:clients(*), service:services(name)')
      .order('preferred_date', { ascending: true }),
    supabase.from('payment_methods').select('*').order('prioridad'),
  ]);

  return (
    <DashboardClient
      userEmail={user.email || ''}
      userName={userName}
      initialSettings={settingsRes.data}
      initialServices={servicesRes.data ?? []}
      initialInvoices={invoicesRes.data ?? []}
      initialBookings={bookingsRes.data ?? []}
      initialPaymentMethods={paymentMethodsRes.data ?? []}
    />
  );
}
