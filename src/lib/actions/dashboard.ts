'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getClientTime } from '@/lib/utils/timezone';
import { sendInvoiceEmail } from '@/lib/adapters/email';
import {
  updateProfileSchema,
  upsertServiceSchema,
  upsertInvoiceSchema,
  upsertBookingDashboardSchema,
  upsertPaymentMethodSchema,
  upsertAdminLinkSchema,
  updateSecurityQuestionSchema,
  updateNotepadSchema,
  updateNicknameSchema,
  updateContactInfoSchema,
} from '@/lib/validators/schemas';

// ============================================================
// Dashboard Server Actions — CRUD for all dashboard sections
// ============================================================

const DASH = '/admin/dashboard';

async function getSupabase() {
  return createServerSupabaseClient();
}

// ─── Admin Profile (Mi Cuenta) ──────────────────────────────

export async function updateProfile(raw: {
  nombre: string;
  especialidad: string;
  cedula: string;
  email: string;
  telefono: string;
  direccion: string;
  bio: string;
  working_hours?: Record<string, { enabled: boolean; ranges: { start: string; end: string }[] }>;
}) {
  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'Datos de perfil inválidos' };
  const data = parsed.data;
  const supabase = await getSupabase();
  const update: Record<string, unknown> = {
    nombre: data.nombre,
    especialidad: data.especialidad,
    cedula: data.cedula,
    notification_email: data.email,
    telefono: data.telefono,
    direccion: data.direccion,
    bio: data.bio,
  };
  if (data.working_hours) {
    update.working_hours = data.working_hours;
  }
  const { error } = await supabase
    .from('admin_settings')
    .update(update)
    .not('id', 'is', null); // update the single row
  if (error) return { success: false, error: error.message };

  // Sync display name and phone to Supabase Auth user metadata
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const admin = createAdminClient();
    const phone = data.telefono?.replace(/[^+\d]/g, '') || '';
    const authUpdate: Record<string, unknown> = {
      user_metadata: { full_name: data.nombre },
    };
    if (phone.length >= 8) authUpdate.phone = phone;
    const { error: authError } = await admin.auth.admin.updateUserById(user.id, authUpdate);
    if (authError) {
      console.error('[Profile] admin.updateUserById error:', authError.message);
    }
  }

  revalidatePath(DASH);
  return { success: true };
}

export async function updateAuthPassword(currentPassword: string, newPassword: string) {
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'La contraseña debe tener al menos 8 caracteres' };
  }

  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return { success: false, error: 'No autenticado' };

  // Verify current password by attempting sign-in
  const admin = createAdminClient();
  const { error: signInError } = await admin.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) return { success: false, error: 'Contraseña actual incorrecta' };

  // Update password using admin client
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateAuthEmail(newEmail: string) {
  if (!newEmail || !newEmail.includes('@') || newEmail.length > 320) {
    return { success: false, error: 'Email inválido' };
  }

  // Get current user ID from the authenticated session
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'No autenticado' };

  // Use admin client to change email directly (no confirmation needed)
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email: newEmail,
    email_confirm: true,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

export async function updateNotepad(text: string) {
  const parsed = updateNotepadSchema.safeParse({ text });
  if (!parsed.success) return { success: false, error: 'Texto demasiado largo' };
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('admin_settings')
    .update({ notepad: parsed.data.text })
    .not('id', 'is', null);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateNickname(name: string) {
  const parsed = updateNicknameSchema.safeParse({ name });
  if (!parsed.success) return { success: false, error: 'Nombre inválido' };
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('admin_settings')
    .update({ nickname: parsed.data.name })
    .not('id', 'is', null);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

export async function updateContactInfo(raw: { contact_email?: string; contact_phone?: string }) {
  const parsed = updateContactInfoSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'Datos de contacto inválidos' };
  const data = parsed.data;
  const supabase = await getSupabase();
  const update: Record<string, string> = {};
  if (data.contact_email !== undefined) update.contact_email = data.contact_email;
  if (data.contact_phone !== undefined) update.contact_phone = data.contact_phone;
  const { error } = await supabase
    .from('admin_settings')
    .update(update)
    .not('id', 'is', null);
  if (error) return { success: false, error: error.message };
  revalidatePath('/');
  revalidatePath(DASH);
  return { success: true };
}

// ─── Services ───────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function upsertService(raw: {
  id?: string;
  nombre: string;
  descripcion: string;
  color: string;
  active?: boolean;
  duracion?: number;
  precio?: string | null;
  is_free?: boolean;
  modalidad?: string;
  features?: string[];
  tag?: string;
  typeLabel?: string;
  subtitle?: string;
}) {
  const parsed = upsertServiceSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'Datos de servicio inválidos' };
  const data = parsed.data;
  const supabase = await getSupabase();
  const slug = toSlug(data.nombre);

  const row = {
    name: data.nombre,
    slug,
    description: data.descripcion,
    color: data.color,
    active: data.active ?? true,
    duration_min: data.duracion ?? 50,
    price: data.precio || null,
    is_free: data.is_free ?? false,
    modality: data.modalidad || 'Online · Videollamada',
    features: data.features ?? [],
    tag: data.tag || null,
    type_label: data.typeLabel || null,
    subtitle: data.subtitle || null,
  };

  if (data.id) {
    const { error } = await supabase
      .from('services')
      .update(row)
      .eq('id', data.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase
      .from('services')
      .insert(row);
    if (error) return { success: false, error: error.message };
  }
  revalidatePath(DASH);
  revalidatePath('/services');
  return { success: true };
}

