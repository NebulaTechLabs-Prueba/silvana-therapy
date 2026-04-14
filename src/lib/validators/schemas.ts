import { z } from 'zod';

// ─── Public Booking Form ──────────────────────────────────

export const createBookingSchema = z.object({
  full_name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre es demasiado largo')
    .regex(/^[^\d]+$/, 'El nombre no puede contener números'),
  email: z
    .string()
    .email('Email inválido')
    .max(255),
  phone: z
    .string()
    .max(20)
    .regex(/^[^a-zA-Z]*$/, 'El teléfono no puede contener letras')
    .optional(),
  country: z
    .string()
    .max(100)
    .optional(),
  reason: z
    .string()
    .max(2000, 'El motivo no puede exceder 2000 caracteres')
    .optional(),
  preferred_date: z
    .string()
    .optional(),
  service_id: z
    .string()
    .uuid('Servicio inválido'),
  idempotency_key: z
    .string()
    .min(10)
    .max(64),
  preferred_payment: z
    .string()
    .max(100)
    .optional(),
  client_local_time: z
    .string()
    .max(10)
    .optional(),
});

// ─── Admin: Accept Booking ────────────────────────────────

export const acceptBookingSchema = z.object({
  booking_id: z.string().uuid(),
  confirmed_date: z.string().datetime({ offset: true, message: 'Fecha inválida' }),
  admin_notes: z.string().max(2000).optional(),
});

// ─── Admin: Reject Booking ────────────────────────────────

export const rejectBookingSchema = z.object({
  booking_id: z.string().uuid(),
  rejection_reason: z.string().max(1000).optional(),
});

// ─── Admin: Reschedule Booking ────────────────────────────

export const rescheduleBookingSchema = z.object({
  booking_id: z.string().uuid(),
  new_date: z.string().datetime({ offset: true, message: 'Fecha inválida' }),
  notify_client: z.boolean().default(true),
});

// ─── Admin: Create Payment Link ───────────────────────────

export const createPaymentLinkSchema = z.object({
  booking_id: z.string().uuid(),
  provider: z.enum(['stripe', 'paypal']),
  amount: z
    .number()
    .positive('El monto debe ser positivo')
    .max(10000, 'El monto es demasiado alto'),
  expires_hours: z
    .number()
    .int()
    .min(1)
    .max(168) // max 1 week
    .default(48),
});

// ─── Admin: Update Settings ───────────────────────────────

export const updateSettingsSchema = z.object({
  default_price: z.number().positive().optional(),
  paypal_surcharge_pct: z.number().min(0).max(100).optional(),
  notification_email: z.string().email().optional(),
  google_calendar_id: z.string().optional(),
  working_hours: z.record(z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    enabled: z.boolean(),
  })).optional(),
});

// ─── Admin: Login ─────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export const verify2FASchema = z.object({
  code: z.string().length(6, 'El código debe tener 6 dígitos'),
  factorId: z.string(),
});

// ─── Dashboard: Admin Profile ────────────────────────────

export const updateProfileSchema = z.object({
  nombre: z.string().min(1).max(200),
  especialidad: z.string().max(200),
  cedula: z.string().max(50),
  email: z.string().email().max(320),
  telefono: z.string().max(30),
  direccion: z.string().max(300),
  bio: z.string().max(2000),
  working_hours: z.record(z.object({
    enabled: z.boolean(),
    ranges: z.array(z.object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    })).max(3),
  })).optional(),
});

// ─── Dashboard: Service ──────────────────────────────────

export const upsertServiceSchema = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string().min(1).max(200),
  descripcion: z.string().max(2000).default(''),
  color: z.string().max(20).default('#8fb08f'),
  active: z.boolean().optional(),
  duracion: z.number().int().min(1).max(480).optional(),
  precio: z.string().max(20).nullable().optional(),
  is_free: z.boolean().optional(),
  modalidad: z.string().max(200).optional(),
  features: z.array(z.string().max(500)).max(20).optional(),
  tag: z.string().max(100).optional(),
  typeLabel: z.string().max(100).optional(),
  subtitle: z.string().max(200).optional(),
});

