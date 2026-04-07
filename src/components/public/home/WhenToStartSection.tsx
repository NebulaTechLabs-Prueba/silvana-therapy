import Link from 'next/link';
import SectionEyebrow from '@/components/ui/SectionEyebrow';

const SIGNALS = [
  '¿Puedes conciliar el sueño?',
  '¿Sientes ansiedad o angustia desde hace tiempo?',
  '¿Evitas salidas o interacciones que antes te hacían bien?',
  '¿Ha sucedido algo difícil de afrontar?',
  'Ataques de llanto frecuentes',
  'Conflictos familiares que te afectan negativamente',
  'Automedicarte para sentirte mejor',
  'Tratamientos alternativos sin buenos resultados',
];

const TAGS = [
  'Angustia', 'Depresión', 'Ataques de pánico',
  'Estrés', 'Duelos', 'Frustración',
  'Relaciones afectivas', 'Sexualidad',
  'Identidad de género', 'Conflictos familiares',
  'Ansiedad', 'Bienestar emocional',
];

export default function WhenToStartSection() {
  return (
    <section
      id="cuando-comenzar"
      className="px-[5vw] py-24 grid grid-cols-1 md:grid-cols-2 gap-20 max-md:gap-12 items-start"
    >
      {/* Left — Signals */}
      <div>
        <SectionEyebrow>Señales</SectionEyebrow>
        <h2 className="font-serif text-clamp-section font-light leading-[1.2] text-text-dark mb-4">
          ¿Cuándo es
          <br />
          <em className="italic text-green-deep">el momento?</em>
        </h2>
        <p className="text-[0.95rem] text-text-mid max-w-[480px] mb-6">
          Un ejercicio que sugiero: pregúntate por la calidad de vida que estás llevando.
        </p>

        <div className="flex flex-col gap-3 mt-6">
          {SIGNALS.map((signal) => (
            <div
              key={signal}
              className="flex items-start gap-4 py-4 px-5 rounded-xl border border-green-pale transition-all duration-250 hover:bg-green-lightest hover:border-green-soft"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-mid mt-2 shrink-0" />
              <p className="text-[0.88rem] text-text-mid">{signal}</p>
            </div>
          ))}
        </div>

        <br />
        <Link
          href="/booking"
          className="inline-flex items-center gap-2.5 bg-green-deep text-white py-3.5 px-8 rounded-full text-[0.82rem] font-normal tracking-[0.06em] no-underline transition-all duration-250 hover:bg-text-dark hover:-translate-y-0.5"
        >
          Realizar la primera cita gratuita
        </Link>
      </div>

      {/* Right — Tags + Quote */}
      <div>
        <SectionEyebrow>Áreas de trabajo</SectionEyebrow>
        <h2 className="font-serif text-clamp-section font-light leading-[1.2] text-text-dark mb-4">
          ¿Qué puedes
          <br />
          <em className="italic text-green-deep">tratar?</em>
        </h2>
        <p className="text-[0.95rem] text-text-mid max-w-[480px] mb-8">
          Trabajo con una amplia variedad de situaciones que afectan el bienestar
          emocional y mental.
        </p>

        <div className="flex flex-wrap gap-2.5 mb-10">
          {TAGS.map((tag) => (
            <span
              key={tag}
              className="bg-green-pale text-text-mid rounded-full py-1.5 px-4 text-[0.8rem] border border-green-soft transition-all duration-200 hover:bg-green-soft hover:text-text-dark"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-8 border-l-2 border-green-soft pl-6">
          <p className="font-serif text-[1.05rem] italic text-text-mid leading-[1.7]">
            &ldquo;Ve de a poco. Si hoy no sientes que puedas hacerlo, guarda mi sitio
            y vuelve cuando lo consideres. Estaré disponible para ayudarte.&rdquo;
          </p>
          <span className="inline-block mt-3 text-[0.75rem] text-text-light tracking-[0.08em]">
            — Lda. Silvana López
          </span>
        </div>
      </div>
    </section>
  );
}
