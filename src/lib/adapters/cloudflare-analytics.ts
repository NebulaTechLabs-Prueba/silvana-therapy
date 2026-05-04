/**
 * Cloudflare Web Analytics adapter (GraphQL Analytics API).
 *
 * Datos: dataset `rumPageloadEventsAdaptiveGroups` (Real User Monitoring).
 * Auth: Bearer API token con scope `Account Analytics: Read`.
 * Filtros: bot=0 para excluir bots; siteTag identifica el sitio en CF.
 *
 * Si faltan credenciales (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID,
 * CLOUDFLARE_WEB_ANALYTICS_SITE_TAG), las funciones devuelven null para
 * que la UI muestre un empty state en lugar de romper.
 */
const CF_GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

type CfConfig = {
  apiToken: string;
  accountTag: string;
  siteTag: string;
};

function readConfig(): CfConfig | null {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountTag = process.env.CLOUDFLARE_ACCOUNT_ID;
  const siteTag = process.env.CLOUDFLARE_WEB_ANALYTICS_SITE_TAG;
  if (!apiToken || !accountTag || !siteTag) return null;
  return { apiToken, accountTag, siteTag };
}

export function isCloudflareConfigured(): boolean {
  return readConfig() !== null;
}

async function gqlRequest<T>(query: string, variables: Record<string, unknown>, apiToken: string): Promise<T> {
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(CF_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
      signal: ctl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Cloudflare GraphQL ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (json.errors && json.errors.length > 0) {
      throw new Error(`Cloudflare GraphQL: ${json.errors.map((e) => e.message).join('; ')}`);
    }
    if (!json.data) throw new Error('Cloudflare GraphQL: respuesta vacía');
    return json.data;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Query: totales (visits + pageviews) en un rango ──────────

const TOTALS_QUERY = /* GraphQL */ `
  query Totals($accountTag: string!, $siteTag: string!, $start: string!, $end: string!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        totals: rumPageloadEventsAdaptiveGroups(
          limit: 1
          filter: { siteTag: $siteTag, date_geq: $start, date_leq: $end, bot: 0 }
        ) {
          count
          sum { visits }
        }
      }
    }
  }
`;

type TotalsResponse = {
  viewer: {
    accounts: Array<{
      totals: Array<{ count: number; sum: { visits: number } }>;
    }>;
  };
};

// ─── Query: serie temporal diaria ─────────────────────────────

const TIMESERIES_QUERY = /* GraphQL */ `
  query Timeseries($accountTag: string!, $siteTag: string!, $start: string!, $end: string!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        series: rumPageloadEventsAdaptiveGroups(
          limit: 1000
          filter: { siteTag: $siteTag, date_geq: $start, date_leq: $end, bot: 0 }
          orderBy: [date_ASC]
        ) {
          dimensions { date }
          count
          sum { visits }
        }
      }
    }
  }
`;

type TimeseriesResponse = {
  viewer: {
    accounts: Array<{
      series: Array<{ dimensions: { date: string }; count: number; sum: { visits: number } }>;
    }>;
  };
};

// ─── Query: top páginas por pageviews ─────────────────────────

// El nombre del campo "URL path" en el schema RUM de Cloudflare cambia
// entre versiones. Probamos candidatos en una sola query a la vez —
// ante "unknown field" cacheamos el descarte y pasamos al siguiente.
// Con un descarte cacheado evitamos repetir queries que sabemos que fallan.
const PATH_FIELD_CANDIDATES = ['pagePath', 'pathName', 'metricName', 'requestPath'] as const;
let cachedPathField: string | null = null;
const failedPathCandidates = new Set<string>();

function buildTopPagesQuery(pathField: string): string {
  return /* GraphQL */ `
    query TopPages($accountTag: string!, $siteTag: string!, $start: string!, $end: string!, $limit: int!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          pages: rumPageloadEventsAdaptiveGroups(
            limit: $limit
            filter: { siteTag: $siteTag, date_geq: $start, date_leq: $end, bot: 0 }
            orderBy: [count_DESC]
          ) {
            dimensions { ${pathField} }
            count
            sum { visits }
          }
        }
      }
    }
  `;
}

type TopPagesResponse = {
  viewer: {
    accounts: Array<{
      pages: Array<{ dimensions: Record<string, string>; count: number; sum: { visits: number } }>;
    }>;
  };
};

/**
 * Lanza la query de top pages probando candidatos uno a uno. Cuando uno
 * funciona, lo cachea para futuras llamadas. Si todos fallan con "unknown
 * field", devuelve null para que la UI muestre la sección como "no
 * soportada" sin romper el resto del dashboard.
 */
async function fetchTopPagesWithDiscovery(
  cfg: CfConfig,
  start: string,
  end: string,
): Promise<{ pathField: string; data: TopPagesResponse } | null> {
  const candidates = cachedPathField ? [cachedPathField] : PATH_FIELD_CANDIDATES;
  for (const candidate of candidates) {
    if (failedPathCandidates.has(candidate)) continue;
    try {
      const data = await gqlRequest<TopPagesResponse>(
        buildTopPagesQuery(candidate),
        { accountTag: cfg.accountTag, siteTag: cfg.siteTag, start, end, limit: 10 },
        cfg.apiToken,
      );
      cachedPathField = candidate;
      return { pathField: candidate, data };
    } catch (e) {
      const msg = (e as Error).message || '';
      if (msg.includes('unknown field') || msg.includes('Unknown field')) {
        failedPathCandidates.add(candidate);
        continue;
      }
      throw e; // network / auth / etc — propagar
    }
  }
  return null;
}

// ─── Query: por país ──────────────────────────────────────────

const BY_COUNTRY_QUERY = /* GraphQL */ `
  query ByCountry($accountTag: string!, $siteTag: string!, $start: string!, $end: string!, $limit: int!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        countries: rumPageloadEventsAdaptiveGroups(
          limit: $limit
          filter: { siteTag: $siteTag, date_geq: $start, date_leq: $end, bot: 0 }
          orderBy: [count_DESC]
        ) {
          dimensions { countryName }
          count
        }
      }
    }
  }
`;

type ByCountryResponse = {
  viewer: {
    accounts: Array<{
      countries: Array<{ dimensions: { countryName: string }; count: number }>;
    }>;
  };
};

// ─── Public types ─────────────────────────────────────────────

export type TrafficTotals = { pageviews: number; visits: number };
export type TrafficDayPoint = { date: string; pageviews: number; visits: number };
export type TrafficPage = { path: string; pageviews: number; visits: number };
export type TrafficCountry = { country: string; pageviews: number };

export type TrafficSnapshot = {
  range: { start: string; end: string };
  totals: TrafficTotals;
  totals24h: TrafficTotals;
  totals7d: TrafficTotals;
  totals30d: TrafficTotals;
  series: TrafficDayPoint[];
  topPages: TrafficPage[];
  topCountries: TrafficCountry[];
};

// ─── Date helpers (UTC, ISO YYYY-MM-DD) ───────────────────────

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ─── Public API ───────────────────────────────────────────────

async function fetchTotals(cfg: CfConfig, start: string, end: string): Promise<TrafficTotals> {
  const data = await gqlRequest<TotalsResponse>(
    TOTALS_QUERY,
    { accountTag: cfg.accountTag, siteTag: cfg.siteTag, start, end },
    cfg.apiToken,
  );
  const row = data.viewer.accounts[0]?.totals[0];
  return {
    pageviews: row?.count ?? 0,
    visits: row?.sum.visits ?? 0,
  };
}

/**
 * Snapshot completo: 30 días de serie + top páginas + top países +
 * subtotales 24h/7d/30d. Las queries corren en paralelo con
 * `Promise.allSettled` — si una falla (timeout, schema mismatch, etc.)
 * el resto sigue mostrándose. Logs de las que fallan para debug.
 */
export async function getTrafficSnapshot(): Promise<TrafficSnapshot | null> {
  const cfg = readConfig();
  if (!cfg) return null;

  const today = ymd(todayUtc());
  const day1 = ymd(daysAgo(1));
  const day7 = ymd(daysAgo(7));
  const day30 = ymd(daysAgo(30));

  const results = await Promise.allSettled([
    fetchTotals(cfg, day30, today),
    fetchTotals(cfg, day7, today),
    fetchTotals(cfg, day1, today),
    gqlRequest<TimeseriesResponse>(
      TIMESERIES_QUERY,
      { accountTag: cfg.accountTag, siteTag: cfg.siteTag, start: day30, end: today },
      cfg.apiToken,
    ),
    fetchTopPagesWithDiscovery(cfg, day30, today),
    gqlRequest<ByCountryResponse>(
      BY_COUNTRY_QUERY,
      { accountTag: cfg.accountTag, siteTag: cfg.siteTag, start: day30, end: today, limit: 10 },
      cfg.apiToken,
    ),
  ]);

  const [totals30dR, totals7dR, totals24hR, seriesR, pagesR, countriesR] = results;

  // Si TODAS las queries fallaron, propagamos el primer error — no
  // queremos mostrar una sección vacía cuando en realidad CF está rota.
  if (results.every((r) => r.status === 'rejected')) {
    const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    throw first.reason;
  }

  const totals30d = totals30dR.status === 'fulfilled' ? totals30dR.value : { pageviews: 0, visits: 0 };
  const totals7d = totals7dR.status === 'fulfilled' ? totals7dR.value : { pageviews: 0, visits: 0 };
  const totals24h = totals24hR.status === 'fulfilled' ? totals24hR.value : { pageviews: 0, visits: 0 };

  let series: TrafficDayPoint[] = [];
  if (seriesR.status === 'fulfilled') {
    const rows = seriesR.value.viewer.accounts[0]?.series ?? [];
    series = rows.map((r) => ({ date: r.dimensions.date, pageviews: r.count, visits: r.sum.visits }));
  } else {
    console.warn('[cloudflare-analytics] series query failed:', seriesR.reason);
  }

  let topPages: TrafficPage[] = [];
  if (pagesR.status === 'fulfilled' && pagesR.value) {
    const { pathField, data } = pagesR.value;
    const rows = data.viewer.accounts[0]?.pages ?? [];
    topPages = rows.map((r) => ({
      path: (r.dimensions as Record<string, string>)[pathField] || '/',
      pageviews: r.count,
      visits: r.sum.visits,
    }));
  } else if (pagesR.status === 'rejected') {
    console.warn('[cloudflare-analytics] topPages query failed:', pagesR.reason);
  }
  // pagesR fulfilled con value=null = todos los candidatos fallaron con
  // "unknown field". UI muestra "Sin datos todavía" — no es un error de red.

  let topCountries: TrafficCountry[] = [];
  if (countriesR.status === 'fulfilled') {
    const rows = countriesR.value.viewer.accounts[0]?.countries ?? [];
    topCountries = rows
      .filter((r) => r.dimensions.countryName && r.dimensions.countryName !== 'XX')
      .map((r) => ({ country: r.dimensions.countryName, pageviews: r.count }));
  } else {
    console.warn('[cloudflare-analytics] countries query failed:', countriesR.reason);
  }

  return {
    range: { start: day30, end: today },
    totals: totals30d,
    totals30d,
    totals7d,
    totals24h,
    series,
    topPages,
    topCountries,
  };
}
