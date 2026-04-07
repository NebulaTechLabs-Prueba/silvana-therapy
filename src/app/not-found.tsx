'use client';

import Link from 'next/link';
import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';

const QUICK_LINKS = [
  { label: 'Inicio', href: '/' },
  { label: 'Servicios', href: '/services' },
  { label: 'Contacto', href: '/#contacto' },
];

export default function NotFound() {
  return (
    <>
      <Navbar />

      <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-cream">
        {/* Animated background blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div
            className="absolute animate-drift-1"
            style={{
              top: '10%',
              left: '15%',
              width: '420px',
              height: '420px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(74,122,74,0.08) 0%, transparent 70%)',
            }}
          />
          <div
            className="absolute animate-drift-2"
            style={{
              bottom: '8%',
              right: '10%',
              width: '360px',
              height: '360px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(226,237,226,0.5) 0%, transparent 70%)',
            }}
          />
          <div
            className="absolute animate-drift-3"
            style={{
              top: '55%',
              left: '60%',
              width: '280px',
              height: '280px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(74,122,74,0.05) 0%, transparent 70%)',
            }}
          />
        </div>

        {/* Content */}
        <section className="relative z-10 mx-auto max-w-xl px-6 py-32 text-center">
          {/* Decorative leaf SVG */}
          <div className="mx-auto mb-6 w-16 opacity-40 animate-fade-up">
            <svg
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
            >
              <path
                d="M32 4C32 4 12 20 12 38C12 49.05 20.95 58 32 58C43.05 58 52 49.05 52 38C52 20 32 4 32 4Z"
                fill="#e2ede2"
                stroke="#4a7a4a"
                strokeWidth="1.5"
              />
              <path
                d="M32 16V50"
                stroke="#4a7a4a"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <path
                d="M32 26C26 22 20 26 20 26"
                stroke="#4a7a4a"
                strokeWidth="1"
                strokeLinecap="round"
              />
              <path
                d="M32 34C38 30 44 34 44 34"
                stroke="#4a7a4a"
                strokeWidth="1"
                strokeLinecap="round"
              />
              <path
                d="M32 42C26 38 20 42 20 42"
                stroke="#4a7a4a"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* 404 number */}
          <h1
            className="font-serif font-light leading-none animate-fade-up-2"
            style={{
              fontSize: 'clamp(6rem, 15vw, 10rem)',
              background:
                'linear-gradient(180deg, #4a7a4a 0%, #c8ddc8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            404
          </h1>

          {/* Heading */}
          <h2 className="font-serif text-clamp-error font-light text-text-dark mt-4 mb-3 animate-fade-up-2">
            Página no encontrada
          </h2>

          {/* Subtext */}
          <p className="text-text-mid text-base leading-relaxed max-w-md mx-auto mb-10 animate-fade-up-3">
            Lo sentimos, la página que buscas no existe o fue movida.
          </p>

          {/* Quick links */}
          <nav
            aria-label="Enlaces rápidos"
            className="flex flex-wrap items-center justify-center gap-4 mb-8 animate-fade-up-3"
          >
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-green-pale px-5 py-2 text-sm text-text-mid transition-colors hover:border-green-deep hover:text-green-deep"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Primary CTA */}
          <div className="animate-fade-up-4">
            <Link
              href="/"
              className="inline-block rounded-full bg-green-deep px-8 py-3 text-sm font-medium text-white shadow-md transition-all hover:bg-[#3a6a3a] hover:-translate-y-0.5 hover:shadow-lg"
            >
              Volver al inicio
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
