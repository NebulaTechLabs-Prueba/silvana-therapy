/**
 * Minimal `{variable}` template renderer for WhatsApp / email messages.
 * - Unknown variables are left as-is so Silvana notices missing data.
 * - `null` / `undefined` values render as empty string.
 */

export type TemplateVars = Record<string, string | number | null | undefined>;

export function renderTemplate(tpl: string, vars: TemplateVars): string {
  if (!tpl) return '';
  return tpl.replace(/\{(\w+)\}/g, (match, key) => {
    if (!(key in vars)) return match;
    const v = vars[key];
    return v === null || v === undefined ? '' : String(v);
  });
}

export const WA_TEMPLATE_EVENTS = [
  'booking_received',
  'booking_confirmed',
  'payment_link',
  'reschedule',
  'reminder_24h',
  'custom',
] as const;

export type WaTemplateEvent = typeof WA_TEMPLATE_EVENTS[number];

export const WA_TEMPLATE_LABELS: Record<WaTemplateEvent, string> = {
  booking_received:  'Reserva recibida',
  booking_confirmed: 'Reserva confirmada',
  payment_link:      'Enlace de pago',
  reschedule:        'Reprogramación',
  reminder_24h:      'Recordatorio 24h',
  custom:            'Mensaje personalizado',
};

export const WA_TEMPLATE_VARS = [
  { key: 'cliente',  desc: 'Nombre del cliente' },
  { key: 'servicio', desc: 'Nombre del servicio' },
  { key: 'fecha',    desc: 'Fecha (ej. 15/04/2026)' },
  { key: 'hora',     desc: 'Hora (ej. 14:30)' },
  { key: 'precio',   desc: 'Precio en USD' },
  { key: 'link',     desc: 'Enlace de pago / Meet' },
  { key: 'motivo',   desc: 'Motivo (reprogramación / rechazo)' },
];
