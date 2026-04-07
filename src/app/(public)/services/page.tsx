import Link from 'next/link';
import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';
import ArrowIcon from '@/components/ui/ArrowIcon';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Service } from '@/types/database';

export const metadata = {
  title: 'Servicios — Lda. Silvana López',
  description: 'Conoce los servicios de psicoterapia online disponibles.',
};

export default async function ServicesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('active', true)
    .order('sort_order');

  const list: Service[] = services ?? [];

  return (
    <>
      <Navbar />

      {/* Page Header */}
      <div className="pt-36 pb-14 px-[5vw] bg-green-lightest border-b border-green-pale">
        <p className="text-[0.7rem] tracking-[0.22em] uppercase text-green-deep mb-4 flex items-center gap-3">
          <span className="block w-6 h-px bg-green-deep" />
          Reserva tu cita
        </p>
        <h1 className="font-serif text-clamp-page font-light leading-[1.2] text-text-dark">
          Elige el espacio
          <br />
          <em className="italic text-green-deep">que necesitas</em>
        </h1>
        <p className="text-[0.95rem] text-text-mid mt-1 max-w-[500px]">
          Todas las sesiones son online, confidenciales y con horarios flexibles.
        </p>
      </div>

      {/* Services list */}
      <div className="max-w-[900px] mx-auto px-[5vw] py-16">
        <div className="flex flex-col gap-5">
          {list.map((svc) => (
            <div
              key={svc.id}
              className="grid grid-cols-[1fr_auto] max-sm:grid-cols-1 gap-8 border border-green-pale rounded-3xl p-8 transition-all duration-300 hover:border-green-soft hover:shadow-[0_8px_30px_rgba(74,122,74,0.08)] hover:-translate-y-0.5"
            >
              <div>
                {svc.tag && (
                  <p className="text-[0.65rem] tracking-[0.15em] uppercase text-green-mid mb-1">
                    {svc.tag}
                  </p>
                )}
                <h2 className="font-serif text-[1.45rem] font-normal text-text-dark mb-2">
                  {svc.name}
                </h2>
                {svc.description && (
                  <p className="text-[0.88rem] text-text-mid leading-[1.65] mb-4">
                    {svc.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2.5">
                  <span className="bg-green-lightest border border-green-pale rounded-full py-1 px-3.5 text-[0.72rem] text-text-mid">
                    {svc.duration_min} min
                  </span>
                  <span className="bg-green-lightest border border-green-pale rounded-full py-1 px-3.5 text-[0.72rem] text-text-mid">
                    {svc.modality ?? 'Online'}
                  </span>
                  {svc.type_label && (
                    <span className="bg-green-lightest border border-green-pale rounded-full py-1 px-3.5 text-[0.72rem] text-text-mid">
                      {svc.type_label}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end max-sm:flex-row max-sm:justify-between max-sm:items-center gap-5 min-w-[130px]">
                <div className="font-serif text-[2rem] font-light text-text-dark">
                  {svc.is_free ? (
                    <span className="text-green-deep">Gratis</span>
                  ) : svc.price ? (
                    <>
                      {svc.price} <small className="text-[0.7rem] font-sans text-text-light">USD</small>
                    </>
                  ) : (
                    <span className="text-green-deep">Consultar</span>
                  )}
                </div>
                <Link
                  href={svc.is_free ? '/booking' : (svc.slug ? `/services/${svc.slug}` : '/booking')}
                  className="inline-flex items-center gap-2.5 bg-green-deep text-[#fff] py-3.5 px-7 rounded-full text-[0.82rem] font-normal tracking-[0.06em] no-underline transition-all duration-250 hover:bg-text-dark hover:-translate-y-0.5"
                >
                  {svc.is_free ? 'Reservar gratis' : 'Ver y reservar'}
                  <ArrowIcon />
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-[0.85rem] text-text-light mt-10">
          ¿No sabes cuál elegir?{' '}
          <Link href="/#contacto" className="text-green-deep no-underline hover:underline">
            Contáctame antes →
          </Link>
        </p>
      </div>

      <Footer />
    </>
  );
}
