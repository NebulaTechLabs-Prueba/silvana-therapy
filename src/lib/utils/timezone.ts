/**
 * Timezone utilities — Florida, US (Eastern Time) as base timezone.
 *
 * All session times are stored and managed in Eastern Time.
 * These helpers convert between Eastern Time and client-local time
 * based on the client's US state selection.
 */

export const BASE_TZ = 'America/New_York';

/** @deprecated Use BASE_TZ instead */
export const ARGENTINA_TZ = BASE_TZ;

export const US_STATE_TIMEZONES: Record<string, string | null> = {
  // Eastern Time
  'Florida': 'America/New_York',
  'New York': 'America/New_York',
  'Georgia': 'America/New_York',
  'North Carolina': 'America/New_York',
  'South Carolina': 'America/New_York',
  'Virginia': 'America/New_York',
  'West Virginia': 'America/New_York',
  'Ohio': 'America/New_York',
  'Michigan': 'America/New_York',
  'Pennsylvania': 'America/New_York',
  'New Jersey': 'America/New_York',
  'Connecticut': 'America/New_York',
  'Massachusetts': 'America/New_York',
  'Rhode Island': 'America/New_York',
  'Vermont': 'America/New_York',
  'New Hampshire': 'America/New_York',
  'Maine': 'America/New_York',
  'Delaware': 'America/New_York',
  'Maryland': 'America/New_York',
  'Washington D.C.': 'America/New_York',
  'Kentucky': 'America/New_York',
  'Indiana': 'America/Indiana/Indianapolis',
  // Central Time
  'Illinois': 'America/Chicago',
  'Texas': 'America/Chicago',
  'Wisconsin': 'America/Chicago',
  'Minnesota': 'America/Chicago',
  'Iowa': 'America/Chicago',
  'Missouri': 'America/Chicago',
  'Arkansas': 'America/Chicago',
  'Louisiana': 'America/Chicago',
  'Mississippi': 'America/Chicago',
  'Alabama': 'America/Chicago',
  'Tennessee': 'America/Chicago',
  'Kansas': 'America/Chicago',
  'Nebraska': 'America/Chicago',
  'Oklahoma': 'America/Chicago',
  'North Dakota': 'America/Chicago',
  'South Dakota': 'America/Chicago',
  // Mountain Time
  'Colorado': 'America/Denver',
  'Montana': 'America/Denver',
  'Wyoming': 'America/Denver',
  'Utah': 'America/Denver',
  'New Mexico': 'America/Denver',
  'Idaho': 'America/Boise',
  'Arizona': 'America/Phoenix', // No DST
  // Pacific Time
  'California': 'America/Los_Angeles',
  'Washington': 'America/Los_Angeles',
  'Oregon': 'America/Los_Angeles',
  'Nevada': 'America/Los_Angeles',
  // Alaska & Hawaii
  'Alaska': 'America/Anchorage',
  'Hawaii': 'Pacific/Honolulu', // No DST
  // Territories
  'Puerto Rico': 'America/Puerto_Rico',
  'U.S. Virgin Islands': 'America/Virgin',
  'Guam': 'Pacific/Guam',
  // Other
  'Otro': null,
};

/** Keep backward compatibility — maps old country names to timezone */
export const COUNTRY_TIMEZONES = US_STATE_TIMEZONES;

/**
 * Convert a time from base timezone (Eastern) to a target state's timezone.
 *
 * @param date  ISO date string YYYY-MM-DD (needed for DST accuracy)
 * @param time  HH:MM in Eastern time
 * @param state  State name matching US_STATE_TIMEZONES keys
 * @returns HH:MM in the target timezone, or null if no conversion possible
 */
export function getClientTime(
  date: string,
  time: string,
  state: string,
): string | null {
  const targetTz = US_STATE_TIMEZONES[state];
  if (!targetTz || targetTz === BASE_TZ) return null;

  return convertTime(date, time, BASE_TZ, targetTz);
}

/**
 * Convert a time between two IANA timezones using Intl.DateTimeFormat.
 * Handles DST transitions automatically.
 */
export function convertTime(
  date: string,
  time: string,
  fromTz: string,
  toTz: string,
): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  // Create a "wall clock" date (as if it were UTC)
  const wallUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  // Find the UTC offset of the source timezone at this approximate moment
  const srcOffset = getUtcOffset(wallUtc, fromTz);

  // The actual UTC moment = wall time - source offset
  const actualUtc = wallUtc - srcOffset;

  // Format in target timezone
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: toTz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return fmt.format(new Date(actualUtc));
}

