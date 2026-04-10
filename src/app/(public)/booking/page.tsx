import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';
import BookingFormClient from '@/components/public/BookingFormClient';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Reservar cita — Lda. Silvana López',
  description: 'Reserva tu primera consulta gratuita.',
};

export default async function BookingPage() {
  const supabase = await createServerSupabaseClient();

  // Fetch service, working hours, payment methods, and existing bookings in parallel
  const [serviceRes, settingsRes, payMethodsRes, bookingsRes] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, duration_min, is_free')
      .eq('is_free', true)
      .eq('active', true)
      .order('sort_order')
      .limit(1)
      .single(),
    supabase.rpc('get_public_contact').single(),
    supabase
      .from('payment_methods')
      .select('nombre, recargo_pct')
      .eq('activo', true)
      .order('prioridad'),
    // Fetch active bookings to block occupied slots
    supabase
      .from('bookings')
      .select('preferred_date, service:services(duration_min)')
      .not('status', 'in', '("cancelled","rejected")')
      .gte('preferred_date', new Date().toISOString().slice(0, 10)),
  ]);

  const service = serviceRes.data;
  const workingHours = settingsRes.data?.working_hours ?? null;
  const activePaymentMethods = (payMethodsRes.data ?? []).map((m: { nombre: string; recargo_pct?: number }) => ({ nombre: m.nombre, recargoPct: m.recargo_pct || 0 }));

  // Build booked slots: array of { date, time, duration }
  const bookedSlots = (bookingsRes.data ?? [])
    .filter((b: any) => b.preferred_date)
    .map((b: any) => {
      const str = String(b.preferred_date);
      const date = str.slice(0, 10);
      // Extract time from string directly — avoids Date TZ conversion issues
      const time = str.includes('T') ? str.split('T')[1].slice(0, 5) : '00:00';
      const duration = b.service?.duration_min || 60;
      return { date, time, duration };
    });

  return (
    <>
      <Navbar />
      <div className="pt-36 pb-6 px-[5vw] bg-green-lightest border-b border-green-pale">
        <p className="text-[0.7rem] tracking-[0.22em] uppercase text-green-deep mb-4 flex items-center gap-3">
          <span className="block w-6 h-px bg-green-deep" />
          Reserva tu cita
        </p>
        <h1 className="font-serif text-clamp-page font-light leading-[1.2] text-text-dark">
          Elige fecha, hora y
          <br />
          <em className="italic text-green-deep">completa tus datos</em>
        </h1>
      </div>
      <BookingFormClient
        serviceId={service?.id ?? ''}
        serviceName={service?.name ?? 'Primera consulta gratuita'}
        serviceDuration={service?.duration_min ?? 50}
        workingHours={workingHours}
        isFree={service?.is_free ?? true}
        activePaymentMethods={activePaymentMethods}
        bookedSlots={bookedSlots}
      />
      <Footer />
    </>
  );
}
