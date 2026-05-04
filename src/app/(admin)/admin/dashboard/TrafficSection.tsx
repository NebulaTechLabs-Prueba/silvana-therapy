'use client';

import { useEffect, useState, useMemo, type CSSProperties } from 'react';
import { getTrafficData } from '@/lib/actions/traffic';
import type { TrafficSnapshot } from '@/lib/adapters/cloudflare-analytics';

type ThemeTokens = {
  dm: boolean;
  CARD: CSSProperties;
  txMain: string;
  txSub: string;
  borderC: string;
  bgSub: string;
  btnS: CSSProperties;
};

type Props = ThemeTokens;

type State =
  | { kind: 'loading' }
  | { kind: 'unconfigured' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: TrafficSnapshot };

const POLL_MS = 5 * 60 * 1000; // refresca cada 5 min

export default function TrafficSection(props: Props) {
  const { dm, CARD, txMain, txSub, borderC, bgSub, btnS } = props;
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    const res = await getTrafficData();
    if (!res.success) {
      setState({ kind: 'error', message: res.error });
    } else if (!res.configured) {
      setState({ kind: 'unconfigured' });
    } else {
      setState({ kind: 'ready', data: res.data });
    }
    setRefreshing(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.kind === 'loading') {
    return (
      <div style={{ animation: 'slideIn .3s' }}>
        <Header dm={dm} txMain={txMain} txSub={txSub} subtitle="Cargando datos…" onRefresh={load} refreshing={refreshing} btnS={btnS} />
        <div style={{ ...CARD, padding: 40, textAlign: 'center', color: txSub, fontSize: 13 }}>
          Consultando Cloudflare…
        </div>
      </div>
    );
  }

  if (state.kind === 'unconfigured') {
    return (
      <div style={{ animation: 'slideIn .3s' }}>
        <Header dm={dm} txMain={txMain} txSub={txSub} subtitle="Aún no configurado" onRefresh={load} refreshing={refreshing} btnS={btnS} />
        <div style={{ ...CARD, padding: 28 }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 18, fontWeight: 400, margin: '0 0 10px', color: txMain }}>
            Cloudflare Web Analytics aún no está conectado
          </h3>
          <p style={{ color: txSub, fontSize: 13, lineHeight: 1.6, margin: '0 0 14px' }}>
            Para ver el tráfico del sitio aquí, agrega las variables de entorno{' '}
            <code style={{ background: bgSub, padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>CLOUDFLARE_API_TOKEN</code>,{' '}
            <code style={{ background: bgSub, padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>CLOUDFLARE_ACCOUNT_ID</code> y{' '}
            <code style={{ background: bgSub, padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>CLOUDFLARE_WEB_ANALYTICS_SITE_TAG</code>{' '}
            en el servidor.
          </p>
          <p style={{ color: txSub, fontSize: 12, margin: 0 }}>
            Una vez configurado, los datos aparecerán automáticamente. La recolección puede tardar unos minutos en mostrar las primeras visitas.
          </p>
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div style={{ animation: 'slideIn .3s' }}>
        <Header dm={dm} txMain={txMain} txSub={txSub} subtitle="Error" onRefresh={load} refreshing={refreshing} btnS={btnS} />
        <div style={{ ...CARD, padding: 22, borderColor: '#c0504d', background: dm ? '#2a1a1a' : '#fff5f5' }}>
          <div style={{ color: '#c0504d', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>No se pudo consultar Cloudflare</div>
          <div style={{ color: txSub, fontSize: 12 }}>{state.message}</div>
        </div>
      </div>
    );
  }

  const { data } = state;
  const noData = data.totals30d.pageviews === 0;

  return (
    <div style={{ animation: 'slideIn .3s' }}>
      <Header
        dm={dm}
        txMain={txMain}
        txSub={txSub}
        subtitle={`Últimos 30 días · ${data.range.start} → ${data.range.end}`}
        onRefresh={load}
        refreshing={refreshing}
        btnS={btnS}
      />

      {/* Tarjetas de totales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 22 }}>
        <StatCard label="Visitas (24h)" value={data.totals24h.visits} sub={`${data.totals24h.pageviews} pageviews`} gradient="linear-gradient(135deg,#5a82b0,#3a6b9f)" CARD={CARD} txSub={txSub} />
        <StatCard label="Visitas (7d)" value={data.totals7d.visits} sub={`${data.totals7d.pageviews} pageviews`} gradient="linear-gradient(135deg,#4a7a4a,#3a6a3a)" CARD={CARD} txSub={txSub} />
        <StatCard label="Visitas (30d)" value={data.totals30d.visits} sub={`${data.totals30d.pageviews} pageviews`} gradient="linear-gradient(135deg,#8fb08f,#6a9a6a)" CARD={CARD} txSub={txSub} />
        <StatCard label="Promedio diario" value={Math.round(data.totals30d.pageviews / 30)} sub="pageviews/día" gradient="linear-gradient(135deg,#c4956a,#b08050)" CARD={CARD} txSub={txSub} />
      </div>

      {/* Gráfico */}
      <div style={{ ...CARD, padding: 22, marginBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 17, fontWeight: 400, margin: 0, color: txMain }}>
            Pageviews por día
          </h3>
          <span style={{ fontSize: 11, color: txSub }}>últimos 30 días</span>
        </div>
        {noData ? (
          <EmptyChart txSub={txSub} />
        ) : (
          <LineChart series={data.series} dm={dm} txSub={txSub} />
        )}
      </div>

      {/* Top páginas + Países */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <ListCard
          title="Páginas más visitadas"
          rows={data.topPages.slice(0, 10).map((p) => ({ label: p.path, value: p.pageviews }))}
          emptyText="Sin datos todavía"
          CARD={CARD}
          txMain={txMain}
          txSub={txSub}
          borderC={borderC}
        />
        <ListCard
          title="Países"
          rows={data.topCountries.slice(0, 10).map((c) => ({ label: c.country, value: c.pageviews }))}
          emptyText="Sin datos todavía"
          CARD={CARD}
          txMain={txMain}
          txSub={txSub}
          borderC={borderC}
        />
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────

function Header({
  txMain, txSub, subtitle, onRefresh, refreshing, btnS,
}: {
  dm: boolean; txMain: string; txSub: string; subtitle: string;
  onRefresh: () => void; refreshing: boolean; btnS: CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
      <div>
        <p style={{ color: txSub, margin: 0, fontSize: 13, fontWeight: 300 }}>
          Visitas y páginas vistas del sitio público. <span style={{ color: txMain }}>{subtitle}</span>
        </p>
      </div>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        style={{ ...btnS, padding: '7px 14px', fontSize: 12, opacity: refreshing ? 0.6 : 1, cursor: refreshing ? 'wait' : 'pointer' }}
      >
        {refreshing ? 'Actualizando…' : 'Actualizar'}
      </button>
    </div>
  );
}

function StatCard({
  label, value, sub, gradient, CARD, txSub,
}: { label: string; value: number; sub: string; gradient: string; CARD: CSSProperties; txSub: string }) {
  return (
    <div style={{ ...CARD, padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 13 }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: gradient, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: txSub, fontWeight: 400, marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 300, fontFamily: "'Cormorant Garamond',Georgia,serif" }}>
          {value.toLocaleString()}
        </div>
        <div style={{ fontSize: 10.5, color: txSub, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function EmptyChart({ txSub }: { txSub: string }) {
  return (
    <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: txSub, fontSize: 13, textAlign: 'center', padding: 20 }}>
      Aún no se registran visitas. El beacon empezará a recolectar datos cuando alguien visite el sitio.
    </div>
  );
}

function LineChart({ series, dm, txSub }: { series: { date: string; pageviews: number; visits: number }[]; dm: boolean; txSub: string }) {
  // Normaliza: rellena días faltantes con 0 para los últimos 30 días
  const filled = useMemo(() => fillMissingDays(series, 30), [series]);

  const W = 800;
  const H = 180;
  const PAD = { top: 12, right: 8, bottom: 24, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const max = Math.max(1, ...filled.map((d) => d.pageviews));
  const niceMax = niceCeil(max);

  const xStep = innerW / Math.max(1, filled.length - 1);
  const points = filled.map((d, i) => ({
    x: PAD.left + i * xStep,
    y: PAD.top + innerH - (d.pageviews / niceMax) * innerH,
    date: d.date,
    pv: d.pageviews,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${PAD.top + innerH} L ${points[0].x.toFixed(1)} ${PAD.top + innerH} Z`;

  const yTicks = [0, niceMax / 2, niceMax];
  const xTickIdxs = [0, Math.floor(filled.length / 4), Math.floor(filled.length / 2), Math.floor((3 * filled.length) / 4), filled.length - 1];

  const lineColor = '#4a7a4a';
  const areaColor = dm ? 'rgba(74,122,74,.18)' : 'rgba(74,122,74,.12)';
  const gridColor = dm ? '#2a2a2a' : '#e2ede2';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}>
      {/* Grid */}
      {yTicks.map((t, i) => {
        const y = PAD.top + innerH - (t / niceMax) * innerH;
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke={gridColor} strokeWidth={1} strokeDasharray={i === 0 ? '0' : '3 3'} />
            <text x={PAD.left - 6} y={y + 3} fontSize="10" fill={txSub} textAnchor="end">{t}</text>
          </g>
        );
      })}

      {/* Area + line */}
      <path d={areaPath} fill={areaColor} />
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth={1.8} />

      {/* Points (only for non-zero values to avoid noise) */}
      {points.map((p, i) =>
        p.pv > 0 ? <circle key={i} cx={p.x} cy={p.y} r={2.8} fill={lineColor} /> : null,
      )}

      {/* X labels */}
      {xTickIdxs.map((idx, i) => {
        const p = points[idx];
        if (!p) return null;
        return (
          <text key={i} x={p.x} y={H - 6} fontSize="10" fill={txSub} textAnchor="middle">
            {formatDateShort(p.date)}
          </text>
        );
      })}
    </svg>
  );
}

function ListCard({
  title, rows, emptyText, CARD, txMain, txSub, borderC,
}: {
  title: string; rows: { label: string; value: number }[]; emptyText: string;
  CARD: CSSProperties; txMain: string; txSub: string; borderC: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ ...CARD, padding: 22 }}>
      <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 17, fontWeight: 400, margin: '0 0 14px', color: txMain }}>
        {title}
      </h3>
      {rows.length === 0 ? (
        <div style={{ color: txSub, fontSize: 13, padding: '18px 0' }}>{emptyText}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((r, i) => {
            const pct = (r.value / max) * 100;
            return (
              <div key={i} style={{ padding: '8px 0', borderBottom: i === rows.length - 1 ? 'none' : '1px solid ' + borderC }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
                  <span style={{ fontSize: 12.5, color: txMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                  <span style={{ fontSize: 12, color: txSub, flexShrink: 0, fontWeight: 500 }}>{r.value.toLocaleString()}</span>
                </div>
                <div style={{ height: 4, background: borderC, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: pct + '%', height: '100%', background: 'linear-gradient(90deg,#4a7a4a,#8fb08f)' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

function fillMissingDays(series: { date: string; pageviews: number; visits: number }[], days: number) {
  const map = new Map(series.map((s) => [s.date, s]));
  const out: { date: string; pageviews: number; visits: number }[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const ymd = d.toISOString().slice(0, 10);
    out.push(map.get(ymd) ?? { date: ymd, pageviews: 0, visits: 0 });
  }
  return out;
}

function niceCeil(n: number): number {
  if (n <= 5) return 5;
  if (n <= 10) return 10;
  if (n <= 20) return 20;
  if (n <= 50) return 50;
  if (n <= 100) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(n)));
  const mult = Math.ceil(n / exp);
  return mult * exp;
}

function formatDateShort(ymd: string): string {
  const [, m, d] = ymd.split('-');
  return `${d}/${m}`;
}
