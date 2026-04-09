'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getClientTime } from '@/lib/utils/timezone';

// ============================================================
// Dashboard Server Actions — CRUD for all dashboard sections
// ============================================================

const DASH = '/admin/dashboard';

async function getSupabase() {
  return createServerSupabaseClient();
}

// ─── Admin Profile (Mi Cuenta) ──────────────────────────────

export async function updateProfile(data: {
  nombre: string;
  especialidad: string;
  cedula: string;
  email: string;
  telefono: string;
  direccion: string;
  horario: string;
  bio: string;
  working_hours?: Record<string, { start: string; end: string; enabled: boolean }>;
}) {
  const supabase = await getSupabase();
  const update: Record<string, unknown> = {
    nombre: data.nombre,
    especialidad: data.especialidad,
    cedula: data.cedula,
    notification_email: data.email,
    telefono: data.telefono,
    direccion: data.direccion,
    horario: data.horario,
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
  const phone = data.telefono?.replace(/[^+\d]/g, '') || '';
  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name: data.nombre },
    ...(phone.length >= 8 ? { phone } : {}),
  });
  if (authError) {
    console.error('[Profile] auth.updateUser error:', authError.message);
  }

  revalidatePath(DASH);
  return { success: true };
}

export async function updateNotepad(text: string) {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('admin_settings')
    .update({ notepad: text })
    .not('id', 'is', null);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateNickname(name: string) {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('admin_settings')
    .update({ nickname: name })
    .not('id', 'is', null);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

export async function updateContactInfo(data: { contact_email?: string; contact_phone?: string }) {
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

export async function upsertService(data: {
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
  const supabase = await getSupabase();
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

export async function toggleServiceActive(id: string, active: boolean) {
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

export async function upsertInvoice(data: {
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
  const supabase = await getSupabase();
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

// ─── Bookings (Calendario) ──────────────────────────────────

export async function upsertBooking(data: {
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

export async function upsertPaymentMethod(data: {
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
  const supabase = await getSupabase();
  const { error } = await supabase.from('payment_methods').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

export async function togglePaymentMethodActive(id: string, activo: boolean) {
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

export async function upsertAdminLink(data: { id?: string; title: string; url: string }) {
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
  const supabase = await getSupabase();
  const { error } = await supabase.from('admin_links').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}

// ─── Security Question ─────────────────────────────────────

export async function updateSecurityQuestion(question: string, answer: string) {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('admin_settings')
    .update({ security_question: question, security_answer: answer })
    .not('id', 'is', null);
  if (error) return { success: false, error: error.message };
  revalidatePath(DASH);
  return { success: true };
}
