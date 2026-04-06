import { google, calendar_v3 } from 'googleapis';

/**
 * Google Calendar Adapter
 * Uses a Service Account to manage Silvana's calendar.
 *
 * Setup:
 * 1. Create Service Account in Google Cloud Console
 * 2. Enable Google Calendar API
 * 3. Download JSON key, base64 encode it
 * 4. Share the calendar with the service account email
 */

function getCalendarClient(): calendar_v3.Calendar {
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64!;
  const key = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf-8'));

  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  return google.calendar({ version: 'v3', auth });
}

// ─── Types ────────────────────────────────────────────────

export interface CalendarEventParams {
  title: string;
  description: string;
  startTime: string;      // ISO 8601
  durationMinutes: number;
  clientEmail?: string;
  clientName: string;
  timeZone?: string;
}

export interface CalendarEventResult {
  eventId: string;
  htmlLink: string;
}

// ─── Create Event ─────────────────────────────────────────

export async function createCalendarEvent(
  params: CalendarEventParams
): Promise<CalendarEventResult> {
  const calendar = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID!;

  const start = new Date(params.startTime);
  const end = new Date(start.getTime() + params.durationMinutes * 60 * 1000);

  const event = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: params.title,
      description: params.description,
      start: {
        dateTime: start.toISOString(),
        timeZone: params.timeZone || 'America/Argentina/Mendoza',
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: params.timeZone || 'America/Argentina/Mendoza',
      },
      attendees: params.clientEmail
        ? [{ email: params.clientEmail, displayName: params.clientName }]
        : undefined,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
      colorId: '2', // Sage green — matches brand
    },
  });

  return {
    eventId: event.data.id!,
    htmlLink: event.data.htmlLink!,
  };
}

// ─── Update Event (Reschedule) ────────────────────────────

export async function updateCalendarEvent(
  eventId: string,
  params: Partial<CalendarEventParams>
): Promise<void> {
  const calendar = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID!;

  const updateData: calendar_v3.Schema$Event = {};

  if (params.startTime) {
    const start = new Date(params.startTime);
    const duration = params.durationMinutes || 50;
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const tz = params.timeZone || 'America/Argentina/Mendoza';

    updateData.start = { dateTime: start.toISOString(), timeZone: tz };
    updateData.end = { dateTime: end.toISOString(), timeZone: tz };
  }

  if (params.title) updateData.summary = params.title;
  if (params.description) updateData.description = params.description;

  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: updateData,
  });
}

// ─── Delete Event ─────────────────────────────────────────

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendar = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID!;

  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (error: unknown) {
    // If event already deleted, ignore 404
    const statusCode = (error as { code?: number })?.code;
    if (statusCode !== 404) throw error;
  }
}

// ─── List Events (for admin calendar view) ────────────────

export async function listCalendarEvents(
  timeMin: string,
  timeMax: string
): Promise<calendar_v3.Schema$Event[]> {
  const calendar = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID!;

  const response = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  });

  return response.data.items || [];
}
