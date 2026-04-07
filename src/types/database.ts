// ============================================================
// Database Types — Auto-aligned with Supabase schema
// ============================================================

// ─── Enums ────────────────────────────────────────────────

export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'payment_pending'
  | 'confirmed'
  | 'rescheduled'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export type PaymentStatus =
  | 'pending'
  | 'completed'
  | 'failed';

export type PaymentProvider = 'stripe' | 'paypal';

export type PaymentLinkStatus = 'active' | 'paid' | 'expired' | 'cancelled';

// ─── Tables ───────────────────────────────────────────────

export interface Client {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  country: string | null;
  reason: string | null;
  is_returning: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  slug: string | null;
  subtitle: string | null;
  tag: string | null;
  type_label: string | null;
  description: string | null;
  duration_min: number;
  price: string | null;
  is_free: boolean;
  active: boolean;
  sort_order: number;
  modality: string | null;
  features: string[];
  color: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  client_id: string;
  service_id: string;
  status: BookingStatus;
  preferred_date: string | null;
  confirmed_date: string | null;
  original_date: string | null;
  agreed_price: number | null;
  payment_provider: PaymentProvider | null;
  google_event_id: string | null;
  is_first_session: boolean;
  admin_notes: string | null;
  rejection_reason: string | null;
  idempotency_key: string | null;
  preferred_payment: string | null;
  client_local_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  provider: PaymentProvider;
  provider_tx_id: string | null;
  amount: number;
  surcharge_pct: number;
  total: number;
  currency: string;
  status: PaymentStatus;
  provider_metadata: Record<string, unknown>;
  paid_at: string | null;
  created_at: string;
}

export interface PaymentLink {
  id: string;
  booking_id: string | null;
  provider: PaymentProvider;
  provider_link_id: string | null;
  url: string;
  amount: number;
  surcharge_pct: number;
  total: number;
  status: PaymentLinkStatus;
  expires_at: string | null;
  created_at: string;
}

export interface AdminSettings {
  id: string;
  default_price: number;
  paypal_surcharge_pct: number;
  notification_email: string;
  google_calendar_id: string | null;
  working_hours: WorkingHours;
  // Profile fields (Mi Cuenta)
  nombre: string;
  especialidad: string;
  cedula: string | null;
  telefono: string | null;
  direccion: string | null;
  horario: string | null;
  bio: string | null;
  notepad: string | null;
  updated_at: string;
}

export interface WorkingHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  start: string; // "09:00"
  end: string;   // "18:00"
  enabled: boolean;
}

// ─── Invoices ────────────────────────────────────────────

export type InvoiceStatus = 'pendiente' | 'pagada' | 'vencida' | 'cancelada';

export interface Invoice {
  id: string;
  paciente: string;
  email: string | null;
  concepto: string;
  monto: number;
  estado: InvoiceStatus;
  fecha: string;
  link: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Payment Methods Config ──────────────────────────────

export type PaymentMethodType = 'Transferencia' | 'Tarjeta' | 'PayPal' | 'Efectivo' | 'Otro';

export interface PaymentMethod {
  id: string;
  tipo: PaymentMethodType;
  nombre: string;
  banco: string | null;
  titular: string | null;
  cuenta_visible: string | null;
  cuenta_completa: string | null;
  moneda: string;
  tiempo_confirm: string | null;
  instrucciones: string | null;
  notas_internas: string | null;
  correo_proveedor: string | null;
  comision: string | null;
  estado_conexion: string | null;
  monedas_aceptadas: string | null;
  pagos_recurrentes: boolean;
  clave_publica: string | null;
  clave_secreta: string | null;
  id_comercio: string | null;
  tipo_cuenta: string | null;
  tiempo_acredit: string | null;
  politica_reembolso: string | null;
  activo: boolean;
  prioridad: number;
  created_at: string;
  updated_at: string;
}

// ─── Joins / Views ────────────────────────────────────────

export interface BookingWithClient extends Booking {
  client: Client;
  service: Service;
  payments: Payment[];
  payment_links: PaymentLink[];
}

// ─── API DTOs ─────────────────────────────────────────────

export interface CreateBookingDTO {
  full_name: string;
  email: string;
  phone?: string;
  country?: string;
  reason?: string;
  preferred_date?: string;
  service_id: string;
  idempotency_key: string;
  preferred_payment?: string;
  client_local_time?: string;
}

export interface AcceptBookingDTO {
  booking_id: string;
  confirmed_date: string;
  admin_notes?: string;
}

export interface RejectBookingDTO {
  booking_id: string;
  rejection_reason?: string;
}

export interface RescheduleBookingDTO {
  booking_id: string;
  new_date: string;
  notify_client?: boolean;
}

export interface CreatePaymentLinkDTO {
  booking_id: string;
  provider: PaymentProvider;
  amount: number;
  expires_hours?: number; // default 48
}
