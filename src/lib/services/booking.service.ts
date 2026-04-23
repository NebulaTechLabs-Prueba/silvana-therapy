import { createAdminClient } from '@/lib/supabase/admin';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '@/lib/adapters/google-calendar';
import { sendNewBookingNotification, sendBookingReceivedEmail, sendBookingConfirmedEmail, sendBookingRejectedEmail, sendRescheduledEmail, sendPaymentLinkEmail } from '@/lib/adapters/email';
import { createStripePaymentLink } from '@/lib/adapters/stripe';
import { createPayPalOrder } from '@/lib/adapters/paypal';
import { combineToUtc, BASE_TZ } from '@/lib/utils/timezone';
import type { CreateBookingDTO, AcceptBookingDTO, RejectBookingDTO, RescheduleBookingDTO, CreatePaymentLinkDTO, Booking, BookingWithClient } from '@/types/database';

const supabase = createAdminClient();

// ─── Create Booking (Public) ──────────────────────────────

export async function createBooking(dto: CreateBookingDTO): Promise<Booking> {
  // 1. Normalizar contacto + validar (paridad con chk_clients_contact_present
  //    en DB). Email y phone son opcionales individualmente pero al menos
  //    uno debe estar presente.
  const clientEmail = dto.email && dto.email.trim() !== ''
    ? dto.email.trim().toLowerCase()
    : null;
  const clientPhone = dto.phone && dto.phone.trim() !== '' ? dto.phone.trim() : null;
  if (!clientEmail && !clientPhone) {
    throw new Error('Debe proporcionar al menos un correo o un teléfono');
  }

  // 2. Find-or-create client. Matcheo por email si lo hay, si no por phone.
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
      full_name: dto.full_name,
      country: dto.country || null,
      reason: dto.reason || null,
      is_returning: true,
    };
    if (clientEmail) update.email = clientEmail;
    if (clientPhone) update.phone = clientPhone;
    await supabase.from('clients').update(update).eq('id', clientId);
  } else {
    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        full_name: dto.full_name,
        email: clientEmail,
        phone: clientPhone,
        country: dto.country || null,
        reason: dto.reason || null,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create client: ${error.message}`);
    clientId = newClient.id;
  }

  // Normalizar preferred_date — el formulario público envía un string
  // SIN offset de TZ ("YYYY-MM-DDTHH:MM:00") que representa hora Miami
  // (los slots se generan a partir de working_hours en BASE_TZ=Miami).
  // Postgres en Supabase tiene session TIMEZONE=UTC, así que un naked
  // string se interpretaría como UTC — y la cita quedaría 4h corrida.
  // Convertimos explícitamente Miami → UTC ISO aquí para que el DB
  // guarde el instante correcto sin depender del session TZ.
  let preferredDateUtc: string | null = null;
  let reqDate: string | null = null;
  let reqTime: string | null = null;
  if (dto.preferred_date) {
    reqDate = dto.preferred_date.slice(0, 10);
    reqTime = dto.preferred_date.slice(11, 16);
    preferredDateUtc = combineToUtc(reqDate, reqTime, BASE_TZ);
    if (!preferredDateUtc) {
      throw new Error('Fecha/hora inválida en la reserva');
    }
  }

  // 2. Check for time conflicts via unified RPC (bookings + exceptions + working_hours + google events).
  // La RPC espera date/time como wall-clock Miami porque working_hours
  // están definidos en esa zona; usamos los valores originales sin
  // convertir.
  if (reqDate && reqTime) {
    const { data: reqSvc } = await supabase
      .from('services')
      .select('duration_min')
      .eq('id', dto.service_id)
      .single();
    const reqDuration = reqSvc?.duration_min || 60;

    const { data: conflicts, error: rpcErr } = await supabase.rpc('check_slot_conflicts', {
      p_date: reqDate,
      p_time: reqTime,
      p_duration: reqDuration,
      p_exclude_id: null,
    });

    if (rpcErr) {
      console.error('[BookingService] check_slot_conflicts failed:', rpcErr);
      throw new Error('No se pudo validar el horario. Intenta nuevamente.');
    }

    if (conflicts && conflicts.length > 0) {
      const first = conflicts[0] as { source: string; label: string };
      const msgMap: Record<string, string> = {
        booking:          'Este horario ya está reservado. Por favor selecciona otro.',
        exception:        'Ese horario no está disponible (bloqueado por la profesional).',
        google_event:     'Ese horario ya tiene un evento en el calendario.',
        working_hours:    'Ese horario está fuera del horario de atención.',
      };
      throw new Error(msgMap[first.source] || `Horario no disponible: ${first.label}`);
    }
  }

  // 3. Create booking (trigger auto-detects is_first_session).
  // Usamos preferredDateUtc (ISO con offset explícito) para que el
  // instante guardado sea canónico independiente del session TZ de DB.
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      client_id: clientId,
      service_id: dto.service_id,
      preferred_date: preferredDateUtc,
      idempotency_key: dto.idempotency_key,
      preferred_payment: dto.preferred_payment || null,
      client_local_time: dto.client_local_time || null,
    })
    .select('*, client:clients(*), service:services(*)')
    .single();

  if (bookingError) {
    // Idempotency: if duplicate key, return existing booking
    if (bookingError.code === '23505') {
      const { data: existing } = await supabase
        .from('bookings')
        .select('*')
        .eq('idempotency_key', dto.idempotency_key)
        .single();
      if (existing) return existing;
    }
    throw new Error(`Failed to create booking: ${bookingError.message}`);
  }

  // 3. Notify Silvana via email
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('notification_email')
    .single();

  if (settings?.notification_email) {
    try {
      await sendNewBookingNotification({
        adminEmail: settings.notification_email,
        clientName: dto.full_name,
        clientEmail: clientEmail || '',
        clientPhone: clientPhone || undefined,
        reason: dto.reason,
        preferredDate: preferredDateUtc || undefined,
        isFirstSession: booking.is_first_session,
        isFree: booking.service?.is_free === true,
        bookingId: booking.id,
      });
    } catch (emailError) {
      // Don't fail the booking if email fails
      console.error('[BookingService] Email notification failed:', emailError);
    }
  }

  // 4. Notify client via email (si proporcionó email; si no, sendEmail
  //    en el adapter hace no-op). No-op vs omit aquí es equivalente
  //    pero dejamos la llamada para que los logs de info registren el
  //    intent.
  try {
    await sendBookingReceivedEmail({
      clientEmail: clientEmail || '',
      clientName: dto.full_name,
      serviceName: booking.service?.name || 'Consulta',
      preferredDate: dto.preferred_date,
      isFirstSession: booking.is_first_session,
      isFree: booking.service?.is_free === true,
    });
  } catch (emailError) {
    console.error('[BookingService] Client email failed:', emailError);
  }

  return booking;
}

// ─── Accept Booking (Admin) ───────────────────────────────

export async function acceptBooking(dto: AcceptBookingDTO): Promise<Booking> {
  const { data: booking, error } = await supabase
    .from('bookings')
    .update({
      status: 'accepted',
      confirmed_date: dto.confirmed_date,
      admin_notes: dto.admin_notes || null,
    })
    .eq('id', dto.booking_id)
    .eq('status', 'pending')
    .select('*, client:clients(*), service:services(*)')
    .single();

  if (error || !booking) {
    throw new Error('Booking not found or already processed');
  }

  // If first session → directly confirm (free)
  if (booking.is_first_session) {
    return confirmBooking(booking);
  }

  // Non-first session → Silvana will set price and generate link separately
  return booking;
}

// ─── Confirm Booking (internal) ───────────────────────────

async function confirmBooking(booking: BookingWithClient): Promise<Booking> {
  // 1. Update status
  const { data: updated, error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', booking.id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to confirm: ${error.message}`);

  // 2. Create Google Calendar event
  let meetLink: string | null = null;
  try {
    const res = await createCalendarEvent({
      title: `Terapia — ${booking.client.full_name}`,
      description: `Email: ${booking.client.email}\nTeléfono: ${booking.client.phone || 'N/A'}\nMotivo: ${booking.client.reason || 'N/A'}\n\nNotas: ${booking.admin_notes || 'Sin notas'}`,
      startTime: booking.confirmed_date!,
      durationMinutes: booking.service.duration_min,
      clientEmail: booking.client.email,
      clientName: booking.client.full_name,
    });
    meetLink = res.meetLink;

    await supabase
      .from('bookings')
      .update({ google_event_id: res.eventId, meet_link: res.meetLink })
      .eq('id', booking.id);
  } catch (calError) {
    console.error('[BookingService] Google Calendar failed:', calError);
  }

  // 3. Email client
  try {
    await sendBookingConfirmedEmail({
      clientEmail: booking.client.email,
      clientName: booking.client.full_name,
      confirmedDate: booking.confirmed_date!,
      serviceName: booking.service.name,
      durationMin: booking.service.duration_min,
      meetLink,
    });
  } catch (emailError) {
    console.error('[BookingService] Confirmation email failed:', emailError);
  }

  return updated;
}