// ─── Dashboard: Invoice ──────────────────────────────────

export const upsertInvoiceSchema = z.object({
  id: z.string().uuid().optional(),
  paciente: z.string().min(1).max(200).regex(/^[^\d]+$/, 'El nombre no puede contener números'),
  email: z.string().email().max(320).optional().or(z.literal('')),
  telefono: z.string().max(30).regex(/^[^a-zA-Z]*$/, 'El teléfono no puede contener letras').optional(),
  cedula: z.string().max(30).optional(),
  pais: z.string().max(100).optional(),
  direccion: z.string().max(300).optional(),
  concepto: z.string().min(1).max(300),
  monto: z.number().min(0).max(999999),
  estado: z.enum(['pendiente', 'pagada', 'vencida']),
  link: z.string().url().max(2048).optional().or(z.literal('')),
  booking_id: z.string().uuid().nullable().optional(),
});

// ─── Dashboard: Booking ──────────────────────────────────

export const upsertBookingDashboardSchema = z.object({
  id: z.string().uuid().optional(),
  paciente: z.string().min(1).max(200).regex(/^[^\d]+$/, 'El nombre no puede contener números'),
  email: z.string().email().max(320),
  telefono: z.string().max(30).regex(/^[^a-zA-Z]*$/, 'El teléfono no puede contener letras'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
  duracion: z.number().int().min(1).max(480),
  tipo: z.string().max(200),
  notas: z.string().max(2000).default(''),
  estado: z.string().max(50),
  pais: z.string().max(100).optional(),
  serviceId: z.string().uuid().optional(),
});

// ─── Dashboard: Payment Method ───────────────────────────

export const upsertPaymentMethodSchema = z.object({
  id: z.string().uuid().optional(),
  tipo: z.string().min(1).max(100),
  nombre: z.string().min(1).max(200),
  banco: z.string().max(200).optional(),
  titular: z.string().max(200).optional(),
  cuentaVisible: z.string().max(50).optional(),
  cuentaCompleta: z.string().max(100).optional(),
  moneda: z.string().max(10).optional(),
  tiempoConfirm: z.string().max(50).optional(),
  instrucciones: z.string().max(1000).optional(),
  notasInternas: z.string().max(1000).optional(),
  correoProveedor: z.string().max(320).optional(),
  comision: z.string().max(50).optional(),
  estadoConexion: z.string().max(50).optional(),
  monedasAceptadas: z.string().max(100).optional(),
  pagosRecurrentes: z.boolean().optional(),
  clavePublica: z.string().max(500).optional(),
  claveSecreta: z.string().max(500).optional(),
  idComercio: z.string().max(200).optional(),
  tipoCuenta: z.string().max(50).optional(),
  tiempoAcredit: z.string().max(50).optional(),
  politicaReembolso: z.string().max(500).optional(),
  activo: z.boolean().optional(),
  prioridad: z.number().int().min(0).max(100).optional(),
  recargoPct: z.number().min(0).max(100).optional(),
  color: z.string().max(20).optional(),
});

// ─── Dashboard: Admin Link ───────────────────────────────

export const upsertAdminLinkSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  url: z.string().url().max(2048),
});

// ─── Dashboard: Security Question ────────────────────────

export const updateSecurityQuestionSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(200),
});

// ─── Dashboard: Notepad ──────────────────────────────────

export const updateNotepadSchema = z.object({
  text: z.string().max(10000),
});

// ─── Dashboard: Nickname ─────────────────────────────────

export const updateNicknameSchema = z.object({
  name: z.string().max(100),
});

// ─── Dashboard: Contact Info ─────────────────────────────

export const updateContactInfoSchema = z.object({
  contact_email: z.string().email().max(320).optional(),
  contact_phone: z.string().max(30).optional(),
});
