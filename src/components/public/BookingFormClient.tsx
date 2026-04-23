'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getClientTime, convertTime, tzShortLabel, BASE_TZ, LOCATION_OPTIONS, getClientTimeFallback } from '@/lib/utils/timezone';
import { sanitizeName, sanitizePhoneInput, isValidName, isValidEmail } from '@/lib/utils/sanitize';
import { normalizePhone } from '@/lib/utils/phone';

/* ─── Constants ─── */
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_S = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const MONTHS_F = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DAYS_A = ['D','L','M','X','J','V','S'];
const DAYS_F = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

const STEP_LABELS = ['Fecha y hora', 'Tus datos', 'Confirmar'];

type TimeRange = { start: string; end: string };
type DaySchedule = { enabled: boolean; ranges: TimeRange[] };
type WorkingHoursMap = Record<string, DaySchedule>;

const DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

// Default schedule when working_hours is not configured in DB
const DEFAULT_WH: WorkingHoursMap = {
  sunday:    { enabled: false, ranges: [] },
  monday:    { enabled: true,  ranges: [{ start: '09:00', end: '18:00' }] },
  tuesday:   { enabled: true,  ranges: [{ start: '09:00', end: '18:00' }] },
  wednesday: { enabled: true,  ranges: [{ start: '09:00', end: '18:00' }] },
  thursday:  { enabled: true,  ranges: [{ start: '09:00', end: '18:00' }] },
  friday:    { enabled: true,  ranges: [{ start: '09:00', end: '14:00' }] },
  saturday:  { enabled: false, ranges: [] },
};

function getSlotsForDay(dayOfWeek: number, wh: WorkingHoursMap | null): string[] {
  const schedule = wh || DEFAULT_WH;
  const key = DAY_KEYS[dayOfWeek];
  const day = schedule[key];
  if (!day?.enabled || !day.ranges?.length) return [];
  const slots: string[] = [];
  for (const r of day.ranges) {
    const [sh, sm] = r.start.split(':').map(Number);
    const [eh, em] = r.end.split(':').map(Number);
    const startMin = sh * 60 + (sm || 0);
    const endMin = eh * 60 + (em || 0);
    for (let m = startMin; m < endMin; m += 30) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      slots.push(`${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`);
    }
  }
  return slots;
}

function isDayEnabled(dayOfWeek: number, wh: WorkingHoursMap | null): boolean {
  const schedule = wh || DEFAULT_WH;
  const key = DAY_KEYS[dayOfWeek];
  return schedule[key]?.enabled ?? false;
}

// Las opciones del dropdown vienen del catálogo centralizado en
// timezone.ts. Se agrupan en <optgroup> para que clientes de LATAM y
// España encuentren su país rápido sin perderse entre los 50+ estados
// US. 'Otro' como fallback final.
const LOCATION_COUNTRIES = LOCATION_OPTIONS.countries;
const LOCATION_US_STATES = LOCATION_OPTIONS.usStates;

type PaymentMethodInfo = { nombre: string; recargoPct: number };
type BookedSlot = { date: string; time: string; duration: number };
type ActiveException = {
  type: 'dates' | 'range' | 'recurring';
  the_date: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  days_of_week: number[] | null;
};

/** Check if an exception row applies to a given ISO date */
function excAppliesTo(exc: ActiveException, iso: string, dow: number): boolean {
  if (exc.type === 'dates') return (exc.the_date || '').slice(0, 10) === iso;
  if (exc.type === 'range') {
    const s = (exc.start_date || '').slice(0, 10);
    const e = (exc.end_date || '').slice(0, 10);
    return (!s || iso >= s) && (!e || iso <= e);
  }
  if (exc.type === 'recurring') {
    const s = (exc.start_date || '').slice(0, 10);
    const e = (exc.end_date || '').slice(0, 10);
    if (s && iso < s) return false;
    if (e && iso > e) return false;
    return Array.isArray(exc.days_of_week) && exc.days_of_week.includes(dow);
  }
  return false;
}

