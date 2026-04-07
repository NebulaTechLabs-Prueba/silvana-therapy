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

  // Fetch service + working hours in parallel
  const [serviceRes, settingsRes, payMethodsRes] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, duration_min, is_free')
      .eq('is_free', true)
      .eq('active', true)
      .order('sort_order')
      .limit(1)
      .single(),
    supabase
      .from('admin_settings')
      .select('working_hours')
      .limit(1)
      .single(),
    supabase
      .from('payment_methods')
      .select('nombre')
      .eq('activo', true)
      .order('prioridad'),
  ]);

  const service = serviceRes.data;
  const workingHours = settingsRes.data?.working_hours ?? null;
  const activePaymentMethods = (payMethodsRes.data ?? []).map((m: { nombre: string }) => m.nombre);

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
      />
      <Footer />
    </>
  );
}
