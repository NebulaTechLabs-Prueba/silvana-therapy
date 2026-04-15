import { notFound } from 'next/navigation';
import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';
import ServiceDetailClient from '@/components/public/ServiceDetailClient';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: service } = await supabase
    .from('services')
    .select('name')
    .eq('slug', slug)
    .eq('active', true)
    .eq('is_internal', false)
    .single();

  return {
    title: `${service?.name ?? 'Servicio'} — Lda. Silvana López`,
  };
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  const today = new Date();
  const to = new Date(today); to.setDate(to.getDate() + 60);
  const fromISO = today.toISOString().slice(0,10);
  const toISO = to.toISOString().slice(0,10);

  const [serviceRes, settingsRes, payMethodsRes, exceptionsRes] = await Promise.all([
    supabase.from('services').select('*').eq('slug', slug).eq('active', true).eq('is_internal', false).single(),
    supabase.rpc('get_public_contact').single(),
    supabase.from('payment_methods').select('nombre').eq('activo', true).order('prioridad'),
    supabase.rpc('get_active_exceptions', { from_date: fromISO, to_date: toISO }),
  ]);

  const service = serviceRes.data;
  if (!service) notFound();

  return (
    <>
      <Navbar />
      <div className="pt-36 pb-6 px-[5vw] bg-green-lightest border-b border-green-pale">
        <p className="text-[0.7rem] tracking-[0.22em] uppercase text-green-deep mb-4 flex items-center gap-3">
          <span className="block w-6 h-px bg-green-deep" />
          Servicios
        </p>
        <h1 className="font-serif text-clamp-page font-light leading-[1.2] text-text-dark">
          {service.name}
        </h1>
      </div>
      <ServiceDetailClient service={service} workingHours={settingsRes.data?.working_hours ?? null} activePaymentMethods={(payMethodsRes.data ?? []).map((m: { nombre: string }) => m.nombre)} exceptions={exceptionsRes.data ?? []} />
      <Footer />
    </>
  );
}
