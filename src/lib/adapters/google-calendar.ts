import { calendar_v3, google } from 'googleapis';
import { getAuthenticatedClient } from './google-auth';

/**
 * Google Calendar Adapter (OAuth user token, single-tenant).
 *
 * Auth: reads tokens from `google_integrations` via getAuthenticatedClient().
 * Timezone: America/New_York (Miami) by default.
 * Meet: createCalendarEvent auto-generates a Google Meet link via conferenceData.
 */

const BASE_TZ = 'America/New_York';

async function getCalendar(): Promise<{ calendar: calendar_v3.Calendar; calendarId: string } | null> {
  const auth = await getAuthenticatedClient();
  if (!auth) return null;
  const calendar = google.calendar({ version: 'v3', auth: auth.client });
  return { calendar, calendarId: auth.calendarId };
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
  meetLink: string | null;
}

// ─── Create Event ─────────────────────────────────────────

export async function createCalendarEvent(
  params: CalendarEventParams
): Promise<CalendarEventResult> {
  const ctx = await getCalendar();
  if (!ctx) throw new Error('Google no está conectado. Conecta la cuenta en Integraciones.');

  const start = new Date(params.startTime);
  const end = new Date(start.getTime() + params.durationMinutes * 60 * 1000);
  const tz = params.timeZone || BASE_TZ;

  const event = await ctx.calendar.events.insert({
    calendarId: ctx.calendarId,
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary: params.title,
      description: params.description,
      start: { dateTime: start.toISOString(), timeZone: tz },
      end:   { dateTime: end.toISOString(),   timeZone: tz },
      attendees: params.clientEmail
        ? [{ email: params.clientEmail, displayName: params.clientName }]
        : undefined,
      conferenceData: {
        createRequest: {
          requestId: `silvana-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
      colorId: '2',
    },
  });

  const meetEntry = event.data.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === 'video'
  );

  return {
    eventId: event.data.id!,
    htmlLink: event.data.htmlLink!,
    meetLink: meetEntry?.uri || event.data.hangoutLink || null,
  };
}

// ─── Update Event (Reschedule) ────────────────────────────

export async function updateCalendarEvent(
  eventId: string,
  params: Partial<CalendarEventParams>
): Promise<void> {
  const ctx = await getCalendar();
  if (!ctx) throw new Error('Google no está conectado.');

  const updateData: calendar_v3.Schema$Event = {};

  if (params.startTime) {
    const start = new Date(params.startTime);
    const duration = params.durationMinutes || 50;
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const tz = params.timeZone || BASE_TZ;

    updateData.start = { dateTime: start.toISOString(), timeZone: tz };
    updateData.end   = { dateTime: end.toISOString(),   timeZone: tz };
  }

  if (params.title) updateData.summary = params.title;
  if (params.description) updateData.description = params.description;

  await ctx.calendar.events.patch({
    calendarId: ctx.calendarId,
    eventId,
    sendUpdates: 'all',
    requestBody: updateData,
  });
}

// ─── Delete Event ─────────────────────────────────────────

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const ctx = await getCalendar();
  if (!ctx) return;

  try {
    await ctx.calendar.events.delete({
      calendarId: ctx.calendarId,
      eventId,
      sendUpdates: 'all',
    });
  } catch (error: unknown) {
    const statusCode = (error as { code?: number })?.code;
    if (statusCode !== 404 && statusCode !== 410) throw error;
  }
}

// ─── List Events ──────────────────────────────────────────

export async function listCalendarEvents(
  timeMin: string,
  timeMax: string
): Promise<calendar_v3.Schema$Event[]> {
  const ctx = await getCalendar();
  if (!ctx) return [];

  const response = await ctx.calendar.events.list({
    calendarId: ctx.calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  });

  return response.data.items || [];
}