// ─── Reject Booking (Admin) ──────────────────────────────

export async function rejectBooking(dto: RejectBookingDTO): Promise<Booking> {
  const { data: booking, error } = await supabase
    .from('bookings')
    .update({
      status: 'rejected',
      rejection_reason: dto.rejection_reason || null,
    })
    .eq('id', dto.booking_id)
    .in('status', ['pending', 'accepted'])
    .select('*, client:clients(*)')
    .single();

  if (error || !booking) {
    throw new Error('Booking not found or already processed');
  }

  // Delete Google Calendar event if it exists
  if (booking.google_event_id) {
    try {
      await deleteCalendarEvent(booking.google_event_id);
    } catch (calError) {
      console.error('[BookingService] Calendar delete failed:', calError);
    }
  }

  // Notify client
  try {
    await sendBookingRejectedEmail({
      clientEmail: booking.client.email,
      clientName: booking.client.full_name,
      reason: dto.rejection_reason,
    });
  } catch (emailError) {
    console.error('[BookingService] Rejection email failed:', emailError);
  }

  return booking;
}

// ─── Reschedule Booking (Admin) ───────────────────────────

export async function rescheduleBooking(dto: RescheduleBookingDTO): Promise<Booking> {
  // Get current booking
  const { data: current } = await supabase
    .from('bookings')
    .select('*, client:clients(*), service:services(*)')
    .eq('id', dto.booking_id)
    .single();

  if (!current) throw new Error('Booking not found');

  const oldDate = current.confirmed_date;

  // Update booking
  const { data: updated, error } = await supabase
    .from('bookings')
    .update({
      confirmed_date: dto.new_date,
      original_date: oldDate,
      status: 'confirmed', // Keep confirmed status
    })
    .eq('id', dto.booking_id)
    .select('*')
    .single();

  if (error) throw new Error(`Reschedule failed: ${error.message}`);

  // Update Google Calendar event
  if (current.google_event_id) {
    try {
      await updateCalendarEvent(current.google_event_id, {
        startTime: dto.new_date,
        durationMinutes: current.service.duration_min,
      });
    } catch (calError) {
      console.error('[BookingService] Calendar update failed:', calError);
    }
  }

  // Notify client
  if (dto.notify_client && oldDate) {
    try {
      await sendRescheduledEmail({
        clientEmail: current.client.email,
        clientName: current.client.full_name,
        oldDate,
        newDate: dto.new_date,
      });
    } catch (emailError) {
      console.error('[BookingService] Reschedule email failed:', emailError);
    }
  }

  return updated;
}

