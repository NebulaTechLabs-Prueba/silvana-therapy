'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/* ─── Constants ─── */
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_S = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const MONTHS_F = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DAYS_A = ['D','L','M','X','J','V','S'];
const DAYS_F = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

const STEP_LABELS = ['Fecha y hora', 'Tus datos', 'Confirmar'];

const DEFAULT_SLOTS = ['09:00','10:00','11:00','15:00','16:00','17:00'];

interface Props {
  serviceId: string;
  serviceName: string;
  serviceDuration: number;
}

/* ─── Component ─── */
export default function BookingFormClient({ serviceId, serviceName, serviceDuration }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [calY, setCalY] = useState(() => new Date().getFullYear());
  const [calM, setCalM] = useState(() => new Date().getMonth());
  const [selDate, setSelDate] = useState<string | null>(null);
  const [selTime, setSelTime] = useState<string | null>(null);

  // Step 2 state
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [tel, setTel] = useState('');
  const [motivo, setMotivo] = useState('');

  // Loading
  const [submitting, setSubmitting] = useState(false);

  /* ─── Calendar helpers ─── */
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const firstDay = new Date(calY, calM, 1).getDay();
  const daysInMonth = new Date(calY, calM + 1, 0).getDate();

  function changeMonth(dir: number) {
    let m = calM + dir;
    let y = calY;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setCalM(m);
    setCalY(y);
  }

  function pickDate(iso: string) {
    setSelDate(iso);
    setSelTime(null);
  }

  function pickTime(t: string) {
    setSelTime(t);
  }

  /* ─── Validation ─── */
  const formValid = nombre.trim() && apellido.trim() && /\S+@\S+\.\S+/.test(email);

  /* ─── Format helpers ─── */
  function formatDate(iso: string) {
    const d = new Date(iso + 'T12:00:00');
    return `${DAYS_F[d.getDay()]} ${d.getDate()} ${MONTHS_S[d.getMonth()]}`;
  }
  function formatDateFull(iso: string) {
    const d = new Date(iso + 'T12:00:00');
    return `${DAYS_F[d.getDay()]} ${d.getDate()} de ${MONTHS_F[d.getMonth()]} ${d.getFullYear()}`;
  }

  /* ─── Submit ─── */
  const handleConfirm = useCallback(async () => {
    if (!selDate || !selTime || !serviceId) return;
    setSubmitting(true);

    // Build ISO datetime for preferred_date
    const preferredDate = `${selDate}T${selTime}:00.000Z`;

    // Generate idempotency key to prevent duplicate submissions
    const idempotencyKey = `${email.trim()}-${serviceId}-${selDate}-${selTime}-${Date.now()}`;

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: `${nombre.trim()} ${apellido.trim()}`,
          email: email.trim(),
          phone: tel.trim() || undefined,
          reason: motivo.trim() || undefined,
          preferred_date: preferredDate,
          service_id: serviceId,
          idempotency_key: idempotencyKey,
        }),
      });

      if (!res.ok) throw new Error('Booking failed');
      const data = await res.json();

      // Store data for confirmation page
      sessionStorage.setItem('sl_code', data.booking?.id?.slice(0, 8)?.toUpperCase() || `SL-${Date.now().toString().slice(-6)}`);
      sessionStorage.setItem('sl_service', JSON.stringify({
        title: serviceName,
        price: 'Gratis',
        duration: `${serviceDuration} min`,
      }));
      sessionStorage.setItem('sl_form', JSON.stringify({ nombre, apellido, email, tel }));
      sessionStorage.setItem('sl_date', selDate);
      sessionStorage.setItem('sl_time', selTime);

      router.push('/booking/confirmation');
    } catch {
      router.push('/booking/error');
    } finally {
      setSubmitting(false);
    }
  }, [nombre, apellido, email, tel, motivo, serviceId, serviceName, serviceDuration, selDate, selTime, router]);

  /* ─── Step progress bar ─── */
  function StepsBar() {
    return (
      <div className="flex items-center gap-0 mb-8">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const isDone = step > n;
          const isActive = step === n;
          return (
            <div key={label} className="flex items-center">
              {i > 0 && (
                <div className={`w-12 h-px mx-2 ${isDone ? 'bg-green-deep' : 'bg-green-pale'}`} />
              )}
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-[30px] h-[30px] rounded-full flex items-center justify-center text-[0.72rem] font-medium transition-colors ${
                    isDone
                      ? 'bg-green-deep text-[#fff]'
                      : isActive
                        ? 'bg-text-dark text-[#fff]'
                        : 'bg-green-pale text-text-light'
                  }`}
                >
                  {isDone ? '✓' : n}
                </div>
                <span className="text-[0.72rem] text-text-light hidden sm:inline">{label}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ─── Summary sidebar ─── */
  function Summary() {
    return (
      <div className="md:sticky md:top-[90px] self-start">
        <div className="bg-green-lightest border border-green-pale rounded-3xl p-7">
          <p className="text-[0.65rem] tracking-[0.15em] uppercase text-text-light mb-4">
            Resumen
          </p>
          <SumRow label="Servicio" value={serviceName} />
          <SumRow label="Duración" value={`${serviceDuration} min`} />
          <SumRow label="Modalidad" value="Online" />
          {selDate && <SumRow label="Fecha" value={formatDate(selDate)} />}
          {selTime && <SumRow label="Hora" value={selTime} />}
          <div className="flex justify-between pt-4 mt-2 border-t border-green-pale">
            <span className="text-[0.85rem] text-text-light">Total</span>
            <span className="font-serif text-[1.6rem] font-light text-green-deep">
              Gratis
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto px-[5vw] py-10 grid grid-cols-[1fr_300px] max-md:grid-cols-1 gap-12 max-md:gap-8">
      {/* Main panel */}
      <div className="bg-[#fff] border border-green-pale rounded-3xl p-9 max-sm:p-6">
        <StepsBar />

        {/* ─── STEP 1: Date & Time ─── */}
        {step === 1 && (
          <div>
            <h2 className="font-serif text-[1.3rem] font-normal text-text-dark mb-6">
              Selecciona fecha y hora
            </h2>

            {/* Calendar nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => changeMonth(-1)} className="w-7 h-7 rounded-full border border-green-pale flex items-center justify-center text-text-light hover:border-green-deep hover:text-green-deep transition-colors cursor-pointer bg-transparent">
                ‹
              </button>
              <span className="font-serif text-[1.1rem] font-medium text-text-dark">
                {MONTHS[calM]} {calY}
              </span>
              <button onClick={() => changeMonth(1)} className="w-7 h-7 rounded-full border border-green-pale flex items-center justify-center text-text-light hover:border-green-deep hover:text-green-deep transition-colors cursor-pointer bg-transparent">
                ›
              </button>
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-[3px] mb-6">
              {DAYS_A.map(d => (
                <div key={d} className="text-center text-[0.65rem] tracking-[0.1em] uppercase text-text-light py-2">
                  {d}
                </div>
              ))}
              {Array.from({ length: firstDay }, (_, i) => (
                <div key={`e-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const iso = `${calY}-${String(calM+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const d = new Date(calY, calM, day);
                const dow = d.getDay();
                const isPast = iso < todayStr;
                const isWeekend = dow === 0 || dow === 6;
                const isOff = isPast || isWeekend;
                const isSel = iso === selDate;
                const isToday = iso === todayStr;

                return (
                  <button
                    key={day}
                    disabled={isOff}
                    onClick={() => pickDate(iso)}
                    className={`aspect-square rounded-xl text-[0.82rem] transition-all duration-200 border cursor-pointer bg-transparent ${
                      isSel
                        ? 'bg-green-deep text-[#fff] border-green-deep'
                        : isOff
                          ? 'text-green-pale border-transparent cursor-default'
                          : isToday
                            ? 'border-green-mid text-text-dark hover:bg-green-lightest'
                            : 'border-transparent text-text-dark hover:bg-green-lightest hover:border-green-pale'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Time slots */}
            <p className="text-[0.65rem] tracking-[0.15em] uppercase text-text-light mb-3">
              {selDate ? `Horarios — ${formatDate(selDate)}` : 'Selecciona un día para ver horarios'}
            </p>
            {selDate && (
              <div className="grid grid-cols-4 max-md:grid-cols-3 max-sm:grid-cols-2 gap-2 mb-6">
                {DEFAULT_SLOTS.map(t => (
                  <button
                    key={t}
                    onClick={() => pickTime(t)}
                    className={`py-2 px-4 rounded-full border text-[0.82rem] transition-all duration-200 cursor-pointer bg-transparent ${
                      selTime === t
                        ? 'bg-green-deep text-[#fff] border-green-deep'
                        : 'border-green-soft text-text-mid hover:bg-green-pale hover:border-green-deep hover:text-green-deep'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                disabled={!selDate || !selTime}
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2.5 bg-green-deep text-[#fff] py-3 px-7 rounded-full text-[0.82rem] font-normal tracking-[0.06em] transition-all duration-250 hover:bg-text-dark disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-0"
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Personal Data ─── */}
        {step === 2 && (
          <div>
            <h2 className="font-serif text-[1.3rem] font-normal text-text-dark mb-6">
              Tus datos
            </h2>

            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5 mb-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.65rem] tracking-[0.12em] uppercase text-text-light font-medium">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  className="text-[0.88rem] py-3 px-4 border border-green-pale rounded-xl bg-[#fff] text-text-dark outline-none transition-all focus:border-green-deep focus:shadow-[0_0_0_3px_rgba(74,122,74,0.1)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.65rem] tracking-[0.12em] uppercase text-text-light font-medium">
                  Apellido *
                </label>
                <input
                  type="text"
                  value={apellido}
                  onChange={e => setApellido(e.target.value)}
                  placeholder="Tu apellido"
                  className="text-[0.88rem] py-3 px-4 border border-green-pale rounded-xl bg-[#fff] text-text-dark outline-none transition-all focus:border-green-deep focus:shadow-[0_0_0_3px_rgba(74,122,74,0.1)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5 mb-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.65rem] tracking-[0.12em] uppercase text-text-light font-medium">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="text-[0.88rem] py-3 px-4 border border-green-pale rounded-xl bg-[#fff] text-text-dark outline-none transition-all focus:border-green-deep focus:shadow-[0_0_0_3px_rgba(74,122,74,0.1)]"
                />
                <span className="text-[0.72rem] text-text-light">
                  Recibirás la confirmación aquí
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.65rem] tracking-[0.12em] uppercase text-text-light font-medium">
                  WhatsApp (opcional)
                </label>
                <input
                  type="tel"
                  value={tel}
                  onChange={e => setTel(e.target.value)}
                  placeholder="+1 000 000 0000"
                  className="text-[0.88rem] py-3 px-4 border border-green-pale rounded-xl bg-[#fff] text-text-dark outline-none transition-all focus:border-green-deep focus:shadow-[0_0_0_3px_rgba(74,122,74,0.1)]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mb-5">
              <label className="text-[0.65rem] tracking-[0.12em] uppercase text-text-light font-medium">
                ¿Qué te trae por aquí? (opcional)
              </label>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Puedes contarme brevemente…"
                className="text-[0.88rem] py-3 px-4 border border-green-pale rounded-xl bg-[#fff] text-text-dark outline-none transition-all focus:border-green-deep focus:shadow-[0_0_0_3px_rgba(74,122,74,0.1)] min-h-[85px] resize-y font-[inherit]"
              />
            </div>

            <div className="bg-green-lightest rounded-xl p-4 text-[0.82rem] text-text-mid mb-6">
              Tu información es estrictamente confidencial y solo se usa para gestionar tu cita.
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="py-3 px-6 rounded-full border border-green-soft text-text-mid text-[0.82rem] transition-all hover:border-green-deep hover:text-green-deep cursor-pointer bg-transparent"
              >
                ← Volver
              </button>
              <button
                disabled={!formValid}
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2.5 bg-green-deep text-[#fff] py-3 px-7 rounded-full text-[0.82rem] font-normal tracking-[0.06em] transition-all duration-250 hover:bg-text-dark disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-0"
              >
                Revisar reserva →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Review & Confirm ─── */}
        {step === 3 && (
          <div>
            <h2 className="font-serif text-[1.3rem] font-normal text-text-dark mb-6">
              Revisa tu reserva
            </h2>

            {/* Appointment details */}
            <div className="bg-green-lightest border border-green-pale rounded-2xl p-6 mb-4">
              <p className="text-[0.65rem] tracking-[0.15em] uppercase text-text-light mb-3">
                Detalles de la cita
              </p>
              <ReviewRow label="Servicio" value={serviceName} />
              {selDate && <ReviewRow label="Fecha" value={formatDateFull(selDate)} />}
              {selTime && <ReviewRow label="Hora" value={`${selTime} hs`} />}
              <ReviewRow label="Duración" value={`${serviceDuration} min`} />
              <ReviewRow label="Precio" value="Gratis" highlight />
            </div>

            {/* User data */}
            <div className="bg-green-lightest border border-green-pale rounded-2xl p-6 mb-6">
              <p className="text-[0.65rem] tracking-[0.15em] uppercase text-text-light mb-3">
                Tus datos
              </p>
              <ReviewRow label="Nombre" value={`${nombre} ${apellido}`} />
              <ReviewRow label="Email" value={email} />
              {tel && <ReviewRow label="WhatsApp" value={tel} />}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="py-3 px-6 rounded-full border border-green-soft text-text-mid text-[0.82rem] transition-all hover:border-green-deep hover:text-green-deep cursor-pointer bg-transparent"
              >
                ← Editar datos
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="inline-flex items-center gap-2.5 bg-green-deep text-[#fff] py-3 px-7 rounded-full text-[0.82rem] font-normal tracking-[0.06em] transition-all duration-250 hover:bg-text-dark disabled:opacity-60 cursor-pointer border-0"
              >
                {submitting ? 'Enviando…' : '✓ Confirmar reserva'}
              </button>
            </div>

            <p className="text-[0.72rem] text-text-light mt-4">
              Al confirmar aceptas nuestra{' '}
              <span className="underline cursor-pointer">política de cancelación</span>.
            </p>
          </div>
        )}
      </div>

      {/* Sidebar summary */}
      <Summary />
    </div>
  );
}

/* ─── Small helper components ─── */
function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-green-pale last:border-b-0">
      <span className="text-[0.8rem] text-text-light">{label}</span>
      <span className="text-[0.8rem] text-text-dark font-normal max-w-[150px] text-right">{value}</span>
    </div>
  );
}

function ReviewRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between py-2 border-b border-green-pale last:border-b-0">
      <span className="text-[0.82rem] text-text-light">{label}</span>
      <span className={`text-[0.82rem] font-normal ${highlight ? 'font-serif text-green-deep text-[1rem]' : 'text-text-dark'}`}>
        {value}
      </span>
    </div>
  );
}
