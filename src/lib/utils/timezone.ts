/**
 * Timezone utilities — Argentina (UTC-3) as base timezone.
 *
 * All session times are stored and managed in Argentina time.
 * These helpers convert between Argentina time and client-local time
 * based on the client's country selection.
 */

export const ARGENTINA_TZ = 'America/Argentina/Buenos_Aires';

export const COUNTRY_TIMEZONES: Record<string, string | null> = {
  'Argentina': 'America/Argentina/Buenos_Aires',
  'Venezuela': 'America/Caracas',
  'Colombia': 'America/Bogota',
  'México': 'America/Mexico_City',
  'Chile': 'America/Santiago',
  'Perú': 'America/Lima',
  'Ecuador': 'America/Guayaquil',
  'España': 'Europe/Madrid',
  'Estados Unidos': 'America/New_York',
  'Panamá': 'America/Panama',
  'República Dominicana': 'America/Santo_Domingo',
  'Costa Rica': 'America/Costa_Rica',
  'Uruguay': 'America/Montevideo',
  'Bolivia': 'America/La_Paz',
  'Paraguay': 'America/Asuncion',
  'Guatemala': 'America/Guatemala',
  'Honduras': 'America/Tegucigalpa',
  'El Salvador': 'America/El_Salvador',
  'Nicaragua': 'America/Managua',
  'Cuba': 'America/Havana',
  'Otro': null,
};

/**
 * Convert a time from Argentina timezone to a target country's timezone.
 *
 * @param date  ISO date string YYYY-MM-DD (needed for DST accuracy)
 * @param time  HH:MM in Argentina time
 * @param country  Country name matching COUNTRY_TIMEZONES keys
 * @returns HH:MM in the target timezone, or null if no conversion possible
 */
export function getClientTime(
  date: string,
  time: string,
  country: string,
): string | null {
  const targetTz = COUNTRY_TIMEZONES[country];
  if (!targetTz || targetTz === ARGENTINA_TZ) return null;

  return convertTime(date, time, ARGENTINA_TZ, targetTz);
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
  // Build a reference date in the source timezone.
  // We use a trick: create a formatter for the source TZ to find the UTC offset,
  // then compute the absolute UTC moment, then format in the target TZ.
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

/**
 * Get the UTC offset (in ms) for a timezone at a given UTC timestamp.
 */
function getUtcOffset(utcMs: number, tz: string): number {
  const d = new Date(utcMs);

  // Format parts in the target timezone
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
