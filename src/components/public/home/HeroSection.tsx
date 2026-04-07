import Link from 'next/link';

const CHECKLIST = [
  'Primera consulta sin cargo',
  'Sesiones desde cualquier lugar del mundo',
  'Valores accesibles · Stripe o PayPal',
];

export default function HeroSection() {
  return (
    <section
      id="inicio"
      className="min-h-screen grid grid-cols-1 lg:grid-cols-2 items-center px-[5vw] pt-32 pb-20 gap-16 max-lg:gap-10 max-lg:pt-28"
    >
      {/* Text */}
      <div className="max-w-[560px] animate-fade-up">
        <p className="text-[0.7rem] tracking-[0.22em] uppercase text-green-deep mb-6 flex items-center gap-3">
          <span className="block w-8 h-px bg-green-deep" />
          Psicoterapia Online
        </p>

        <h1 className="font-serif text-clamp-hero font-light leading-[1.15] text-text-dark mb-6">
          Un espacio para
          <br />
          <em className="italic text-green-deep">comenzar a sentirte</em>
          <br />
          mejor
        </h1>

        <p className="text-base text-text-mid mb-10 max-w-[420px]">
          Sesiones personalizadas y confidenciales desde el lugar más cómodo para ti.
          Tu bienestar, mi prioridad.
        </p>

        <div className="flex flex-wrap gap-4 max-sm:flex-col animate-fade-up-4">
          <Link
            href="/booking"
            className="inline-flex items-center gap-2.5 bg-green-deep text-white py-3.5 px-8 rounded-full text-[0.82rem] font-normal tracking-[0.06em] no-underline transition-all duration-250 hover:bg-text-dark hover:-translate-y-0.5"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Primera cita gratuita
          </Link>
          <Link
            href="/#liclopez"
            className="inline-flex items-center gap-2.5 border border-green-soft text-text-mid py-3.5 px-8 rounded-full text-[0.82rem] font-normal tracking-[0.06em] no-underline transition-all duration-250 hover:border-green-deep hover:text-green-deep"
          >
            Conocer más
          </Link>
        </div>

        <ul className="mt-10 flex flex-col gap-2.5 animate-fade-up-4">
          {CHECKLIST.map((item) => (
            <li
              key={item}
              className="flex items-center gap-3 text-[0.88rem] text-text-mid list-none"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-soft shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Visual card — hidden on mobile */}
      <div className="relative flex items-center justify-center max-md:hidden animate-fade-up-2">
        <div className="bg-green-lightest rounded-[2rem] w-full max-w-[400px] aspect-[3/4] relative overflow-hidden border border-green-pale">
          <img
            src="/images/hero-profile.jpg"
            alt="Lda. Silvana López"
            className="w-full h-full object-cover object-[center_top]"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[rgba(42,53,40,0.72)] to-transparent p-8 pt-16">
            <p className="font-serif text-[1.05rem] italic text-[rgba(255,255,255,0.92)] leading-relaxed">
              &ldquo;Estar aquí es una señal de que quieres sentirte mejor.&rdquo;
            </p>
          </div>
        </div>

        {/* Badge */}
        <div className="absolute top-6 right-6 bg-[rgba(255,255,255,0.95)] border border-green-pale rounded-2xl py-3 px-4 text-center shadow-[0_4px_20px_rgba(74,122,74,0.12)]">
          <span className="font-serif text-[7.2rem] font-light text-green-deep block leading-none">
            1
          </span>
          <span className="text-[0.65rem] tracking-[0.1em] uppercase text-text-light">
            cita gratis
          </span>
        </div>
      </div>
    </section>
  );
}