export async function deleteService(id: string) {
  if (!id || typeof id !== 'string' || id.length > 50) return { success: false, error: 'ID inválido' };
  const supabase = await getSupabase();
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

export async function toggleServiceActive(id: string, active: boolean) {
  if (!id || typeof id !== 'string' || id.length > 50) return { success: false, error: 'ID inválido' };
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('services')
    .update({ active })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

// ─── Invoices (Facturas) ────────────────────────────────────

export async function upsertInvoice(raw: {
  id?: string;
  paciente: string;
  email?: string;
  telefono?: string;
  cedula?: string;
  pais?: string;
  direccion?: string;
  concepto: string;
  monto: number;
  estado: string;
  link?: string;
  booking_id?: string | null;
}) {
  const parsed = upsertInvoiceSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'Datos de factura inválidos' };
  const data = parsed.data;
  const supabase = await getSupabase();

  const row = {
    paciente: data.paciente,
    email: data.email || null,
    telefono: data.telefono || null,
    cedula: data.cedula || null,
    pais: data.pais || null,
    direccion: data.direccion || null,
    concepto: data.concepto,
    monto: data.monto,
    estado: data.estado,
    link: data.link || null,
    booking_id: data.booking_id || null,
  };

  if (data.id) {
    const { error } = await supabase
      .from('invoices')
      .update(row)
      .eq('id', data.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { data: created, error } = await supabase
      .from('invoices')
      .insert(row)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath(DASH);
    return { success: true, data: created };
  }
  revalidatePath(DASH);
  return { success: true };
}

export async function deleteInvoice(id: string) {
  if (!id || typeof id !== 'string' || id.length > 50) return { success: false, error: 'ID inválido' };
  const supabase = await getSupabase();
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

export async function sendInvoiceNotification(inv: { paciente: string; email: string; concepto: string; monto: number; estado: string; fecha: string }, paymentMethods: { nombre: string; instrucciones?: string }[]) {
  if (!inv.email || !inv.email.includes('@')) return { success: false, error: 'Email del cliente requerido' };
  try {
    await sendInvoiceEmail({
      clientEmail: inv.email,
      clientName: inv.paciente,
      concepto: inv.concepto,
      monto: inv.monto,
      estado: inv.estado,
      fecha: inv.fecha,
      paymentMethods: paymentMethods.filter(m => m.nombre),
    });
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    return { success: false, error: msg };
  }
}

// ─── Bookings (Calendario) ──────────────────────────────────

export async function upsertBooking(raw: {
  id?: string;
  paciente: string;
  email: string;
  telefono: string;
  fecha: string;
  hora: string;
  duracion: number;
  tipo: string;
  notas: string;
  estado: string;
  pais?: string;
  serviceId?: string;
}) {
  const parsed = upsertBookingDashboardSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'Datos de reserva inválidos' };
  const data = parsed.data;
  const supabase = await getSupabase();

  // For bookings, the dashboard uses a simplified view.
  // We need to find-or-create the client, then upsert the booking.
  // First, find or create client
  let clientId: string;
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('email', data.email)
    .limit(1)
    .single();

  if (existing) {
    clientId = existing.id;
    // Update country if provided
    if (data.pais) {
      await supabase.from('clients').update({ country: data.pais }).eq('id', clientId);
    }
  } else {
    const { data: newClient, error: clientErr } = await supabase
      .from('clients')
      .insert({
        full_name: data.paciente,
        email: data.email,
        phone: data.telefono,
        country: data.pais || null,
      })
      .select('id')
      .single();
    if (clientErr || !newClient) return { success: false, error: clientErr?.message || 'Failed to create client' };
    clientId = newClient.id;
  }

  // Build the preferred_date from fecha + hora (Eastern time)
  const preferredDate = `${data.fecha}T${data.hora}:00`;

  // Compute client-local time if state differs from Florida (base)
  const clientLocalTime = data.pais && data.pais !== 'Florida' && data.pais !== 'Otro' && data.fecha && data.hora
    ? getClientTime(data.fecha, data.hora, data.pais)
    : null;

  // Use provided serviceId, fall back to name match, then first service
  let serviceId = data.serviceId;
  if (!serviceId) {
    const { data: svcByName } = await supabase
      .from('services').select('id').eq('name', data.tipo).limit(1).single();
    serviceId = svcByName?.id;
    if (!serviceId) {
      const { data: svc } = await supabase
        .from('services').select('id').limit(1).single();
      serviceId = svc?.id;
    }
  }

  if (!serviceId) return { success: false, error: 'No services found' };

  const statusMap: Record<string, string> = {
    'confirmada': 'confirmed', 'confirmed': 'confirmed',
    'cancelada': 'cancelled', 'cancelled': 'cancelled',
    'completada': 'completed', 'completed': 'completed',
    'rechazada': 'rejected', 'rejected': 'rejected',
  };
  const bookingStatus = statusMap[data.estado] || 'pending';

  // Check for time slot conflicts (skip cancelled/rejected)
  if (bookingStatus !== 'cancelled' && bookingStatus !== 'rejected') {
    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id, preferred_date, service:services(duration_min)')
      .not('status', 'in', '("cancelled","rejected")')
      .gte('preferred_date', data.fecha + 'T00:00:00')
      .lt('preferred_date', data.fecha + 'T23:59:59');

    if (conflicts && conflicts.length > 0) {
      const [rh, rm] = data.hora.split(':').map(Number);
      const reqStart = rh * 60 + rm;
      const reqEnd = reqStart + Number(data.duracion);
      for (const ex of conflicts) {
        if (data.id && ex.id === data.id) continue; // skip self on edit
        // Extract time from string directly — avoids Date TZ issues
        const exTimeStr = String(ex.preferred_date || '');
        const exTimePart = exTimeStr.includes('T') ? exTimeStr.split('T')[1].slice(0, 5) : '';
        if (!exTimePart) continue;
        const [eh, em] = exTimePart.split(':').map(Number);
        const exStart = eh * 60 + em;
        const exDur = (ex.service as any)?.duration_min || 60;
        const exEnd = exStart + exDur;
        if (reqStart < exEnd && reqEnd > exStart) {
          return { success: false, error: 'Ya existe una reserva en ese horario. Cambia la hora o la fecha.' };
        }
      }
    }
  }

  if (data.id) {
    const { error } = await supabase
      .from('bookings')
      .update({
        service_id: serviceId,
        preferred_date: preferredDate,
        status: bookingStatus,
        admin_notes: data.notas || null,
        client_local_time: clientLocalTime,
      })
      .eq('id', data.id);
    if (error) return { success: false, error: error.message };
  } else {
    const idempotencyKey = `dash-${clientId.slice(0,8)}-${data.fecha}-${data.hora}-${Date.now()}`;
    const { error } = await supabase
      .from('bookings')
      .insert({
        client_id: clientId,
        service_id: serviceId,
        preferred_date: preferredDate,
        status: bookingStatus,
        admin_notes: data.notas || null,
        client_local_time: clientLocalTime,
        idempotency_key: idempotencyKey,
      });
    if (error) return { success: false, error: error.message };
  }
  revalidatePath(DASH);
  return { success: true };
}

export async function deleteBooking(id: string, deletePaymentLinks = false) {
  if (!id || typeof id !== 'string' || id.length > 50) return { success: false, error: 'ID inválido' };
  const supabase = await getSupabase();
  if (deletePaymentLinks) {
    // Delete payment links associated with this booking before deleting the booking
    await supabase.from('payment_links').delete().eq('booking_id', id);
  }
  // With ON DELETE SET NULL, remaining payment links will have booking_id set to null
  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

export async function linkPaymentLinkToBooking(paymentLinkId: string, bookingId: string) {
  if (!paymentLinkId || !bookingId || paymentLinkId.length > 50 || bookingId.length > 50) return { success: false, error: 'ID inválido' };
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('payment_links')
    .update({ booking_id: bookingId })
    .eq('id', paymentLinkId);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

export async function unlinkPaymentLinkFromBooking(paymentLinkId: string) {
  if (!paymentLinkId || paymentLinkId.length > 50) return { success: false, error: 'ID inválido' };
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('payment_links')
    .update({ booking_id: null })
    .eq('id', paymentLinkId);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

export async function updateBookingStatus(id: string, status: string) {
  if (!id || id.length > 50 || !status || status.length > 50) return { success: false, error: 'Datos inválidos' };
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

// ─── Payment Methods (Métodos de Pago) ──────────────────────

export async function upsertPaymentMethod(raw: {
  id?: string;
  tipo: string;
  nombre: string;
  banco?: string;
  titular?: string;
  cuentaVisible?: string;
  cuentaCompleta?: string;
  moneda?: string;
  tiempoConfirm?: string;
  instrucciones?: string;
  notasInternas?: string;
  correoProveedor?: string;
  comision?: string;
  estadoConexion?: string;
  monedasAceptadas?: string;
  pagosRecurrentes?: boolean;
  clavePublica?: string;
  claveSecreta?: string;
  idComercio?: string;
  tipoCuenta?: string;
  tiempoAcredit?: string;
  politicaReembolso?: string;
  activo?: boolean;
  prioridad?: number;
  recargoPct?: number;
  color?: string;
}) {
  const parsed = upsertPaymentMethodSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    console.error('[PaymentMethod] Validation failed:', fieldErrors);
    return { success: false, error: `Datos inválidos: ${fieldErrors}` };
  }
  const data = parsed.data;
  const supabase = await getSupabase();

  const row = {
    tipo: data.tipo,
    nombre: data.nombre,
    banco: data.banco || null,
    titular: data.titular || null,
    cuenta_visible: data.cuentaVisible || null,
    cuenta_completa: data.cuentaCompleta || null,
    moneda: data.moneda || 'USD',
    tiempo_confirm: data.tiempoConfirm || null,
    instrucciones: data.instrucciones || null,
    notas_internas: data.notasInternas || null,
    correo_proveedor: data.correoProveedor || null,
    comision: data.comision || null,
    estado_conexion: data.estadoConexion || 'desconectado',
    monedas_aceptadas: data.monedasAceptadas || 'USD',
    pagos_recurrentes: data.pagosRecurrentes ?? false,
    clave_publica: data.clavePublica || null,
    clave_secreta: data.claveSecreta || null,
    id_comercio: data.idComercio || null,
    tipo_cuenta: data.tipoCuenta || null,
    tiempo_acredit: data.tiempoAcredit || null,
    politica_reembolso: data.politicaReembolso || null,
    activo: data.activo ?? true,
    prioridad: data.prioridad ?? 1,
    recargo_pct: data.recargoPct ?? 0,
    color: data.color || null,
  };

  if (data.id) {
    const { error } = await supabase
      .from('payment_methods')
      .update(row)
      .eq('id', data.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase
      .from('payment_methods')
      .insert(row);
    if (error) return { success: false, error: error.message };
  }
  revalidatePath(DASH);
  return { success: true };
}

export async function deletePaymentMethod(id: string) {
  if (!id || id.length > 50) return { success: false, error: 'ID inválido' };
  const supabase = await getSupabase();
  const { error } = await supabase.from('payment_methods').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

export async function togglePaymentMethodActive(id: string, activo: boolean) {
  if (!id || id.length > 50) return { success: false, error: 'ID inválido' };
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('payment_methods')
    .update({ activo })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

// ─── Admin Links (Tutoriales) ──────────────────────────────

export async function upsertAdminLink(raw: { id?: string; title: string; url: string }) {
  const parsed = upsertAdminLinkSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'Datos de enlace inválidos' };
  const data = parsed.data;
  const supabase = await getSupabase();
  if (data.id) {
    const { error } = await supabase
      .from('admin_links')
      .update({ title: data.title, url: data.url })
      .eq('id', data.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase
      .from('admin_links')
      .insert({ title: data.title, url: data.url });
    if (error) return { success: false, error: error.message };
  }
  revalidatePath(DASH);
  return { success: true };
}

export async function deleteAdminLink(id: string) {
  if (!id || id.length > 50) return { success: false, error: 'ID inválido' };
  const supabase = await getSupabase();
  const { error } = await supabase.from('admin_links').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

// ─── Availability Exceptions ───────────────────────────────

type ExceptionInput = {
  id?: string;
  title: string;
  type: 'dates' | 'range' | 'recurring';
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  all_day?: boolean;
  days_of_week?: number[] | null;
  notes?: string | null;
  dates?: string[]; // for type='dates'
};

export async function upsertAvailabilityException(input: ExceptionInput) {
  if (!input.title?.trim()) return { success: false, error: 'Título requerido' };
  if (!['dates','range','recurring'].includes(input.type)) return { success: false, error: 'Tipo inválido' };

  const supabase = await getSupabase();

  const parent = {
    title: input.title.trim(),
    type: input.type,
    start_date: input.type === 'dates' ? null : (input.start_date || null),
    end_date:   input.type === 'dates' ? null : (input.end_date   || null),
    all_day:    !!input.all_day,
    start_time: input.all_day ? null : (input.start_time || null),
    end_time:   input.all_day ? null : (input.end_time   || null),
    days_of_week: input.type === 'recurring' ? (input.days_of_week || []) : null,
    notes: input.notes || null,
  };

  if (input.type === 'range') {
    if (!parent.start_date || !parent.end_date) return { success: false, error: 'Rango requiere fecha inicio y fin' };
    if (parent.end_date < parent.start_date) return { success: false, error: 'Fecha fin debe ser ≥ inicio' };
  }
  if (input.type === 'recurring') {
    if (!parent.start_date) return { success: false, error: 'Recurrente requiere fecha inicio' };
    if (!parent.days_of_week || parent.days_of_week.length === 0) return { success: false, error: 'Selecciona al menos un día de la semana' };
  }
  if (input.type === 'dates') {
    if (!input.dates || input.dates.length === 0) return { success: false, error: 'Agrega al menos una fecha' };
  }
  if (!parent.all_day && parent.start_time && parent.end_time && parent.end_time <= parent.start_time) {
    return { success: false, error: 'Hora fin debe ser mayor a hora inicio' };
  }

  let excId = input.id;
  if (excId) {
    const { error } = await supabase.from('availability_exceptions').update(parent).eq('id', excId);
    if (error) return { success: false, error: error.message };
  } else {
    const { data, error } = await supabase.from('availability_exceptions').insert(parent).select('id').single();
    if (error) return { success: false, error: error.message };
    excId = data!.id;
  }

  if (input.type === 'dates') {
    await supabase.from('availability_exception_dates').delete().eq('exception_id', excId);
    const rows = (input.dates || []).map(d => ({ exception_id: excId, date: d }));
    if (rows.length > 0) {
      const { error } = await supabase.from('availability_exception_dates').insert(rows);
      if (error) return { success: false, error: error.message };
    }
  } else {
    await supabase.from('availability_exception_dates').delete().eq('exception_id', excId);
  }

  revalidatePath(DASH);
  return { success: true, id: excId };
}

// ─── Integrations (SMTP + WhatsApp Templates) ───────────

export async function updateIntegrations(raw: {
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_user?: string | null;
  smtp_password?: string | null;
  smtp_from_email?: string | null;
  smtp_from_name?: string | null;
  smtp_secure?: boolean | null;
}) {
  const supabase = await getSupabase();
  const update: Record<string, string | number | boolean | null> = {};
  if (raw.smtp_host !== undefined)       update.smtp_host       = raw.smtp_host       || null;
  if (raw.smtp_port !== undefined)       update.smtp_port       = raw.smtp_port ?? null;
  if (raw.smtp_user !== undefined)       update.smtp_user       = raw.smtp_user       || null;
  if (raw.smtp_password !== undefined)   update.smtp_password   = raw.smtp_password   || null;
  if (raw.smtp_from_email !== undefined) update.smtp_from_email = raw.smtp_from_email || null;
  if (raw.smtp_from_name !== undefined)  update.smtp_from_name  = raw.smtp_from_name  || null;
  if (raw.smtp_secure !== undefined)     update.smtp_secure     = raw.smtp_secure ?? null;
  if (Object.keys(update).length === 0) return { success: true };
  const { error } = await supabase.from('admin_settings').update(update).not('id', 'is', null);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

export async function updateWaTemplates(templates: Record<string, string>) {
  if (!templates || typeof templates !== 'object') {
    return { success: false, error: 'Plantillas inválidas' };
  }
  // Sanitize: keep only string values, cap length per template
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(templates)) {
    if (typeof v === 'string') clean[k] = v.slice(0, 2000);
  }
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('admin_settings')
    .update({ wa_templates: clean })
    .not('id', 'is', null);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

export async function deleteAvailabilityException(id: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.from('availability_exceptions').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

// ─── Security Question ─────────────────────────────────────

export async function updateSecurityQuestion(question: string, answer: string) {
  const parsed = updateSecurityQuestionSchema.safeParse({ question, answer });
  if (!parsed.success) return { success: false, error: 'Datos de pregunta de seguridad inválidos' };
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('admin_settings')
    .update({ security_question: parsed.data.question, security_answer: parsed.data.answer })
    .not('id', 'is', null);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}
