import Link from 'next/link';

interface PlaceholderRouteProps {
  title: string;
  routeName: string;
  referenceFile: string;
  description: string;
}

/**
 * PlaceholderRoute
 * ─────────────────────────────────────────────────────────────
 * Temporary component for public routes pending React port.
 * Each route has its approved design saved as a static HTML in
 * `/public/design-reference/` so we can view it pixel-perfect
 * while building the React version.
 *
 * Delete this component once all routes are ported.
 */
export default function PlaceholderRoute({
  title,
  routeName,
  referenceFile,
  description,
}: PlaceholderRouteProps) {
  const referenceUrl = `/design-reference/${referenceFile}`;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#fdfcfa',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#ffffff',
          borderRadius: 16,
          padding: '2.5rem 2rem',
          border: '1px solid #e2ede2',
          boxShadow: '0 4px 24px rgba(74, 122, 74, 0.06)',
        }}
      >
        {/* Status badge */}
        <div
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: 20,
            background: '#FFF8E1',
            color: '#F57F17',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '1.25rem',
          }}
        >
          Pendiente de portar
        </div>

        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 32,
            fontWeight: 400,
            color: '#2a3528',
            margin: '0 0 0.5rem',
            lineHeight: 1.15,
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: 13,
            color: '#849884',
            margin: '0 0 1.5rem',
            fontFamily: 'monospace',
          }}
        >
          {routeName}
        </p>

        <p
          style={{
            fontSize: 14,
            color: '#4e6050',
            lineHeight: 1.7,
            margin: '0 0 2rem',
            fontWeight: 300,
          }}
        >
          {description}
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a
            href={referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 20px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #4a7a4a 0%, #3a6a3a 100%)',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
              boxShadow: '0 2px 10px rgba(74, 122, 74, 0.25)',
            }}
          >
            Ver diseño aprobado
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="15 3 21 3 21 9" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>

          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 20px',
              borderRadius: 10,
              background: '#f0f5f0',
              color: '#4e6050',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
              border: '1px solid #c8ddc8',
            }}
          >
            ← Inicio
          </Link>
        </div>

        <div
          style={{
            marginTop: '2rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid #e2ede2',
            fontSize: 11,
            color: '#849884',
            letterSpacing: '0.02em',
          }}
        >
          Este placeholder se eliminará cuando esta ruta esté portada a React.
        </div>
      </div>
    </div>
  );
}
