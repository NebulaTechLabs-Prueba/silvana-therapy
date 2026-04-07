import SectionEyebrow from '@/components/ui/SectionEyebrow';

const STATS = [
  { num: '10+', label: 'años de experiencia' },
  { num: '250', label: 'docentes formados' },
  { num: '22', label: 'instituciones gestionadas' },
];

const BLOCKS = [
  {
    title: 'Formación Académica',
    text: 'Graduada a los 24 años de la Universidad de la Aconcagua (Mendoza), entre las primeras de su promoción. Complementó su Licenciatura en Psicología con 10 materias pedagógicas, obteniendo también el título de Profesora de Psicología. Desde 2020, ejerce como docente en la Facultad de Psicología de la Universidad de Mendoza.',
  },
  {
    title: 'Experiencia Clínica y Social',
    text: 'Durante 10 años integró equipos multidisciplinarios en centros de salud pública —médicos, psicólogos, psicopedagogos y psiquiatras—, especializándose en crisis familiares, violencias, revinculaciones, abusos e intentos de suicidio, en coordinación con el sistema educativo y judicial. Gestionó 22 instituciones educativas estatales implementando programas de abordaje integral y clima escolar.',
  },
  {
    title: 'Especialización en Virtualidad',
    text: 'Su inmersión en la modalidad virtual comenzó coordinando el programa "Comunidad de Aprendizaje" para escuelas, liderando equipos multidisciplinarios de forma completamente virtual. Esta experiencia la posicionó como referente del trabajo remoto de alta calidad.',
  },
  {
    title: 'Visión y Práctica Actual',
    text: 'Trabaja en red con pediatras, neurólogos, cardiólogos y psiquiatras para gestionar casos complejos con visión global. Atiende pacientes de diversas nacionalidades, enriqueciendo cada sesión desde la perspectiva multicultural y ofreciendo un acompañamiento adaptado y empático.',
  },
];

export default function ProfileSection() {
  return (
    <section id="perfil" className="bg-text-dark px-[5vw] py-24 relative overflow-hidden">
      {/* Logo watermark */}
      <div className="absolute -right-[3%] top-1/2 -translate-y-1/2 opacity-[0.04] pointer-events-none">
        <img src="/logo.svg" alt="" className="w-[420px] h-auto invert brightness-200" />
      </div>

      <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-20 max-md:gap-12 items-start relative z-[1]">
        {/* Photo */}
        <div className="rounded-3xl overflow-hidden aspect-[3/4] max-md:aspect-[4/3] max-md:max-w-[360px] border border-[rgba(255,255,255,0.08)]">
          <img
            src="/images/perfil-profile.jpg"
            alt="Lda. Silvana López"
            className="w-full h-full object-cover object-[center_top]"
          />
        </div>

        {/* Content */}
        <div>
          <SectionEyebrow light>Trayectoria</SectionEyebrow>
          <h2 className="font-serif text-clamp-section font-light leading-[1.2] text-white mb-4">
            Perfil
            <br />
            <em className="italic text-green-soft">Profesional</em>
          </h2>

          <div className="flex gap-10 mt-6 flex-wrap">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <span className="font-serif text-[2.2rem] font-light text-green-soft block leading-none">
                  {stat.num}
                </span>
                <span className="text-[0.7rem] text-[rgba(255,255,255,0.4)] tracking-[0.08em]">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-8 mt-10">
            {BLOCKS.map((block) => (
              <div
                key={block.title}
                className="border-l-2 border-green-deep pl-6"
              >
                <h4 className="text-[0.68rem] tracking-[0.18em] uppercase text-green-soft mb-2">
                  {block.title}
                </h4>
                <p className="text-[0.88rem] text-[rgba(255,255,255,0.6)] leading-[1.75]">
                  {block.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