/** True if any exception blocks the entire day */
function isDayFullyBlocked(iso: string, dow: number, exceptions: ActiveException[]): boolean {
  for (const exc of exceptions) {
    if (!excAppliesTo(exc, iso, dow)) continue;
    if (exc.all_day || (!exc.start_time && !exc.end_time)) return true;
  }
  return false;
}

/** Returns time windows [start,end] blocked by exceptions for the given date */
function getExceptionWindows(iso: string, dow: number, exceptions: ActiveException[]): Array<{ start: string; end: string }> {
  const out: Array<{ start: string; end: string }> = [];
  for (const exc of exceptions) {
    if (!excAppliesTo(exc, iso, dow)) continue;
    if (exc.all_day || (!exc.start_time && !exc.end_time)) continue; // handled as full-day
    out.push({ start: (exc.start_time || '00:00').slice(0, 5), end: (exc.end_time || '23:59').slice(0, 5) });
  }
  return out;
}

/** Check if candidate slot overlaps with exception time windows on that date */
function isSlotFreeFromExceptions(time: string, duration: number, windows: Array<{ start: string; end: string }>): boolean {
  const [ch, cm] = time.split(':').map(Number);
  const candStart = ch * 60 + cm;
  const candEnd = candStart + duration;
  for (const w of windows) {
    const [sh, sm] = w.start.split(':').map(Number);
    const [eh, em] = w.end.split(':').map(Number);
    const ws = sh * 60 + sm;
    const we = eh * 60 + em;
    if (candStart < we && candEnd > ws) return false;
  }
  return true;
}

/** Check if a candidate slot overlaps with any booked slot on the same date */
function isSlotAvailable(date: string, time: string, serviceDuration: number, booked: BookedSlot[]): boolean {
  const [ch, cm] = time.split(':').map(Number);
  const candStart = ch * 60 + cm;
  const candEnd = candStart + serviceDuration;

  for (const b of booked) {
    if (b.date !== date) continue;
    const [bh, bm] = b.time.split(':').map(Number);
    const bStart = bh * 60 + bm;
    const bEnd = bStart + (b.duration || 60);
    // Overlap: candStart < bEnd AND candEnd > bStart
    if (candStart < bEnd && candEnd > bStart) return false;
  }
  return true;
}

interface Props {
  serviceId: string;
  serviceName: string;
  serviceDuration: number;
  workingHours?: WorkingHoursMap | null;
  isFree?: boolean;
  activePaymentMethods?: PaymentMethodInfo[];
  bookedSlots?: BookedSlot[];
  activeExceptions?: ActiveException[];
  /**
   * TZ IANA a mostrar al visitante en etiquetas y botones de slot.
   * Los slots se generan siempre en BASE_TZ (Miami) — esta preferencia
   * solo controla la ETIQUETA y la hora visible. El valor que se envía
   * al backend sigue siendo Miami wall-clock.
   */
  formTz?: string;
}