// ─── Create Payment Link (Admin) ──────────────────────────

export async function createPaymentLink(dto: CreatePaymentLinkDTO) {
  // 1. Get booking + client + settings
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, client:clients(*)')
    .eq('id', dto.booking_id)
    .single();

  if (!booking) throw new Error('Booking not found');

  const { data: settings } = await supabase
    .from('admin_settings')
    .select('paypal_surcharge_pct')
    .single();

  const surchargePercent = dto.provider === 'paypal'
    ? (settings?.paypal_surcharge_pct || 10)
    : 0;

  const surchargeAmount = dto.amount * (surchargePercent / 100);
  const total = Math.round((dto.amount + surchargeAmount) * 100) / 100;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (dto.expires_hours || 48));

  // 2. Cancel any existing active payment links for this booking
  await supabase
    .from('payment_links')
    .update({ status: 'cancelled' })
    .eq('booking_id', dto.booking_id)
    .eq('status', 'active');

  // 3. Create link via provider
  let url: string;
  let providerLinkId: string;

  if (dto.provider === 'stripe') {
    const result = await createStripePaymentLink({
      amount: dto.amount,
      bookingId: dto.booking_id,
      clientEmail: booking.client.email,
      clientName: booking.client.full_name,
      description: 'Sesión de terapia online',
      expiresAt,
    });
    url = result.url;
    providerLinkId = result.providerLinkId;
  } else {
    const result = await createPayPalOrder({
      amount: dto.amount,
      surchargePercent,
      bookingId: dto.booking_id,
      clientName: booking.client.full_name,
      description: 'Sesión de terapia online',
    });
    url = result.url;
    providerLinkId = result.providerLinkId;
  }

  // 4. Store in DB
  const { data: link, error } = await supabase
    .from('payment_links')
    .insert({
      booking_id: dto.booking_id,
      provider: dto.provider,
      provider_link_id: providerLinkId,
      url,
      amount: dto.amount,
      surcharge_pct: surchargePercent,
      total,
      expires_at: expiresAt.toISOString(),
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to store payment link: ${error.message}`);

  // 5. Update booking status + agreed price
  await supabase
    .from('bookings')
    .update({
      status: 'payment_pending',
    })
    .eq('id', dto.booking_id);

  // 6. Send email to client
  try {
    await sendPaymentLinkEmail({
      clientEmail: booking.client.email,
      clientName: booking.client.full_name,
      amount: dto.amount,
      total,
      provider: dto.provider,
      paymentUrl: url,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (emailError) {
    console.error('[BookingService] Payment link email failed:', emailError);
  }

  return link;
}

// ─── Handle Payment Confirmation (Webhook) ────────────────

export async function handlePaymentConfirmed(params: {
  bookingId: string;
  provider: 'stripe' | 'paypal';
  providerTxId: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  // 1. Record payment
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, client:clients(*), service:services(*)')
    .eq('id', params.bookingId)
    .single();

  if (!booking) {
    console.error(`[Webhook] Booking ${params.bookingId} not found`);
    return;
  }

  const surchargePercent = params.provider === 'paypal' ? 10 : 0;

  await supabase.from('payments').insert({
    booking_id: params.bookingId,
    provider: params.provider,
    provider_tx_id: params.providerTxId,
    amount: params.amount,
    surcharge_pct: surchargePercent,
    total: params.amount,
    currency: params.currency,
    status: 'completed',
    provider_metadata: params.metadata || {},
    paid_at: new Date().toISOString(),
  });

  // 2. Update payment link status
  await supabase
    .from('payment_links')
    .update({ status: 'paid' })
    .eq('booking_id', params.bookingId)
    .eq('status', 'active');

  // 3. Confirm booking (creates calendar event + emails)
  await confirmBooking(booking);
}
