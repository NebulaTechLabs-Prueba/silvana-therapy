'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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
}) {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('admin_settings')
    .update({
      nombre: data.nombre,
      especialidad: data.especialidad,
      cedula: data.cedula,
      notification_email: data.email,
      telefono: data.telefono,
      direccion: data.direccion,
      horario: data.horario,
      bio: data.bio,
    })
    .not('id', 'is', null); // update the single row
  if (error) return { success: false, error: error.message };
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

// ─── Services ───────────────────────────────────────────────

export async function upsertService(data: {
  id?: string;
  nombre: string;
  descripcion: string;
  color: string;
  active?: boolean;
}) {
  const supabase = await getSupabase();

  if (data.id) {
    // Update
    const { error } = await supabase
      .from('services')
      .update({
        name: data.nombre,
        description: data.descripcion,
        color: data.color,
        active: data.active ?? true,
      })
      .eq('id', data.id);
    if (error) return { success: false, error: error.message };
  } else {
    // Insert
    const { error } = await supabase
      .from('services')
      .insert({
        name: data.nombre,
        description: data.descripcion,
        color: data.color,
        active: data.active ?? true,
      });
    if (error) return { success: false, error: error.message };
  }
  revalidatePath(DASH);
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
  concepto: string;
  monto: number;
  estado: string;
  link?: string;
}) {
  const supabase = await getSupabase();

  if (data.id) {
    const { error } = await supabase
      .from('invoices')
      .update({
        paciente: data.paciente,
        email: data.email || null,
        concepto: data.concepto,
        monto: data.monto,
        estado: data.estado,
        link: data.link || null,
      })
      .eq('id', data.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { data: row, error } = await supabase
      .from('invoices')
      .insert({
        paciente: data.paciente,
        email: data.email || null,
        concepto: data.concepto,
        monto: data.monto,
        estado: data.estado,
        link: data.link || null,
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath(DASH);
    return { success: true, data: row };
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
  } else {
    const { data: newClient, error: clientErr } = await supabase
      .from('clients')
      .insert({
        full_name: data.paciente,
        email: data.email,
        phone: data.telefono,
      })
      .select('id')
      .single();
    if (clientErr || !newClient) return { success: false, error: clientErr?.message || 'Failed to create client' };
    clientId = newClient.id;
  }

  // Build the preferred_date from fecha + hora
  const preferredDate = `${data.fecha}T${data.hora}:00`;

  // Find a service matching the tipo, or use the first service
  const { data: svc } = await supabase
    .from('services')
    .select('id')
    .limit(1)
    .single();
  const serviceId = svc?.id;

  if (!serviceId) return { success: false, error: 'No services found' };

  const bookingStatus = data.estado === 'confirmada' ? 'confirmed' : 'pending';

  if (data.id) {
    const { error } = await supabase
      .from('bookings')
      .update({
        preferred_date: preferredDate,
        status: bookingStatus,
        admin_notes: data.notas || null,
      })
      .eq('id', data.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase
      .from('bookings')
      .insert({
        client_id: clientId,
        service_id: serviceId,
        preferred_date: preferredDate,
        status: bookingStatus,
        admin_notes: data.notas || null,
      });
    if (error) return { success: false, error: error.message };
  }
  revalidatePath(DASH);
  return { success: true };
}

export async function deleteBooking(id: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.from('bookings').delete().eq('id', id);
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