// ─── Admin timezone preference ──────────────────────────────
// Lista de zonas horarias seleccionables por el admin en Mi Cuenta.
// Cualquier ampliación requiere también extender la CHECK constraint
// en supabase/migrations/003_admin_timezone.sql.

export interface AdminTzOption {
  value: string;  // IANA TZ
  label: string;  // Etiqueta para el dropdown
}

export const ADMIN_TIMEZONES: AdminTzOption[] = [
  { value: 'America/New_York',               label: 'Miami / Nueva York (EST/EDT)' },
  { value: 'America/Chicago',                label: 'Centro EE.UU. (CST/CDT)' },
  { value: 'America/Denver',                 label: 'Montaña EE.UU. (MST/MDT)' },
  { value: 'America/Los_Angeles',            label: 'Pacífico EE.UU. (PST/PDT)' },
  { value: 'America/Argentina/Mendoza',      label: 'Argentina — Mendoza' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina — Buenos Aires' },
  { value: 'America/Argentina/Cordoba',      label: 'Argentina — Córdoba' },
  { value: 'America/Mexico_City',            label: 'México' },
  { value: 'America/Bogota',                 label: 'Colombia' },
  { value: 'America/Lima',                   label: 'Perú' },
  { value: 'America/Santiago',               label: 'Chile' },
  { value: 'America/Caracas',                label: 'Venezuela' },
  { value: 'America/Guayaquil',              label: 'Ecuador' },
  { value: 'America/La_Paz',                 label: 'Bolivia' },
  { value: 'America/Asuncion',               label: 'Paraguay' },
  { value: 'America/Montevideo',             label: 'Uruguay' },
  { value: 'America/Sao_Paulo',              label: 'Brasil' },
  { value: 'Europe/Madrid',                  label: 'España' },
];

/**
 * Format a UTC timestamp (ISO string or Date) into wall-clock date + time
 * in the target timezone. Used to display booking datetimes in the admin
 * panel according to Silvana's TZ preference.
 *
 * @param utc  UTC ISO string or Date
 * @param tz   IANA timezone (e.g. 'America/Argentina/Mendoza')
 * @returns    { date: 'YYYY-MM-DD', time: 'HH:MM' } in the target TZ,
 *             or null if input is falsy/invalid.
 */
export function formatInTz(
  utc: string | Date | null | undefined,
  tz: string,
): { date: string; time: string } | null {
  if (!utc) return null;
  const d = typeof utc === 'string' ? new Date(utc) : utc;
  if (isNaN(d.getTime())) return null;

  // en-CA gives ISO-like YYYY-MM-DD; hour12:false gives HH:MM
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  const hour = get('hour') === '24' ? '00' : get('hour');

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${hour}:${get('minute')}`,
  };
}

/**
 * Convert a wall-clock date + time in a given timezone to a UTC ISO string.
 * Inverse of formatInTz. Used when the admin enters a booking time in the
 * panel — the string "14:30" on "2026-04-23" is interpreted as a wall clock
 * in the admin's TZ and persisted as the correct UTC instant.
 *
 * @param date  'YYYY-MM-DD'
 * @param time  'HH:MM'
 * @param tz    IANA timezone the inputs are expressed in
 * @returns     UTC ISO string (e.g. '2026-04-23T17:30:00.000Z') or null if invalid
 */
export function combineToUtc(
  date: string,
  time: string,
  tz: string,
): string | null {
  if (!date || !time) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  if (!y || !m || !d || Number.isNaN(h) || Number.isNaN(min)) return null;

  // Same trick as convertTime(): treat inputs as "wall UTC", then subtract
  // the actual offset of the source TZ at that instant to get the real UTC.
  const wallUtc = Date.UTC(y, m - 1, d, h, min, 0);
  const offset = getUtcOffset(wallUtc, tz);
  return new Date(wallUtc - offset).toISOString();
}

/**
 * Get the UTC offset (in ms) for a timezone at a given UTC timestamp.
 */
function getUtcOffset(utcMs: number, tz: string): number {
  const d = new Date(utcMs);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => {
    const part = parts.find(p => p.type === type);
    return part ? parseInt(part.value, 10) : 0;
  };

  const localUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') === 24 ? 0 : get('hour'),
    get('minute'),
    get('second'),
  );

  return localUtc - utcMs;
}
