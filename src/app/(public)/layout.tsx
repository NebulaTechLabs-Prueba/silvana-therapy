import Script from 'next/script';

/**
 * Public layout — inyecta el beacon de Cloudflare Web Analytics.
 *
 * Solo se aplica al grupo `(public)` (home, services, booking, confirmation,
 * error). El panel admin queda fuera, así no contamos las visitas de Silvana
 * al panel como tráfico real del sitio.
 *
 * El beacon token es público (va en el HTML); se expone vía
 * NEXT_PUBLIC_CF_BEACON_TOKEN. Si falta, el script no se inyecta.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const beaconToken = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

  return (
    <>
      {children}
      {beaconToken && (
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          strategy="afterInteractive"
          data-cf-beacon={JSON.stringify({ token: beaconToken })}
        />
      )}
    </>
  );
}
