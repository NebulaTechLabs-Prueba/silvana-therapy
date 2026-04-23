'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { escapeHtml } from '@/lib/utils/escapeHtml';
import { getClientTime, convertTime, tzShortLabel, BASE_TZ } from '@/lib/utils/timezone';

const DAYS_F = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTHS_F = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

interface BookingData {
  code: string;
  service: { title: string; price: string; duration: string };
  form: { nombre: string; apellido: string; email: string; tel?: string; pais?: string };
  date: string;
  time: string;
}

interface Props {
  /** TZ configurada por Silvana para mostrar al visitante. Default Miami. */
  formTz?: string;
}

export default function ConfirmationClient({ formTz = BASE_TZ }: Props) {
  const [data, setData] = useState<BookingData | null>(null);
  const formTzLabel = tzShortLabel(formTz);
  const formTzIsBase = formTz === BASE_TZ;

  useEffect(() => {
    const code = sessionStorage.getItem('sl_code') || 'SL-000000';
    const service = JSON.parse(sessionStorage.getItem('sl_service') || '{"title":"Primera Consulta","price":"Gratis","duration":"30 min"}');
    const form = JSON.parse(sessionStorage.getItem('sl_form') || '{"nombre":"","apellido":"","email":""}');
    const date = sessionStorage.getItem('sl_date') || '';
    const time = sessionStorage.getItem('sl_time') || '';
    setData({ code, service, form, date, time });
  }, []);

  if (!data) return null;

  const dateObj = data.date ? new Date(data.date + 'T12:00:00') : null;
  const dateStr = dateObj
    ? `${DAYS_F[dateObj.getDay()]}, ${dateObj.getDate()} de ${MONTHS_F[dateObj.getMonth()]} ${dateObj.getFullYear()}`
    : '—';

  // Use client's local time for calendar exports (hora estado), fall back to Miami time
  const clientTime = data?.date && data?.time && data?.form?.pais && data.form.pais !== 'Florida' && data.form.pais !== 'Otro'
    ? getClientTime(data.date, data.time, data.form.pais) || data.time
    : data?.time || '';

  // Google Calendar link
  function getGCalUrl() {
    if (!data?.date || !clientTime) return '#';
    const start = data.date.replace(/-/g, '') + 'T' + clientTime.replace(':', '') + '00';
    const [h, m] = clientTime.split(':').map(Number);
    const durMin = parseInt(data.service.duration) || 50;
    const endMin = h * 60 + m + durMin;
    const end = data.date.replace(/-/g, '') + 'T' + String(Math.floor(endMin / 60)).padStart(2, '0') + String(endMin % 60).padStart(2, '0') + '00';
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Sesión — Lda. Silvana López')}&dates=${start}/${end}&details=${encodeURIComponent('Sesión de terapia online')}&location=Online`;
  }

  return (
    <div className="max-w-[620px] mx-auto px-[5vw] pt-36 pb-24">
      {/* Checkmark */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-[72px] h-[72px] bg-green-deep rounded-full flex items-center justify-center animate-pop-in mb-5">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" className="w-8 h-8">
            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <span className="inline-block bg-green-lightest border border-green-pale rounded-full py-1 px-4 text-[0.72rem] tracking-[0.1em] uppercase text-green-deep font-medium mb-4">
          {data.code}
        </span>

        <h1 className="font-serif text-clamp-conf font-light text-text-dark mb-2">
          ¡Solicitud recibida!
        </h1>
        <p className="text-[0.9rem] text-text-mid">
          Silvana revisará tu solicitud y te enviará la confirmación por correo en breve. Guarda este comprobante como respaldo.
        </p>
      </div>

      {/* Details card */}
      <div className="bg-green-lightest border border-green-pale rounded-2xl p-8 mb-5">
        <Row label="Servicio" value={data.service.title} />
        <Row label="Profesional" value="Lda. Silvana López" />
        <Row label="Fecha" value={dateStr} />
        <Row label={`Hora ${formTzLabel}`} value={data.time ? `${(formTzIsBase ? data.time : convertTime(data.date, data.time, BASE_TZ, formTz))} hs` : '—'} />
        {data.form.pais && data.form.pais !== 'Florida' && data.form.pais !== 'Otro' && data.date && data.time && (() => {
          const localT = getClientTime(data.date, data.time, data.form.pais!);
          return localT ? <Row label={`Hora ${data.form.pais}`} value={`${localT} hs`} /> : null;
        })()}
        {data.form.pais === 'Florida' && data.time && formTzIsBase && (
          <Row label="Zona horaria" value="Miami, FL (misma zona)" />
        )}
        <Row label="Duración" value={data.service.duration} />
        <Row label="Modalidad" value="Online · Videollamada" />
        <Row
          label="Precio"
          value={data.service.price === 'Gratis' ? 'Gratis' : data.service.price}
          highlight
        />
        {data.form.nombre && (
          <Row label="Paciente" value={`${data.form.nombre} ${data.form.apellido}`} />
        )}
      </div>

      {/* Calendar & download buttons */}
      <div className="bg-[#fff] border border-green-pale rounded-2xl p-6 mb-5">
        <p className="text-[0.72rem] tracking-[0.1em] uppercase text-text-light mb-4 text-center">
          Agrega la cita a tu calendario
        </p>
        <div className="flex gap-3 max-sm:flex-col">
          <a
            href={getGCalUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-green-pale rounded-xl text-[0.82rem] text-text-mid no-underline transition-all hover:border-green-deep hover:bg-green-lightest"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-[18px] h-[18px] text-green-deep">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Google Calendar
          </a>
          <button
            onClick={() => {
              if (!data?.date || !clientTime) return;
              const [h, m] = clientTime.split(':').map(Number);
              const durMin = parseInt(data.service.duration) || 50;
              const startDt = data.date.replace(/-/g, '') + 'T' + clientTime.replace(':', '') + '00';
              const endMin = h * 60 + m + durMin;
              const endDt = data.date.replace(/-/g, '') + 'T' + String(Math.floor(endMin / 60)).padStart(2, '0') + String(endMin % 60).padStart(2, '0') + '00';
              const ics = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Silvana Lopez//Booking//ES',
                'BEGIN:VEVENT',
                `DTSTART:${startDt}`,
                `DTEND:${endDt}`,
                'SUMMARY:Sesión — Lda. Silvana López',
                'DESCRIPTION:Sesión de terapia online',
                'LOCATION:Online',
                'END:VEVENT',
                'END:VCALENDAR',
              ].join('\r\n');
              const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'cita-silvana-lopez.ics';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-green-pale rounded-xl text-[0.82rem] text-text-mid cursor-pointer bg-transparent transition-all hover:border-green-deep hover:bg-green-lightest"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-[18px] h-[18px] text-green-deep">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Descargar iCal
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-green-pale">
          <p className="text-[0.72rem] tracking-[0.1em] uppercase text-text-light mb-3 text-center">
            Descarga tu confirmación
          </p>
          <button
            onClick={() => {
              const e = escapeHtml;
              const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Confirmación — ${e(data.code)}</title>
              <style>
              *{margin:0;padding:0;box-sizing:border-box}
              body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:#f7faf7;color:#2a3528;padding:0;min-height:100vh;display:flex;align-items:center;justify-content:center}
              .wrap{max-width:540px;width:100%;margin:40px auto}
              .header{background:#2a3528;border-radius:16px 16px 0 0;padding:28px 36px;text-align:center}
              .header .logo{font-family:Georgia,serif;font-size:22px;color:#c8ddc8;font-weight:400;font-style:italic;margin-bottom:2px}
              .header .sub{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(200,221,200,.5)}
              .body{background:#fff;padding:32px 36px;border-left:1px solid #e2ede2;border-right:1px solid #e2ede2}
              .code-wrap{text-align:center;margin-bottom:24px}
              .code{display:inline-block;background:#f0f5f0;border:1.5px solid #c8ddc8;border-radius:24px;padding:6px 20px;font-size:11px;letter-spacing:2px;color:#4a7a4a;font-weight:700;text-transform:uppercase}
              .check{width:48px;height:48px;background:#4a7a4a;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center}
              .check svg{width:24px;height:24px}
              h1{text-align:center;font-family:Georgia,serif;font-size:20px;font-weight:400;color:#2a3528;margin-bottom:24px}
              .details{background:#f7faf7;border:1px solid #e2ede2;border-radius:12px;padding:20px 24px;margin-bottom:20px}
              .row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #e8f0e8;font-size:13px}
              .row:last-child{border-bottom:none}
              .row .l{color:#849884;font-weight:400}
              .row .v{color:#2a3528;font-weight:500;text-align:right}
              .row.hl .v{color:#4a7a4a;font-size:15px;font-weight:600;font-family:Georgia,serif}
              .patient{background:#f0f5f0;border-radius:10px;padding:14px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;font-size:13px}
              .patient .l{color:#849884}.patient .v{color:#2a3528;font-weight:600}
              .footer{background:#f7faf7;border-radius:0 0 16px 16px;border:1px solid #e2ede2;border-top:none;padding:20px 36px;text-align:center}
              .footer p{font-size:11px;color:#849884;line-height:1.6}
              .footer strong{color:#4a7a4a}
              @media print{body{background:#fff;padding:0}.wrap{margin:0}.header{border-radius:0}.footer{border-radius:0}}</style></head>
              <body><div class="wrap">
              <div class="header">
                <div class="logo">Lda. Silvana López</div>
                <div class="sub">Psicoterapia Online</div>
              </div>
              <div class="body">
                <div style="text-align:center;margin-bottom:20px">
                  <div class="check"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
                  <div class="code-wrap"><span class="code">${e(data.code)}</span></div>
                  <h1>Confirmación de cita</h1>
                </div>
                <div class="details">
                  <div class="row"><span class="l">Servicio</span><span class="v">${e(data.service.title)}</span></div>
                  <div class="row"><span class="l">Profesional</span><span class="v">Lda. Silvana López</span></div>
                  <div class="row"><span class="l">Fecha</span><span class="v">${e(dateStr)}</span></div>
                  <div class="row"><span class="l">Hora</span><span class="v">${e(data.time)} hs</span></div>
                  <div class="row"><span class="l">Duración</span><span class="v">${e(data.service.duration)}</span></div>
                  <div class="row"><span class="l">Modalidad</span><span class="v">Online · Videollamada</span></div>
                  <div class="row hl"><span class="l">Precio</span><span class="v">${data.service.price === 'Gratis' ? 'Gratis' : e(data.service.price)}</span></div>
                </div>
                ${data.form.nombre ? `<div class="patient"><span class="l">Paciente</span><span class="v">${e(data.form.nombre)} ${e(data.form.apellido)}</span></div>` : ''}
              </div>
              <div class="footer"><p>Este documento es tu comprobante de reserva.<br/>Conserva tu código: <strong>${e(data.code)}</strong></p></div>
              </div></body></html>`;
              const w = window.open('', '_blank');
              if (w) { w.document.write(html); w.document.close(); w.print(); }
            }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-deep text-[#fff] rounded-xl text-[0.82rem] font-normal tracking-[0.06em] transition-all hover:bg-text-dark cursor-pointer border-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-[18px] h-[18px]">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Descargar confirmación (PDF)
          </button>
        </div>
      </div>

      {/* Next steps */}
      <div className="bg-[#fff] border border-green-pale rounded-2xl p-8">
        <p className="text-[0.72rem] tracking-[0.1em] uppercase text-text-light mb-5">
          ¿Qué pasa ahora?
        </p>

        <div className="flex flex-col gap-5">
          <NextStep n={1} title="Guarda tu confirmación" desc="Descarga o imprime tu comprobante de reserva desde el botón de arriba. Es tu respaldo de la cita." />
          <div className="border-t border-green-pale" />
          <NextStep n={2} title="Te contactaremos" desc="Nos comunicaremos contigo por email o WhatsApp para coordinar los detalles y enviarte el enlace de videollamada." />
          <div className="border-t border-green-pale" />
          <NextStep n={3} title="Tu sesión" desc="Conéctate a la hora indicada desde cualquier dispositivo. Solo necesitás internet." />
        </div>
      </div>

      <div className="text-center mt-8">
        <Link
          href="/"
          className="text-[0.82rem] text-green-deep no-underline hover:underline"
        >
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-green-pale last:border-b-0">
      <span className="text-[0.82rem] text-text-light">{label}</span>
      <span className={`text-[0.82rem] font-normal text-right ${highlight ? 'font-serif text-green-deep text-[1.1rem]' : 'text-text-dark'}`}>
        {value}
      </span>
    </div>
  );
}

function NextStep({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-6 h-6 rounded-full bg-green-pale flex items-center justify-center text-[0.7rem] text-green-deep font-medium shrink-0 mt-0.5">
        {n}
      </div>
      <div>
        <p className="text-[0.88rem] font-medium text-text-dark mb-0.5">{title}</p>
        <p className="text-[0.8rem] text-text-light">{desc}</p>
      </div>
    </div>
  );
}
