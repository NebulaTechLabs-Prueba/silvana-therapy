import Link from 'next/link';
import Logo from '@/components/ui/Logo';

const FOOTER_LINKS = [
  { label: 'Sobre mí', href: '#liclopez' },
  { label: 'Trayectoria', href: '#perfil' },
  { label: 'Cómo funciona', href: '#terapia-online' },
  { label: 'Cuándo comenzar', href: '#cuando-comenzar' },
  { label: 'Contacto', href: '#contacto' },
];

export default function Footer() {
  return (
    <footer className="bg-text-dark text-[rgba(255,255,255,0.4)] px-[5vw] py-10 flex items-center justify-between text-[0.78rem] max-sm:flex-col max-sm:gap-6 max-sm:text-center">
      <div className="flex items-center gap-3.5">
        <Logo className="h-8 w-auto" inverted />
        <span className="font-serif text-[0.95rem] text-[rgba(255,255,255,0.7)]">
          Lda. Silvana López
        </span>
      </div>

      <ul className="flex gap-8 list-none max-sm:flex-wrap max-sm:justify-center max-sm:gap-4">
        {FOOTER_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-[rgba(255,255,255,0.4)] no-underline hover:text-[rgba(255,255,255,0.85)] transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <span>© 2025 · Espacio de Terapia a Distancia</span>
    </footer>
  );
}
