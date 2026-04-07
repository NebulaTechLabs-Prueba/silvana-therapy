'use client';

import Link from 'next/link';
import Logo from '@/components/ui/Logo';

const NAV_LINKS = [
  { label: 'Sobre mí', href: '/#liclopez' },
  { label: 'Cómo funciona', href: '/#terapia-online' },
  { label: 'Beneficios', href: '/#beneficios' },
  { label: 'Cuándo comenzar', href: '/#cuando-comenzar' },
  { label: 'Trayectoria', href: '/#perfil' },
];

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between px-[5vw] py-4 bg-[rgba(253,252,250,0.95)] backdrop-blur-[14px] border-b border-green-pale">
      <Link href="/" className="flex items-center gap-3.5 no-underline">
        <Logo />
        <span className="font-serif text-[1.05rem] font-normal text-text-dark">
          Lda. <span className="italic text-green-deep">Silvana López</span>
        </span>
      </Link>

      <ul className="flex items-center gap-8 list-none max-xl:gap-5 max-lg:gap-3">
        {NAV_LINKS.map((link) => (
          <li key={link.href} className="max-lg:hidden">
            <Link
              href={link.href}
              className="text-[0.73rem] max-xl:text-[0.65rem] font-normal tracking-[0.12em] uppercase text-text-mid no-underline transition-colors duration-200 hover:text-green-deep whitespace-nowrap"
            >
              {link.label}
            </Link>
          </li>
        ))}
        <li className="shrink-0">
          <Link
            href="/services"
            className="bg-green-deep text-[#fff] px-5 py-2 rounded-full text-[0.73rem] max-xl:text-[0.65rem] font-normal tracking-[0.10em] uppercase no-underline transition-colors duration-200 hover:bg-text-dark whitespace-nowrap"
          >
            Reserva Ahora
          </Link>
        </li>
      </ul>
    </nav>
  );
}
