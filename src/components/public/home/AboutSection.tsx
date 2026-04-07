import Link from 'next/link';
import SectionEyebrow from '@/components/ui/SectionEyebrow';

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-green-deep">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: '100% confidencial',
    desc: 'Tu privacidad, siempre protegida',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-green-deep">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'Horarios flexibles',
    desc: 'Nos adaptamos a tu agenda',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-green-deep">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    title: 'Sin barreras geográficas',
    desc: 'Desde cualquier país del mundo',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-green-deep">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    ),
    title: 'Enfoque personalizado',
    desc: 'Plan adaptado a cada persona',
  },
];

export default function AboutSection() {
  return (
    <section
      id="liclopez"
      className="bg-green-lightest px-[5vw] py-24 grid grid-cols-1 md:grid-cols-2 gap-20 max-md:gap-12 items-center"
    >
      {/* Image */}
      <div className="relative max-md:max-w-[420px]">
        <div className="relative">
          {/* Logo watermark */}
          <img
            src="/logo.svg"
            alt=""
            className="absolute -top-4 -right-8 w-[200px] h-auto opacity-[0.06] pointer-events-none z-0"
          />
          <div className="w-full max-w-[460px] aspect-[4/5] bg-green-pale rounded-3xl overflow-hidden border border-green-soft">
            <img
              src="/images/about-profile.jpg"
              alt="Lda. Silvana López"
              className="w-full h-full object-cover object-[center_top]"
            />
          </div>
        </div>
        <div className="absolute bottom-8 -left-6 max-md:left-0 bg-white rounded-2xl py-4 px-5 shadow-[0_8px_30px_rgba(74,122,74,0.12)] border border-green-pale">
          <strong className="block font-serif text-[1.05rem] text-text-dark">
            Lda. Silvana López
          </strong>
          <span className="text-[0.72rem] text-text-light tracking-[0.05em]">
            Psicóloga Online · Desde 2020
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-[1]">
        <SectionEyebrow>Sobre mí</SectionEyebrow>
        <h2 className="font-serif text-clamp-section font-light leading-[1.2] text-text-dark mb-4">
          Psicóloga online
          <br />
          con <em className="italic text-green-deep">enfoque integral</em>
        </h2>
        <p className="text-[0.95rem] text-text-mid max-w-[480px] mb-8">
          Soy Silvana López, licenciada en Psicología, docente universitaria y
          especializada en terapia online. Acompaño a personas de habla hispana en
          todo el mundo a través de sesiones personalizadas y confidenciales.
        </p>
        <Link
          href="/#perfil"
          className="inline-flex items-center gap-2.5 bg-green-deep text-white py-3.5 px-8 rounded-full text-[0.82rem] font-normal tracking-[0.06em] no-underline transition-all duration-250 hover:bg-text-dark hover:-translate-y-0.5 mb-8"
        >
          Ver trayectoria completa
        </Link>

        <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
          {FEATURES.map((feat) => (
            <div
              key={feat.title}
              className="bg-white border border-green-pale rounded-2xl p-5"
            >
              <div className="w-8 h-8 bg-green-pale rounded-[0.6rem] flex items-center justify-center mb-3">
                {feat.icon}
              </div>
              <h4 className="text-[0.82rem] font-medium text-text-dark mb-0.5">
                {feat.title}
              </h4>
              <p className="text-[0.78rem] text-text-light">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
