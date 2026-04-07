import SectionEyebrow from '@/components/ui/SectionEyebrow';

const BENEFITS = [
  { title: 'Comodidad total', desc: 'Tomas la sesión desde el lugar que prefieras, en tu propio espacio.' },
  { title: 'Ahorro de tiempo', desc: 'Sin traslados ni esperas. Aprovecha cada minuto de tu día.' },
  { title: 'Flexibilidad horaria', desc: 'Agendamos en los horarios que mejor se adapten a tu rutina.' },
  { title: 'Sin límites geográficos', desc: 'Elige al profesional que necesitas, sin importar dónde estés.' },
  { title: 'Mayor privacidad', desc: 'Sesiones desde casa, con total confidencialidad garantizada.' },
  { title: 'Misma eficacia', desc: 'Resultados comprobados, con la misma efectividad que la terapia presencial.' },
];

export default function BenefitsSection() {
  return (
    <section
      id="beneficios"
      className="bg-text-dark text-white px-[5vw] py-24 relative overflow-hidden"
    >
      {/* Logo watermark */}
      <div className="absolute -left-[3%] -bottom-[8%] opacity-[0.04] pointer-events-none">
        <img src="/logo.svg" alt="" className="w-[380px] h-auto invert brightness-200" />
      </div>

      <div className="max-w-[1100px] relative z-[1]">
        <SectionEyebrow light>Ventajas</SectionEyebrow>
        <h2 className="font-serif text-clamp-section font-light leading-[1.2] text-white mb-4">
          ¿Por qué elegir
          <br />
          <em className="italic text-green-soft">terapia online?</em>
        </h2>
        <p className="text-[0.95rem] text-[rgba(255,255,255,0.5)] max-w-[480px] mb-12">
          La misma eficacia que la terapia presencial, con ventajas únicas que se
          adaptan a tu vida.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[rgba(255,255,255,0.07)] rounded-3xl overflow-hidden">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="bg-text-dark py-8 px-7 transition-colors duration-250 hover:bg-[#354333]"
            >
              <div className="w-2 h-2 rounded-full bg-green-soft mb-4" />
              <h4 className="font-serif text-[1.05rem] font-normal text-white mb-1.5">
                {b.title}
              </h4>
              <p className="text-[0.82rem] text-[rgba(255,255,255,0.45)]">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
