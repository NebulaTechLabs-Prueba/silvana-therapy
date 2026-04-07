import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lda. Silvana López — Psicoterapia Online',
  description:
    'Sesiones personalizadas y confidenciales desde el lugar más cómodo para ti. Tu bienestar, mi prioridad.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Lda. Silvana López — Psicoterapia Online',
    description:
      'Un espacio para comenzar a sentirte mejor. Primera consulta sin cargo.',
    type: 'website',
    locale: 'es_AR',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
