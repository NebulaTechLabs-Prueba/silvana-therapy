import Link from 'next/link';

export default function ParallaxBand() {
  return (
    <div className="relative h-[440px] max-md:h-[320px] max-sm:h-[260px] overflow-hidden">
      {/* Background — gradient fallback until video is provided */}
      <div className="absolute inset-0 bg-gradient-to-br from-text-dark to-green-deep" />

      {/* Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(42,53,40,0.65)_0%,rgba(74,122,74,0.4)_100%)] flex items-center justify-center flex-col text-center px-8">
        <p className="font-serif text-clamp-parallax font-light italic text-white leading-[1.35] max-w-[700px] [text-shadow:0_2px_20px_rgba(0,0,0,0.25)] mb-4">
          &ldquo;Hoy puedes dar un paso más.
          <br />
          Haz tu consulta sin compromiso.&rdquo;
        </p>
        <span className="text-[0.73rem] tracking-[0.18em] uppercase text-[rgba(255,255,255,0.65)] mb-8">
          — Lda. Silvana López · Psicoterapia Online
        </span>
        <Link
          href="/booking"
          className="inline-flex items-center gap-2.5 bg-[rgba(255,255,255,0.18)] text-white border border-[rgba(255,255,255,0.4)] backdrop-blur-[6px] py-3.5 px-8 rounded-full text-[0.82rem] font-normal tracking-[0.06em] no-underline transition-all duration-250 hover:bg-[rgba(255,255,255,0.3)]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Realizar la primera cita gratuita
        </Link>
      </div>
    </div>
  );
}
