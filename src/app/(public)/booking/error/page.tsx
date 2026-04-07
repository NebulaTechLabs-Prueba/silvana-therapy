import Link from 'next/link';
import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';
import ArrowIcon from '@/components/ui/ArrowIcon';

export const metadata = {
  title: 'Error en la reserva — Lda. Silvana López',
};

export default function BookingErrorPage() {
  return (
    <>
      {/* Animated background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[520px] h-[520px] rounded-full bg-green-pale opacity-60 -top-[10%] -left-[5%] animate-drift-1" />
        <div className="absolute w-[340px] h-[340px] rounded-full bg-green-pale opacity-50 -bottom-[5%] -right-[5%] animate-drift-2" />
        <div className="absolute w-[200px] h-[200px] rounded-full bg-green-pale opacity-35 top-1/2 left-[15%] animate-drift-3" />
      </div>

      <div className="relative z-10">
        <Navbar />
      </div>

      <main className="relative z-[1] min-h-[calc(100vh-160px)] flex items-center justify-center px-[5vw] pt-32 pb-16">
        <div className="max-w-[560px] text-center">
          {/* Ornament icon */}
          <div className="flex justify-center mb-8">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-green-soft animate-pulse-ring" />
              <div className="absolute -inset-3.5 rounded-full border border-green-pale animate-pulse-ring [animation-delay:0.5s]" />
              <div className="w-14 h-14 rounded-full bg-green-lightest flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-green-deep">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
                  <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Title */}
          <p className="text-[0.68rem] tracking-[0.28em] uppercase text-green-mid mb-4 flex items-center justify-center gap-3">
            <span className="block w-8 h-px bg-green-pale" />
            Error inesperado
            <span className="block w-8 h-px bg-green-pale" />
          </p>

          <h1 className="font-serif text-clamp-error font-light leading-[1.15] text-text-dark mb-4">
            Algo salió como
            <br />
            <em className="italic text-green-deep">no esperábamos</em>
          </h1>

          <p className="text-[0.95rem] text-text-mid leading-[1.8] max-w-[420px] mx-auto mb-8">
            Lo sentimos. Ha ocurrido un error inesperado al procesar tu solicitud.
            Por favor, intentá de nuevo o contactanos directamente.
          </p>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-4 flex-wrap max-sm:flex-col max-sm:items-stretch mb-10">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2.5 bg-green-deep text-[#fff] py-3.5 px-8 rounded-full text-[0.82rem] font-normal tracking-[0.06em] no-underline transition-all duration-250 hover:bg-text-dark hover:-translate-y-0.5"
            >
              Volver al inicio
              <ArrowIcon />
            </Link>
            <Link
              href="/booking"
              className="inline-flex items-center justify-center gap-2.5 border border-green-soft text-text-mid py-3.5 px-8 rounded-full text-[0.82rem] font-normal tracking-[0.06em] no-underline transition-all duration-250 hover:border-green-deep hover:text-green-deep"
            >
              Intentar de nuevo
            </Link>
          </div>

          {/* Divider + Contact */}
          <div className="flex items-center gap-4 mb-6">
            <span className="flex-1 h-px bg-green-pale" />
            <span className="text-[0.65rem] tracking-[0.2em] uppercase text-text-light whitespace-nowrap">
              ¿Necesitas ayuda?
            </span>
            <span className="flex-1 h-px bg-green-pale" />
          </div>

          <div className="flex items-center justify-center gap-6 text-[0.88rem]">
            <a
              href="mailto:consultas@silvanalopez.com"
              className="text-text-mid no-underline hover:text-text-dark transition-colors"
            >
              consultas@silvanalopez.com
            </a>
            <a
              href="https://wa.me/17543080643"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-mid no-underline hover:text-text-dark transition-colors"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </main>

      <div className="relative z-[1]">
        <Footer />
      </div>
    </>
  );
}
