export default function HomePage() {
  return (
    <main className="min-h-screen bg-cream-50">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <p className="font-sans text-sm uppercase tracking-widest text-brand-500">
          Psicoterapia Online
        </p>
        <h1 className="mt-4 font-serif text-5xl font-light leading-tight text-gray-900 md:text-6xl">
          Un espacio para
          <br />
          <em className="text-brand-500">comenzar a sentirte</em>
          <br />
          mejor
        </h1>
        <p className="mt-6 max-w-lg font-sans text-lg text-gray-600">
          Sesiones personalizadas y confidenciales desde el lugar más cómodo
          para ti. Tu bienestar, mi prioridad.
        </p>
        <div className="mt-8 flex gap-4">
          <a
            href="/reservar"
            className="inline-flex items-center rounded-full bg-brand-500 px-6 py-3 font-sans text-sm font-medium text-white transition hover:bg-brand-600"
          >
            Primera cita gratuita
          </a>
          <a
            href="#sobre-mi"
            className="inline-flex items-center rounded-full border border-gray-300 px-6 py-3 font-sans text-sm font-medium text-gray-700 transition hover:border-brand-500"
          >
            Conocer más
          </a>
        </div>
      </div>
    </main>
  );
}
