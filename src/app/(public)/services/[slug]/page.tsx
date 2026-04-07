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
    .single();

  return {
    title: `${service?.name ?? 'Servicio'} — Lda. Silvana López`,
  };
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  const [serviceRes, settingsRes, payMethodsRes] = await Promise.all([
    supabase.from('services').select('*').eq('slug', slug).eq('active', true).single(),
    supabase.from('admin_settings').select('working_hours').limit(1).single(),
    supabase.from('payment_methods').select('nombre').eq('activo', true).order('prioridad'),
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
      <ServiceDetailClient service={service} workingHours={settingsRes.data?.working_hours ?? null} activePaymentMethods={(payMethodsRes.data ?? []).map((m: { nombre: string }) => m.nombre)} />
      <Footer />
    </>
  );
}
