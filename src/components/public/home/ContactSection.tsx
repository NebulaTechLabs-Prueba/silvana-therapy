import SectionEyebrow from '@/components/ui/SectionEyebrow';

export default function ContactSection() {
  return (
    <section
      id="contacto"
      className="bg-green-lightest border-t border-green-pale px-[5vw] py-24"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16 max-w-[900px]">
        {/* Contact info */}
        <div>
          <SectionEyebrow>Contacto</SectionEyebrow>
          <h2 className="font-serif text-clamp-section font-light leading-[1.2] text-text-dark mb-4">
            Estoy aquí
            <br />
            <em className="italic text-green-deep">para ayudarte</em>
          </h2>
          <p className="text-[0.95rem] text-text-mid max-w-[480px] mb-8">
            Escríbeme, a la brevedad estaré en contacto contigo.
          </p>

          {/* WhatsApp */}
          <div className="flex gap-4 items-start mb-6">
            <div className="w-10 h-10 rounded-xl bg-white border border-green-pale flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px] text-green-deep">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h4 className="text-[0.72rem] tracking-[0.1em] uppercase text-text-light mb-0.5">
                WhatsApp
              </h4>
              <a
                href="https://api.whatsapp.com/send/?phone=17543080643"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[0.9rem] text-text-dark no-underline hover:text-green-deep transition-colors"
              >
                +1 754 308 0643
              </a>
              <p className="text-[0.75rem] text-text-light">Solo mensajes</p>
            </div>
          </div>

          {/* Email */}
          <div className="flex gap-4 items-start mb-6">
            <div className="w-10 h-10 rounded-xl bg-white border border-green-pale flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px] text-green-deep">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="22,6 12,13 2,6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h4 className="text-[0.72rem] tracking-[0.1em] uppercase text-text-light mb-0.5">
                Email
              </h4>
              <a
                href="mailto:consultas@silvanalopez.com"
                className="text-[0.9rem] text-text-dark no-underline hover:text-green-deep transition-colors"
              >
                consultas@silvanalopez.com
              </a>
            </div>
          </div>

          {/* Calendar */}
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-white border border-green-pale flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px] text-green-deep">
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h4 className="text-[0.72rem] tracking-[0.1em] uppercase text-text-light mb-0.5">
                Agenda online
              </h4>
              <a
                href="/services"
                className="text-[0.9rem] text-text-dark no-underline hover:text-green-deep transition-colors"
              >
                Reservar cita →
              </a>
            </div>
          </div>
        </div>

        {/* Payment methods */}
        <div>
          <div className="bg-white border border-green-pale rounded-2xl p-6 mt-12 md:mt-0">
            <h4 className="text-[0.72rem] tracking-[0.1em] uppercase text-text-light mb-4">
              Medios de pago
            </h4>
            <div className="flex items-center gap-3.5 text-[0.85rem] text-text-mid mb-3">
              <img src="/images/paypal-logo.svg" alt="PayPal" className="h-7 w-auto shrink-0" />
              <span className="text-[0.8rem] text-text-light">Valor de sesión + 10%</span>
            </div>
            <div className="flex items-center gap-3.5 text-[0.85rem] text-text-mid">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7 text-text-mid shrink-0">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              <span className="text-[0.8rem] text-text-light">Stripe · Valor estándar de sesión</span>
            </div>
          </div>

          <div className="mt-8 bg-white border border-green-pale rounded-2xl p-7">
            <p className="font-serif text-[1rem] italic text-text-mid leading-relaxed">
              &ldquo;Puedo ayudarte estés donde estés.&rdquo;
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
