'use client';

import { useEffect, useState } from 'react';

/**
 * Breakpoint tokens para el dashboard admin.
 *
 * El panel admin fue diseñado originalmente para laptop 1440px+. Estos
 * breakpoints se usan en los componentes del admin para adaptar layouts
 * a pantallas menores sin migrar todo a Tailwind (que es otro refactor).
 *
 * Mobile/tablet-first se decidió NO aplicar porque cambiar el layout
 * default podría romper la intuición desktop de Silvana. En su lugar
 * usamos estos helpers en cada componente que lo necesita.
 */
export const BP = {
  sm: 640,   // teléfono grande / phablet
  md: 768,   // tablet portrait
  lg: 1024,  // tablet landscape
  xl: 1280,  // laptop pequeña (donde empiezan los primeros recortes visuales)
  xxl: 1536, // laptop grande / desktop
} as const;

export type Breakpoint = keyof typeof BP;

interface Match {
  /** Ancho actual del viewport, 0 en SSR. */
  width: number;
  /** true si el viewport es < breakpoint dado. Ej. `isBelow.lg === true` en < 1024px. */
  isBelow: Record<Breakpoint, boolean>;
  /** true si el viewport es >= breakpoint dado. */
  isAtLeast: Record<Breakpoint, boolean>;
  /** Nombre del breakpoint activo: el más grande cuya width ≤ viewport. */
  current: Breakpoint | 'xs';
}

function computeMatch(width: number): Match {
  const isBelow: Record<Breakpoint, boolean> = {
    sm: width < BP.sm,
    md: width < BP.md,
    lg: width < BP.lg,
    xl: width < BP.xl,
    xxl: width < BP.xxl,
  };
  const isAtLeast: Record<Breakpoint, boolean> = {
    sm: width >= BP.sm,
    md: width >= BP.md,
    lg: width >= BP.lg,
    xl: width >= BP.xl,
    xxl: width >= BP.xxl,
  };
  let current: Breakpoint | 'xs' = 'xs';
  if (isAtLeast.xxl) current = 'xxl';
  else if (isAtLeast.xl) current = 'xl';
  else if (isAtLeast.lg) current = 'lg';
  else if (isAtLeast.md) current = 'md';
  else if (isAtLeast.sm) current = 'sm';
  return { width, isBelow, isAtLeast, current };
}

/**
 * Hook que retorna info del breakpoint actual del viewport. SSR-safe:
 * en el primer render retorna `width=0` / todos los breakpoints "desktop"
 * como true, para evitar flash de layout móvil en clientes desktop. El
 * valor real se actualiza tras el mount.
 */
export function useBreakpoint(): Match {
  // En SSR y primer render asumimos desktop (width = BP.xxl). Evita que
  // el markup inicial tenga el layout móvil en clientes desktop, cosa que
  // genera un flash desagradable. El useEffect lo corrige al montar.
  const [match, setMatch] = useState<Match>(() => computeMatch(BP.xxl));

  useEffect(() => {
    const update = () => setMatch(computeMatch(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return match;
}
