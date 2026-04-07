'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const DAYS_F = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTHS_F = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

interface BookingData {
  code: string;
  service: { title: string; price: string; duration: string };
  form: { nombre: string; apellido: string; email: string; tel?: string };
  date: string;
  time: string;
}

export default function ConfirmationClient() {
  const [data, setData] = useState<BookingData | null>(null);

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

  // Google Calendar link
  function getGCalUrl() {
    if (!data?.date || !data?.time) return '#';
    const start = data.date.replace(/-/g, '') + 'T' + data.time.replace(':', '') + '00';
    const [h, m] = data.time.split(':').map(Number);
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
          ¡Tu cita está confirmada!
        </h1>
        <p className="text-[0.9rem] text-text-mid">
          Recibirás un email de confirmación en{' '}
          <strong className="text-text-dark">{data.form.email}</strong>
        </p>
      </div>

      {/* Details card */}
      <div className="bg-green-lightest border border-green-pale rounded-2xl p-8 mb-5">
        <Row label="Servicio" value={data.service.title} />
        <Row label="Profesional" value="Lda. Silvana López" />
        <Row label="Fecha" value={dateStr} />
        <Row label="Hora" value={data.time ? `${data.time} hs (UTC-3 Argentina)` : '—'} />
        <Row label="Duración" value={data.service.duration} />
        <Row label="Modalidad" value="Online · Videollamada" />
        <Row
          label="Precio"
          value={data.service.price === 'Gratis' ? 'Gratis' : `$${data.service.price} USD`}
          highlight
        />
        {data.form.nombre && (
          <Row label="Paciente" value={`${data.form.nombre} ${data.form.apellido}`} />
        )}
      </div>

      {/* Calendar buttons */}
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
            onClick={() => {/* iCal download logic */}}
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-green-pale rounded-xl text-[0.82rem] text-text-mid cursor-pointer bg-transparent transition-all hover:border-green-deep hover:bg-green-lightest"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-[18px] h-[18px] text-green-deep">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Descargar iCal
          </button>
        </div>
      </div>

      {/* Next steps */}
      <div className="bg-[#fff] border border-green-pale rounded-2xl p-8">
        <p className="text-[0.72rem] tracking-[0.1em] uppercase text-text-light mb-5">
          ¿Qué pasa ahora?
        </p>

        <div className="flex flex-col gap-5">
          <NextStep n={1} title="Confirmación por email" desc="Recibirás un email con todos los detalles de tu cita y el enlace de videollamada." />
          <div className="border-t border-green-pale" />
          <NextStep n={2} title="Recordatorio" desc="24 horas antes de tu cita recibirás un recordatorio con el link de acceso." />
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
