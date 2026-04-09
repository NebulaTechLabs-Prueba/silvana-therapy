import { z } from 'zod';

// ─── Public Booking Form ──────────────────────────────────

export const createBookingSchema = z.object({
  full_name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre es demasiado largo'),
  email: z
    .string()
    .email('Email inválido')
    .max(255),
  phone: z
    .string()
    .max(20)
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
