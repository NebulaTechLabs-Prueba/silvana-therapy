'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ArrowIcon from '@/components/ui/ArrowIcon';
import type { Service } from '@/types/database';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_S = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const DEFAULT_SLOTS = ['09:00', '10:00', '11:00', '15:00', '16:00', '17:00'];

function getNextBusinessDays(count: number): { label: string; iso: string }[] {
  const dates: { label: string; iso: string }[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (dates.length < count) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      dates.push({
        label: `${DAYS[day]} ${d.getDate()} ${MONTHS_S[d.getMonth()]}`,
        iso: d.toISOString().slice(0, 10),
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

interface Props {
  service: Service;
}

export default function ServiceDetailClient({ service }: Props) {
  const dates = useMemo(() => getNextBusinessDays(5), []);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const router = useRouter();

  const features: string[] = Array.isArray(service.features) ? service.features : [];

  function handleBook() {
    sessionStorage.setItem('sl_service', JSON.stringify({
      id: service.id,
      title: service.name,
      price: service.is_free ? 'Gratis' : service.price,
      duration: `${service.duration_min} min`,
    }));
    if (selectedDate) sessionStorage.setItem('sl_date', selectedDate);
    if (selectedTime) sessionStorage.setItem('sl_time', selectedTime);
    router.push('/booking');
  }

  return (
    <div className="max-w-[1000px] mx-auto px-[5vw] py-16 grid grid-cols-[1fr_320px] max-md:grid-cols-1 gap-16 max-md:gap-8">
      {/* Main content */}
      <div>
        <Link
          href="/services"
          className="text-[0.78rem] text-text-light no-underline hover:text-green-deep transition-colors inline-flex items-center gap-1.5 mb-8"
        >
          ← Volver a servicios
        </Link>

        <h2 className="font-serif text-[1.4rem] font-normal text-text-dark mb-3">
          Sobre esta sesión
        </h2>
        {service.description && (
          <p className="text-[0.93rem] text-text-mid leading-[1.75] mb-8">{service.description}</p>
        )}

        {features.length > 0 && (
          <>
            <h3 className="text-[0.7rem] tracking-[0.2em] uppercase text-green-deep mb-4">
              Lo que incluye
            </h3>
            <div className="flex flex-col gap-3 mb-8">
              {features.map((feat) => (
                <div key={feat} className="flex items-start gap-3">
                  <span className="w-[5px] h-[5px] rounded-full bg-green-soft mt-2 shrink-0" />
                  <span className="text-[0.88rem] text-text-mid">{feat}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="bg-green-lightest border border-green-pale rounded-2xl p-6">
          <p className="text-[0.7rem] tracking-[0.15em] uppercase text-green-mid mb-2">
            ¿Cómo funciona?
          </p>
          <p className="text-[0.88rem] text-text-mid leading-[1.7]">
            Elige una fecha y hora disponible, completa tus datos y recibirás un email
            de confirmación con el enlace de videollamada. Rápido y sin complicaciones.
          </p>
        </div>
      </div>

      {/* Sidebar */}
      <div className="md:sticky md:top-[90px] self-start">
        <div className="bg-green-lightest border border-green-pale rounded-3xl p-8">
          <p className="text-[0.65rem] tracking-[0.15em] uppercase text-text-light">
            Precio
          </p>
          <div className={`font-serif text-[2.6rem] font-light leading-none mb-5 ${service.is_free ? 'text-green-deep' : 'text-text-dark'}`}>
            {service.is_free ? 'Gratis' : (
              <>{service.price} <small className="text-[0.7rem] font-sans text-text-light">USD</small></>
            )}
          </div>

          {/* Details */}
          <div className="mb-5">
            <div className="flex justify-between py-3 border-b border-green-pale">
              <span className="text-[0.85rem] text-text-light">Duración</span>
              <span className="text-[0.85rem] text-text-dark font-normal">{service.duration_min} min</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-[0.85rem] text-text-light">Modalidad</span>
              <span className="text-[0.85rem] text-text-dark font-normal">{service.modality ?? 'Online'}</span>
            </div>
          </div>

          {/* Dates */}
          <p className="text-[0.65rem] tracking-[0.15em] uppercase text-text-light mt-5 mb-3">
            Próximas fechas disponibles
          </p>
          <div className="flex flex-wrap gap-2">
            {dates.map((d) => (
              <button
                key={d.iso}
                onClick={() => { setSelectedDate(d.iso); setSelectedTime(null); }}
                className={`py-1.5 px-4 rounded-full border text-[0.78rem] cursor-pointer transition-all duration-200 ${
                  selectedDate === d.iso
                    ? 'bg-green-deep text-[#fff] border-green-deep'
                    : 'bg-[#fff] text-text-mid border-green-soft hover:bg-green-pale'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Time slots */}
          <p className="text-[0.65rem] tracking-[0.15em] uppercase text-text-light mt-5 mb-3">
            Horarios
          </p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_SLOTS.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTime(t)}
                className={`py-1.5 px-4 rounded-full border text-[0.78rem] cursor-pointer transition-all duration-200 ${
                  selectedTime === t
                    ? 'bg-green-deep text-[#fff] border-green-deep'
                    : 'bg-[#fff] text-text-mid border-green-soft hover:bg-green-pale'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={handleBook}
            className="w-full mt-6 inline-flex items-center justify-center gap-2.5 bg-green-deep text-[#fff] py-3.5 px-8 rounded-full text-[0.82rem] font-normal tracking-[0.06em] transition-all duration-250 hover:bg-text-dark hover:-translate-y-0.5 cursor-pointer border-0"
          >
            Reservar ahora
            <ArrowIcon />
          </button>
          <p className="text-[0.72rem] text-text-light text-center mt-3">
            Sin pago por adelantado · Cancela hasta 24h antes
          </p>
        </div>
      </div>
    </div>
  );
}
