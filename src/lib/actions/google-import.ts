'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { listCalendarEvents } from '@/lib/adapters/google-calendar';
import { revalidatePath } from 'next/cache';

/**
 * Google Calendar → System import.
 *
 * Flow:
 *   1. `scanGoogleEvents(from, to)` lists raw Google events in range and
 *      flags ones already linked to a booking via google_event_id.
 *   2. Admin confirms/edits per-event in the preview modal.
 *   3. `importGoogleEvents(items[])` upserts clients by email and
 *      inserts bookings linked to google_event_id (idempotent).
 *
 * Philosophy:
 *   - No heuristic pre-filter. Silvana decides per-event in the UI.
 *   - Clients are still born from bookings (no direct client creation).
 *   - Already-imported events are surfaced but not re-imported.
 */

const DASH = '/admin/dashboard';

export type ScannedEvent = {
  eventId: string;
  title: string;
  description: string | null;
  startIso: string;              // ISO with timezone
  endIso: string;
  durationMin: number;
  attendeeEmail: string | null;  // first non-organizer attendee
  attendeeName: string | null;
  organizerEmail: string | null;
  alreadyImported: boolean;
  existingBookingId: string | null;
};

export async function scanGoogleEvents(
  fromIso: string,
  toIso: string
): Promise<{ success: boolean; events?: ScannedEvent[]; error?: string }> {
  try {
    const events = await listCalendarEvents(fromIso, toIso);
    if (events.length === 0) return { success: true, events: [] };

    const supabase = await createServerSupabaseClient();
    const eventIds = events.map((e) => e.id).filter(Boolean) as string[];

    const { data: existing } = await supabase
      .from('bookings')
      .select('id, google_event_id')
      .in('google_event_id', eventIds);

    const existingMap = new Map<string, string>();
    for (const row of existing ?? []) {
      if (row.google_event_id) existingMap.set(row.google_event_id, row.id);
    }

    const scanned: ScannedEvent[] = events.map((ev) => {
      const start = ev.start?.dateTime || ev.start?.date || '';
      const end = ev.end?.dateTime || ev.end?.date || '';
      let durationMin = 50;
      if (start && end) {
        const ms = new Date(end).getTime() - new Date(start).getTime();
        if (!Number.isNaN(ms) && ms > 0) durationMin = Math.round(ms / 60000);
      }

      const organizerEmail = ev.organizer?.email || null;
      const firstAttendee = (ev.attendees ?? []).find(
        (a) => a.email && a.email !== organizerEmail && !a.resource
      );

      const eventId = ev.id || '';
      return {
        eventId,
        title: ev.summary || '(sin título)',
        description: ev.description || null,
        startIso: start,
        endIso: end,
        durationMin,
        attendeeEmail: firstAttendee?.email || null,
        attendeeName: firstAttendee?.displayName || null,
        organizerEmail,
        alreadyImported: existingMap.has(eventId),
        existingBookingId: existingMap.get(eventId) || null,
      };
    });

    return { success: true, events: scanned };
  } catch (e) {
    console.error('[scanGoogleEvents] failed:', e);
    return { success: false, error: (e as Error).message || 'Error al escanear Google Calendar' };
  }
}

export type ImportItem = {
  eventId: string;
  title: string;
  description?: string;
  startIso: string;
  durationMin: number;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  serviceId: string;
  status: 'pending' | 'confirmed';
};

export async function importGoogleEvents(
  items: ImportItem[]
): Promise<{ success: boolean; imported: number; skipped: number; errors: string[] }> {
  if (!items || items.length === 0) {
    return { success: true, imported: 0, skipped: 0, errors: [] };
  }

  const supabase = createAdminClient();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      if (!item.eventId || !item.clientName?.trim() || !item.clientEmail?.trim() || !item.serviceId) {
        errors.push(`${item.title}: datos incompletos (nombre/email/servicio obligatorios)`);
        continue;
      }

      const { data: dup } = await supabase
        .from('bookings')
        .select('id')
        .eq('google_event_id', item.eventId)
        .maybeSingle();
      if (dup) { skipped++; continue; }

      const email = item.clientEmail.trim().toLowerCase();
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      let clientId: string;
      if (existingClient) {
        clientId = existingClient.id;
        await supabase
          .from('clients')
          .update({
            full_name: item.clientName.trim(),
            phone: item.clientPhone?.trim() || null,
            is_returning: true,
          })
          .eq('id', clientId);
      } else {
        const { data: newClient, error: cErr } = await supabase
          .from('clients')
          .insert({
            full_name: item.clientName.trim(),
            email,
            phone: item.clientPhone?.trim() || null,
          })
          .select('id')
          .single();
        if (cErr || !newClient) {
          errors.push(`${item.title}: no se pudo crear cliente (${cErr?.message || 'unknown'})`);
          continue;
        }
        clientId = newClient.id;
      }

      const confirmedDate = item.status === 'confirmed' ? item.startIso : null;
      const { error: bErr } = await supabase
        .from('bookings')
        .insert({
          client_id: clientId,
          service_id: item.serviceId,
          status: item.status,
          preferred_date: item.startIso,
          confirmed_date: confirmedDate,
          google_event_id: item.eventId,
          admin_notes: item.description?.slice(0, 2000) || `Importado de Google: ${item.title}`,
          idempotency_key: `gcal-import-${item.eventId}`,
        });

      if (bErr) {
        if (bErr.code === '23505') { skipped++; continue; }
        errors.push(`${item.title}: ${bErr.message}`);
        continue;
      }

      imported++;
    } catch (e) {
      errors.push(`${item.title}: ${(e as Error).message}`);
    }
  }

  revalidatePath(DASH);
  return { success: errors.length === 0, imported, skipped, errors };
}
