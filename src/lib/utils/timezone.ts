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