/* ─── Component ─── */
export default function BookingFormClient({ serviceId: propServiceId, serviceName: propServiceName, serviceDuration: propServiceDuration, workingHours = null, isFree = true, activePaymentMethods = [], bookedSlots = [], activeExceptions = [], formTz = BASE_TZ }: Props) {
  // Helper: convierte un slot Miami (HH:MM) a la TZ del formulario (para mostrar).
  // Si formTz === BASE_TZ, retorna el mismo valor sin convertir.
  const toFormTz = useCallback((date: string | null | undefined, miamiTime: string): string => {
    if (!formTz || formTz === BASE_TZ) return miamiTime;
    if (!date) return miamiTime;
    return convertTime(date, miamiTime, BASE_TZ, formTz);
  }, [formTz]);
  const formTzLabel = tzShortLabel(formTz || BASE_TZ);
  const formTzIsBase = !formTz || formTz === BASE_TZ;
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Service data — may be overridden from sessionStorage for paid services
  const [svcId, setSvcId] = useState(propServiceId);
  const [svcName, setSvcName] = useState(propServiceName);
  const [svcDuration, setSvcDuration] = useState(propServiceDuration);
  const [svcPrice, setSvcPrice] = useState<string>(isFree ? 'Gratis' : 'Consultar');
  const [effectiveIsFree, setEffectiveIsFree] = useState(isFree);

  // Check sessionStorage for service data + pre-selected date/time (coming from ServiceDetailClient)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('sl_service');
      if (stored) {
        const svc = JSON.parse(stored);
        if (svc.id) setSvcId(svc.id);
        if (svc.title) setSvcName(svc.title);
        if (svc.duration) setSvcDuration(parseInt(svc.duration) || propServiceDuration);
        // Determine free status: explicit is_free flag takes priority
        const svcIsFree = svc.is_free === true;
        setEffectiveIsFree(svcIsFree);
        if (svcIsFree) {
          setSvcPrice('Gratis');
        } else if (svc.price && svc.price !== 'Gratis') {
          const raw = String(svc.price).replace(/[^0-9.]/g, '');
          setSvcPrice(raw ? `$${raw} USD` : 'Consultar');
        } else {
          setSvcPrice('Consultar');
        }
      }
      // Clear sessionStorage after reading to prevent stale data on next visit
      sessionStorage.removeItem('sl_date');
      sessionStorage.removeItem('sl_time');
    } catch {}
  }, [propServiceDuration]);

  // Step 1 state — initialize from sessionStorage if available (pre-selected in ServiceDetailClient)
  const [calY, setCalY] = useState(() => {
    if (typeof window !== 'undefined') {
      const sd = sessionStorage.getItem('sl_date');
      if (sd) return new Date(sd + 'T12:00:00').getFullYear();
    }
    return new Date().getFullYear();
  });
  const [calM, setCalM] = useState(() => {
    if (typeof window !== 'undefined') {
      const sd = sessionStorage.getItem('sl_date');
      if (sd) return new Date(sd + 'T12:00:00').getMonth();
    }
    return new Date().getMonth();
  });
  const [selDate, setSelDate] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return sessionStorage.getItem('sl_date');
    return null;
  });
  const [selTime, setSelTime] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return sessionStorage.getItem('sl_time');
    return null;
  });

  // Step 2 state
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [tel, setTel] = useState('');
  const [motivo, setMotivo] = useState('');
  const [pais, setPais] = useState('');
  const [metodoPago, setMetodoPago] = useState('');

  // Loading & errors
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Hydration guard — sessionStorage values only exist on client
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);

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
    setSubmitError(null);
  }

  /* ─── Validation ─── */
  // Contact policy: email y teléfono son opcionales individualmente pero
  // al menos uno debe estar completo y válido. Coherente con
  // chk_clients_contact_present en DB.
  const emailTouched = email.trim().length > 0;
  const telTouched = tel.trim().length > 0;
  const emailValid = emailTouched && isValidEmail(email);
  const telValid = telTouched && !!normalizePhone(tel);
  const contactProvided = emailValid || telValid;
  const emailLooksValid = !emailTouched || emailValid;
  const telLooksValid = !telTouched || telValid;
  const formValid = isValidName(nombre) && isValidName(apellido) && contactProvided && emailLooksValid && telLooksValid;

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
    if (!selDate || !selTime || !svcId) return;
    setSubmitting(true);

    // Build ISO datetime for preferred_date (Eastern time)
    const preferredDate = `${selDate}T${selTime}:00`;

    // Compute client-local time if state differs from Florida (base)
    const clientLocalTime = pais && pais !== 'Florida' && pais !== 'Otro'
      ? getClientTime(selDate, selTime, pais)
      : null;

    // Generate idempotency key to prevent duplicate submissions
    const idempotencyKey = `${svcId.slice(0,8)}-${selDate}-${selTime}-${Date.now()}`;

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: `${nombre.trim()} ${apellido.trim()}`,
          email: email.trim() || undefined,
          phone: tel.trim() || undefined,
          country: pais || undefined,
          reason: motivo.trim() || undefined,
          preferred_date: preferredDate,
          service_id: svcId,
          idempotency_key: idempotencyKey,
          preferred_payment: metodoPago || undefined,
          client_local_time: clientLocalTime || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const apiMsg: string = errData?.error || '';
        if (res.status === 409 && apiMsg.includes('reservado')) {
          setSubmitError(apiMsg + ' Regresa al paso 1 y elige otro horario.');
          setStep(1);
          setSelTime(null);
          return;
        }
        if (apiMsg) {
          setSubmitError(apiMsg);
          return;
        }
        throw new Error('Booking failed');
      }
      const data = await res.json();

      // Store data for confirmation page
      const selPM = activePaymentMethods.find(m => m.nombre === metodoPago);
      const surPct = selPM?.recargoPct || 0;
      const baseNum = parseFloat(svcPrice.replace(/[^0-9.]/g, '')) || 0;
      const totalPrice = surPct > 0 && baseNum > 0 ? `$${(baseNum * (1 + surPct / 100)).toFixed(2)} USD` : svcPrice;

      sessionStorage.setItem('sl_code', data.booking?.id?.slice(0, 8)?.toUpperCase() || `SL-${Date.now().toString().slice(-6)}`);
      sessionStorage.setItem('sl_service', JSON.stringify({
        title: svcName,
        price: totalPrice,
        duration: `${svcDuration} min`,
      }));
      sessionStorage.setItem('sl_form', JSON.stringify({ nombre, apellido, email, tel, pais }));
      sessionStorage.setItem('sl_date', selDate);
      sessionStorage.setItem('sl_time', selTime);

      router.push('/booking/confirmation');
    } catch {
      router.push('/booking/error');
    } finally {
      setSubmitting(false);
    }
  }, [nombre, apellido, email, tel, motivo, pais, metodoPago, svcId, svcName, svcDuration, effectiveIsFree, selDate, selTime, router]);

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
    const selPM = activePaymentMethods.find(m => m.nombre === metodoPago);
    const surPct = selPM?.recargoPct || 0;
    const baseNum = parseFloat(svcPrice.replace(/[^0-9.]/g, '')) || 0;
    const hasSur = surPct > 0 && baseNum > 0 && !effectiveIsFree;
    const surAmount = hasSur ? baseNum * (surPct / 100) : 0;
    const totalDisplay = hasSur ? `$${(baseNum + surAmount).toFixed(2)} USD` : svcPrice;

    return (
      <div className="md:sticky md:top-[90px] self-start">
        <div className="bg-green-lightest border border-green-pale rounded-3xl p-7">
          <p className="text-[0.65rem] tracking-[0.15em] uppercase text-text-light mb-4">
            Resumen
          </p>
          <SumRow label="Servicio" value={svcName} />
          <SumRow label="Duración" value={`${svcDuration} min`} />
          <SumRow label="Modalidad" value="Online" />
          {selDate && <SumRow label="Fecha" value={formatDate(selDate)} />}
          {selTime && <SumRow label={`Hora ${formTzLabel}`} value={`${toFormTz(selDate, selTime)} hs`} />}
          {selTime && pais && pais !== 'Florida' && pais !== 'Otro' && selDate && (() => {
            const localT = getClientTime(selDate, selTime, pais);
            return localT ? <SumRow label={`Hora ${pais}`} value={`${localT} hs`} /> : null;
          })()}
          {selTime && pais === 'Otro' && selDate && (() => {
            const fb = getClientTimeFallback(selDate, selTime);
            return fb ? <SumRow label={`Hora ${fb.label}`} value={`${fb.time} hs`} /> : null;
          })()}
          {hasSur && (
            <>
              <SumRow label="Subtotal" value={svcPrice} />
              <SumRow label={`Recargo ${selPM?.nombre} (${surPct}%)`} value={`+$${surAmount.toFixed(2)}`} />
            </>
          )}
          <div className="flex justify-between pt-4 mt-2 border-t border-green-pale">
            <span className="text-[0.85rem] text-text-light">Total</span>
            <span className={`font-serif text-[1.6rem] font-light ${effectiveIsFree ? 'text-green-deep' : 'text-text-dark'}`}>
              {totalDisplay}
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
                const isPast = iso < todayStr || (iso === todayStr);
                const isDayClosed = !isDayEnabled(dow, workingHours);
                const isExcBlocked = isDayFullyBlocked(iso, dow, activeExceptions);
                const isOff = isPast || isDayClosed || isExcBlocked;
                const isSel = iso === selDate;
                const isToday = iso === todayStr;

                return (
                  <button
                    key={day}
                    disabled={isOff}
                    onClick={() => pickDate(iso)}
                    className={`aspect-square rounded-xl text-[0.82rem] transition-all duration-200 border cursor-pointer ${
                      hasMounted && isSel
                        ? 'bg-green-deep text-[#fff] border-green-deep'
                        : isOff
                          ? 'bg-transparent text-green-pale border-transparent cursor-default'
                          : isToday
                            ? 'bg-transparent border-green-mid text-text-dark hover:bg-green-lightest'
                            : 'bg-transparent border-transparent text-text-dark hover:bg-green-lightest hover:border-green-pale'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {submitError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-[0.82rem] text-red-700">
                {submitError}
              </div>
            )}

            {/* Time slots */}
            <p className="text-[0.65rem] tracking-[0.15em] uppercase text-text-light mb-1">
              {selDate ? `Horarios — ${formatDate(selDate)}` : 'Selecciona un día para ver horarios'}
            </p>
            {selDate && (
              <p className="text-[0.68rem] text-text-light mb-3 italic">
                {formTzIsBase
                  ? 'Horarios en hora Miami, FL (Este de EE.UU.)'
                  : `Horarios en hora ${formTzLabel}`}
              </p>
            )}
            {selDate && (() => {
              const selDow = new Date(selDate + 'T12:00:00').getDay();
              const allSlots = getSlotsForDay(selDow, workingHours);
              const excWindows = getExceptionWindows(selDate, selDow, activeExceptions);
              const availableSlots = allSlots.filter(t =>
                isSlotAvailable(selDate, t, svcDuration, bookedSlots) &&
                isSlotFreeFromExceptions(t, svcDuration, excWindows)
              );
              return (
                <div className="grid grid-cols-4 max-md:grid-cols-3 max-sm:grid-cols-2 gap-2 mb-6">
                  {allSlots.map(t => {
                    const available = availableSlots.includes(t);
                    // Internamente seguimos trabajando con el slot Miami (t).
                    // El label que ve el visitante se convierte a formTz si
                    // Silvana lo configuró distinto.
                    const displayLabel = toFormTz(selDate, t);
                    return (
                      <button
                        key={t}
                        disabled={!available}
                        onClick={() => available && pickTime(t)}
                        className={`py-2 px-4 rounded-full border text-[0.82rem] transition-all duration-200 ${
                          !available
                            ? 'bg-transparent border-green-pale text-green-pale cursor-not-allowed line-through opacity-50'
                            : hasMounted && selTime === t
                              ? 'bg-green-deep text-[#fff] border-green-deep cursor-pointer'
                              : 'bg-transparent border-green-soft text-text-mid hover:bg-green-pale hover:border-green-deep hover:text-green-deep cursor-pointer'
                        }`}
                      >
                        {displayLabel}
                      </button>
                    );
                  })}
                  {availableSlots.length === 0 && allSlots.length > 0 && (
                    <p className="col-span-full text-center text-[0.82rem] text-text-light italic py-4">
                      No hay horarios disponibles este día. Selecciona otra fecha.
                    </p>
                  )}
                </div>
              );
            })()}

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
                  onChange={e => setNombre(sanitizeName(e.target.value))}
                  placeholder="Tu nombre"
                  maxLength={80}
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
                  onChange={e => setApellido(sanitizeName(e.target.value))}
                  placeholder="Tu apellido"
                  maxLength={80}
                  className="text-[0.88rem] py-3 px-4 border border-green-pale rounded-xl bg-[#fff] text-text-dark outline-none transition-all focus:border-green-deep focus:shadow-[0_0_0_3px_rgba(74,122,74,0.1)]"
                />
              </div>
            </div>

            <div className="mb-2 text-[0.72rem] text-text-light italic">
              Proporciona al menos uno: correo o WhatsApp. Usaremos el que esté disponible para contactarte.
            </div>
            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-5 mb-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.65rem] tracking-[0.12em] uppercase text-text-light font-medium">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="text-[0.88rem] py-3 px-4 border border-green-pale rounded-xl bg-[#fff] text-text-dark outline-none transition-all focus:border-green-deep focus:shadow-[0_0_0_3px_rgba(74,122,74,0.1)]"
                />
                {emailTouched && !emailValid && (
                  <span className="text-[0.68rem] text-red-600">Correo inválido.</span>
                )}
                {!emailTouched && !telValid && (
                  <span className="text-[0.72rem] text-text-light">Recibirás la confirmación aquí.</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.65rem] tracking-[0.12em] uppercase text-text-light font-medium">
                  WhatsApp
                </label>
                <input
                  type="tel"
                  value={tel}
                  onChange={e => setTel(sanitizePhoneInput(e.target.value))}
                  placeholder="+1 000 000 0000"
                  maxLength={22}
                  className="text-[0.88rem] py-3 px-4 border border-green-pale rounded-xl bg-[#fff] text-text-dark outline-none transition-all focus:border-green-deep focus:shadow-[0_0_0_3px_rgba(74,122,74,0.1)]"
                />
                {telTouched && !telValid && (
                  <span className="text-[0.68rem] text-red-600">Número inválido — debe tener entre 8 y 15 dígitos, incluyendo el código de país (ej. +1, +54).</span>
                )}
              </div>
            </div>
            {!contactProvided && (emailTouched || telTouched) && (
              <div className="-mt-3 mb-4 text-[0.72rem] text-red-600">
                Completa correctamente al menos uno de los dos (correo o WhatsApp) para poder coordinar la cita.
              </div>
            )}

            <div className="flex flex-col gap-1.5 mb-5">
              <label className="text-[0.65rem] tracking-[0.12em] uppercase text-text-light font-medium">
                Ubicación
              </label>
              <select
                value={pais}
                onChange={e => setPais(e.target.value)}
                className="text-[0.88rem] py-3 px-4 border border-green-pale rounded-xl bg-[#fff] text-text-dark outline-none transition-all focus:border-green-deep focus:shadow-[0_0_0_3px_rgba(74,122,74,0.1)] cursor-pointer"
              >
                <option value="">Selecciona tu país o estado</option>
                <optgroup label="Países">
                  {LOCATION_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
                <optgroup label="Estados de Estados Unidos">
                  {LOCATION_US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </optgroup>
                <option value="Otro">Otro / no listado</option>
              </select>
              {selTime && pais && (() => {
                const formDisplay = toFormTz(selDate, selTime);
                const localT = pais !== 'Florida' && pais !== 'Otro' && selDate
                  ? getClientTime(selDate, selTime, pais)
                  : null;
                // Si el visitante picó "Otro" usamos fallback del browser
                // (→ su hora local) o UTC. Así no lo dejamos sin referencia.
                const fallback = pais === 'Otro' && selDate && selTime
                  ? getClientTimeFallback(selDate, selTime)
                  : null;
                if (localT) {
                  return (
                    <span className="text-[0.72rem] text-green-deep">
                      {formDisplay} hs hora {formTzLabel} — {localT} hs hora {pais}
                    </span>
                  );
                }
                if (pais === 'Florida') {
                  return (
                    <span className="text-[0.72rem] text-text-light">
                      {formDisplay} hs hora {formTzLabel}{formTzIsBase ? ' (misma zona horaria)' : ''}
                    </span>
                  );
                }
                if (fallback) {
                  return (
                    <span className="text-[0.72rem] text-green-deep">
                      {formDisplay} hs hora {formTzLabel} — {fallback.time} hs {fallback.label}
                    </span>
                  );
                }
                return null;
              })()}
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

            {!effectiveIsFree && activePaymentMethods.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-5">
                <label className="text-[0.65rem] tracking-[0.12em] uppercase text-text-light font-medium">
                  ¿Cómo prefieres pagar?
                </label>
                <div className="flex flex-wrap gap-2">
                  {activePaymentMethods.map(m => (
                    <button
                      key={m.nombre}
                      type="button"
                      onClick={() => setMetodoPago(m.nombre)}
                      className={`py-2 px-5 rounded-full border text-[0.82rem] cursor-pointer transition-all duration-200 ${
                        metodoPago === m.nombre
                          ? 'bg-green-deep text-[#fff] border-green-deep'
                          : 'bg-[#fff] text-text-mid border-green-soft hover:bg-green-pale'
                      }`}
                    >
                      {m.nombre}
                    </button>
                  ))}
                </div>
                {(() => {
                  const selPM = activePaymentMethods.find(m => m.nombre === metodoPago);
                  if (selPM && selPM.recargoPct > 0) {
                    return (
                      <span className="text-[0.72rem] text-[#b08050]">
                        Este método aplica un {selPM.recargoPct}% adicional al monto total
                      </span>
                    );
                  }
                  if (selPM && selPM.recargoPct === 0) {
                    return (
                      <span className="text-[0.72rem] text-green-deep">
                        Sin cargos adicionales
                      </span>
                    );
                  }
                  return (
                    <span className="text-[0.72rem] text-text-light">
                      Recibirás un enlace de pago tras agendar
                    </span>
                  );
                })()}
              </div>
            )}

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
              <ReviewRow label="Servicio" value={svcName} />
              {selDate && <ReviewRow label="Fecha" value={formatDateFull(selDate)} />}
              {selTime && (() => {
                const formDisplay = toFormTz(selDate, selTime);
                const localT = pais && pais !== 'Florida' && pais !== 'Otro' && selDate
                  ? getClientTime(selDate, selTime, pais)
                  : null;
                const fb = pais === 'Otro' && selDate
                  ? getClientTimeFallback(selDate, selTime)
                  : null;
                return (<>
                  <ReviewRow label={`Hora ${formTzLabel}`} value={`${formDisplay} hs`} />
                  {localT && <ReviewRow label={`Hora ${pais}`} value={`${localT} hs`} />}
                  {fb && <ReviewRow label={`Hora ${fb.label}`} value={`${fb.time} hs`} />}
                </>);
              })()}
              <ReviewRow label="Duración" value={`${svcDuration} min`} />
              {(() => {
                const pm = activePaymentMethods.find(m => m.nombre === metodoPago);
                const sPct = pm?.recargoPct || 0;
                const bNum = parseFloat(svcPrice.replace(/[^0-9.]/g, '')) || 0;
                const hasSur = sPct > 0 && bNum > 0 && !effectiveIsFree;
                if (hasSur) {
                  const surAmt = bNum * (sPct / 100);
                  return (<>
                    <ReviewRow label="Subtotal" value={svcPrice} />
                    <ReviewRow label={`Recargo ${pm?.nombre} (${sPct}%)`} value={`+$${surAmt.toFixed(2)}`} />
                    <ReviewRow label="Total" value={`$${(bNum + surAmt).toFixed(2)} USD`} highlight />
                  </>);
                }
                return <ReviewRow label="Precio" value={svcPrice} highlight />;
              })()}
            </div>

            {/* User data */}
            <div className="bg-green-lightest border border-green-pale rounded-2xl p-6 mb-6">
              <p className="text-[0.65rem] tracking-[0.15em] uppercase text-text-light mb-3">
                Tus datos
              </p>
              <ReviewRow label="Nombre" value={`${nombre} ${apellido}`} />
              {email && <ReviewRow label="Email" value={email} />}
              {tel && <ReviewRow label="WhatsApp" value={tel} />}
              {pais && <ReviewRow label="Ubicación" value={pais} />}
              {metodoPago && <ReviewRow label="Método de pago" value={metodoPago} />}
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
