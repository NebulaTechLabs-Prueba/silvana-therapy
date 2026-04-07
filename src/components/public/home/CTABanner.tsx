import Link from 'next/link';

export default function CTABanner() {
  return (
    <div className="mx-[5vw] mb-16 bg-green-lightest border border-green-pale rounded-[2rem] py-16 px-20 max-md:px-10 max-md:py-10 flex items-center justify-between gap-12 max-md:flex-col relative overflow-hidden">
      {/* Logo watermark */}
      <div className="absolute right-16 top-1/2 -translate-y-1/2 opacity-[0.07] pointer-events-none">
        <img src="/logo.svg" alt="" className="w-[200px] h-auto" />
      </div>

      <div className="relative z-[1]">
        <h2 className="font-serif text-clamp-cta font-light text-text-dark mb-2.5">
          Hoy puedes dar
          <br />
          <em className="italic text-green-deep">un paso más.</em>
        </h2>
        <p className="text-[0.9rem] text-text-mid max-w-[420px]">
          Agenda tu primera consulta sin cargo. Sin compromiso, solo una conversación
          para conocernos y explorar cómo puedo acompañarte.
        </p>
      </div>
      <Link
        href="/booking"
        className="inline-flex items-center gap-2.5 bg-green-deep text-white py-4 px-9 rounded-full text-[0.9rem] font-normal tracking-[0.06em] no-underline transition-all duration-250 hover:bg-text-dark hover:-translate-y-0.5 shrink-0 whitespace-nowrap relative z-[1]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Realizar la primera cita gratuita
      </Link>
    </div>
  );
}
