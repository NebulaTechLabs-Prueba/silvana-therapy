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
  startIso: string;              // ISO with timezone (instante canónico)
  endIso: string;
  /** TZ nativa del evento en Google Calendar (ej. 'America/Argentina/Mendoza').
   *  Útil para avisar al admin en el preview si su admin_timezone del panel
   *  difiere. No afecta el instante guardado (startIso ya es canónico). */
  sourceTz: string | null;
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
      const isAllDay = !ev.start?.dateTime && !!ev.start?.date;
      const rawStart = ev.start?.dateTime || ev.start?.date || '';
      const rawEnd = ev.end?.dateTime || ev.end?.date || '';
      // All-day events arrive as "YYYY-MM-DD" with no time/zone. Parsing these
      // as midnight UTC causes the day to shift in any non-UTC viewer. Pin them
      // to noon UTC of the same day so the date is stable and the booking
      // shows as a midday slot (Silvana can edit it after importing).
      const start = isAllDay ? `${rawStart}T12:00:00Z` : rawStart;
      const end = isAllDay && rawEnd ? `${rawEnd}T12:00:00Z` : rawEnd;
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
        // El timeZone nativo del evento en Google. Permite avisar en el
        // preview si difiere del admin_timezone del panel. Para eventos
        // all-day Google no lo manda; queda null.
        sourceTz: ev.start?.timeZone || null,
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
  clientEmail?: string;   // opcional — el evento de Google puede no tener attendee
  clientPhone?: string;   // opcional — Silvana puede tipearlo a mano en la preview
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
      // Regla mínima: evento, nombre y servicio. El contacto (email/phone)
      // exige al menos uno por el CHECK de la tabla clients — validamos
      // aquí también para dar error claro al admin.
      const clientEmail = item.clientEmail && item.clientEmail.trim() !== ''
        ? item.clientEmail.trim().toLowerCase()
        : null;
      const clientPhone = item.clientPhone && item.clientPhone.trim() !== ''
        ? item.clientPhone.trim()
        : null;

      if (!item.eventId || !item.clientName?.trim() || !item.serviceId) {
        errors.push(`${item.title}: datos incompletos (nombre/servicio obligatorios)`);
        continue;
      }
      if (!clientEmail && !clientPhone) {
        errors.push(`${item.title}: el cliente necesita al menos correo o teléfono`);
        continue;
      }

      const { data: dup } = await supabase
        .from('bookings')
        .select('id')
        .eq('google_event_id', item.eventId)
        .maybeSingle();
      if (dup) { skipped++; continue; }

      // Matcheo: por email si existe, si no por phone.
      let existingClient: { id: string } | null = null;
      if (clientEmail) {
        const res = await supabase
          .from('clients')
          .select('id')
          .eq('email', clientEmail)
          .maybeSingle();
        existingClient = res.data as { id: string } | null;
      }
      if (!existingClient && clientPhone) {
        const res = await supabase
          .from('clients')
          .select('id')
          .eq('phone', clientPhone)
          .maybeSingle();
        existingClient = res.data as { id: string } | null;
      }

      let clientId: string;
      if (existingClient) {
        clientId = existingClient.id;
        const update: Record<string, unknown> = {
          full_name: item.clientName.trim(),
          is_returning: true,
        };
        if (clientEmail) update.email = clientEmail;
        if (clientPhone) update.phone = clientPhone;
        await supabase.from('clients').update(update).eq('id', clientId);
      } else {
        const { data: newClient, error: cErr } = await supabase
          .from('clients')
          .insert({
            full_name: item.clientName.trim(),
            email: clientEmail,
            phone: clientPhone,
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
