import SectionEyebrow from '@/components/ui/SectionEyebrow';

const STEPS = [
  {
    num: '01',
    title: 'Reserva tu primera cita',
    desc: 'Agenda directamente desde aquí, o escríbeme por WhatsApp si tienes preguntas previas.',
  },
  {
    num: '02',
    title: 'Primera consulta gratuita',
    desc: 'Nos conoceremos en un encuentro online sin costo. Conversaremos en vivo para que evalúes si te sientes a gusto con la terapia.',
  },
  {
    num: '03',
    title: 'Plan de sesiones personalizado',
    desc: 'Definiremos la frecuencia y forma de acompañamiento. 100% personalizado según tu caso y motivo de consulta.',
  },
];

export default function StepsSection() {
  return (
    <section id="terapia-online" className="px-[5vw] py-24">
      <div className="max-w-[1100px]">
        <SectionEyebrow>Proceso</SectionEyebrow>
        <h2 className="font-serif text-clamp-section font-light leading-[1.2] text-text-dark mb-4">
          ¿Cómo comenzar tu
          <br />
          <em className="italic text-green-deep">terapia online?</em>
        </h2>
        <p className="text-[0.95rem] text-text-mid max-w-[480px] mb-12">
          Tres pasos simples para iniciar tu camino hacia el bienestar.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="border border-green-pale rounded-3xl py-10 px-8 transition-all duration-300 hover:border-green-soft hover:shadow-[0_8px_30px_rgba(74,122,74,0.07)]"
            >
              <span className="font-serif text-5xl font-light text-green-pale leading-none block mb-4">
                {step.num}
              </span>
              <h3 className="font-serif text-xl font-normal text-text-dark mb-2.5">
                {step.title}
              </h3>
              <p className="text-[0.88rem] text-text-mid">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
