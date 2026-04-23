import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { createAdminClient } from '@/lib/supabase/admin';
import type { EmailEventKey, EmailRecipient, EmailNotificationPrefs } from '@/types/database';
import { tzShortLabel } from '@/lib/utils/timezone';

/**
 * Email Adapter (SMTP genérico).
 *
 * Proveedor por defecto: Brevo (antes Sendinblue). Cualquier otro proveedor SMTP
 * funciona igual — solo cambian host/puerto/credenciales.
 *
 * Config resolution order (por cada envío):
 *   1. admin_settings.smtp_* (configurado desde la UI de Integraciones)
 *   2. SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / EMAIL_FROM (env fallback)
 *
 * Si ni DB ni env están configurados, el envío se omite con un warning en logs
 * (no rompe los flujos de booking).
 *
 * Zona horaria de las fechas visibles: preferencia `admin_settings.email_display_tz`
 * (configurable desde Mi Cuenta). Default `America/New_York`. Las fechas
 * siempre persisten en UTC; solo cambia la etiqueta y el formato mostrado.
 */

const DEFAULT_TZ = 'America/New_York';
const LOCALE = 'es-US';

/**
 * Lee la TZ configurada para correos al paciente. Fallback al default si
 * la fila/columna no existe (instancias previas a la migración 004).
 */
async function loadEmailDisplayTz(): Promise<string> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('admin_settings')
      .select('email_display_tz')
      .limit(1)
      .single();
    return (data as { email_display_tz?: string } | null)?.email_display_tz || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

interface ResolvedConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

async function resolveConfig(): Promise<ResolvedConfig | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('admin_settings')
      .select('smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_email, smtp_from_name, smtp_secure')
      .limit(1)
      .single();

    const host = (data?.smtp_host?.trim()) || process.env.SMTP_HOST || '';
    const user = (data?.smtp_user?.trim()) || process.env.SMTP_USER || '';
    const password = (data?.smtp_password?.trim()) || process.env.SMTP_PASSWORD || '';
    if (!host || !user || !password) return null;

    const portRaw = data?.smtp_port ?? Number(process.env.SMTP_PORT) ?? 587;
    const port = Number(portRaw) || 587;
    const secure = data?.smtp_secure ?? (port === 465);

    const fromEmail = (data?.smtp_from_email?.trim()) || process.env.EMAIL_FROM || user;
    const fromName = (data?.smtp_from_name?.trim()) || '';
    const from = fromName && !fromEmail.includes('<')
      ? `${fromName} <${fromEmail}>`
      : fromEmail;

    return { host, port, secure, user, password, from };
  } catch {
    const host = process.env.SMTP_HOST || '';
    const user = process.env.SMTP_USER || '';
    const password = process.env.SMTP_PASSWORD || '';
    if (!host || !user || !password) return null;
    const port = Number(process.env.SMTP_PORT) || 587;
    return {
      host,
      port,
      secure: port === 465,
      user,
      password,
      from: process.env.EMAIL_FROM || user,
    };
  }
}

let cachedTransporter: Transporter | null = null;
let cachedKey = '';

function getTransporter(cfg: ResolvedConfig): Transporter {
  const key = `${cfg.host}:${cfg.port}:${cfg.user}`;
  if (cachedTransporter && cachedKey === key) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.password },
  });
  cachedKey = key;
  return cachedTransporter;
}

// ─── Types ────────────────────────────────────────────────

interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(params: EmailParams): Promise<void> {
  const cfg = await resolveConfig();
  if (!cfg) {
    console.warn('[Email] SMTP no configurado — omitiendo envío a', params.to);
    return;
  }

  try {
    const transporter = getTransporter(cfg);
    await transporter.sendMail({
      from: cfg.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  } catch (error: unknown) {
    console.error('[Email] Fallo SMTP:', error);
    throw new Error(`Email send failed: ${(error as Error).message}`);
  }
}

// ─── Notification preferences guard ──────────────────────
//
// Silvana controla desde el dashboard (Integraciones > Notificaciones
// por email) que eventos disparan correo y para que destinatario.
// Los correos de auth (password_reset) NO pasan por aqui — son criticos
// y siempre se envian.
//
// Defaults si no hay config (por si la fila esta vacia o el JSONB es
// null): TRUE. Mas vale sobre-notificar que perder una notificacion.

async function isNotificationEnabled(
  event: EmailEventKey,
  recipient: EmailRecipient,
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('admin_settings')
      .select('email_notifications')
      .limit(1)
      .single();

    const prefs = data?.email_notifications as EmailNotificationPrefs | null;
    if (!prefs) return true;
    const eventPrefs = prefs[event];
    if (!eventPrefs) return true;
    const value = eventPrefs[recipient];
    return value !== false;
  } catch {
    return true;
  }
}

function fmtDate(iso: string, tz: string, withTime = true): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  if (withTime) {
    opts.hour = '2-digit';
    opts.minute = '2-digit';
    opts.hour12 = true;
  }
  return new Intl.DateTimeFormat(LOCALE, opts).format(new Date(iso));
}

// ─── Templates ────────────────────────────────────────────

const brandColor = '#4A6741';
const brandLight = '#F5F7F0';

function wrapTemplate(content: string): string {
  return `
    <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; margin: 0 auto; padding: 32px; color: #333;">
      <div style="border-bottom: 2px solid ${brandColor}; padding-bottom: 16px; margin-bottom: 24px;">
        <h2 style="color: ${brandColor}; margin: 0; font-weight: 400;">
          <em>Lda. Silvana López</em>
        </h2>
        <p style="color: #888; font-size: 13px; margin: 4px 0 0;">Psicoterapia Online</p>
      </div>
      ${content}
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
        <p>Este es un mensaje automático. No responder a este correo.</p>
        <p>© ${new Date().getFullYear()} · Lda. Silvana López · Psicoterapia Online</p>
      </div>
    </div>
  `;
}

// ─── Notification: Booking Received → Client ─────────────

export async function sendBookingReceivedEmail(params: {
  clientEmail: string;
  clientName: string;
  serviceName: string;
  preferredDate?: string;
  isFirstSession: boolean;
  isFree?: boolean;
}): Promise<void> {
  if (!(await isNotificationEnabled('booking_received', 'client'))) return;
  const tz = await loadEmailDisplayTz();
  const tzLabel = tzShortLabel(tz);
  const dateStr = params.preferredDate ? fmtDate(params.preferredDate, tz) : null;

  await sendEmail({
    to: params.clientEmail,
    subject: 'Hemos recibido tu solicitud — Lda. Silvana López',
    html: wrapTemplate(`
      <h3 style="color: ${brandColor};">¡Solicitud recibida!</h3>
      <p>Hola ${params.clientName},</p>
      <p>Tu solicitud de cita ha sido recibida exitosamente.${params.isFree ? ' Este servicio es completamente gratuito.' : ''}</p>
      <div style="background: ${brandLight}; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <p><strong>Servicio:</strong> ${params.serviceName}</p>
        ${dateStr ? `<p><strong>Fecha solicitada:</strong> ${dateStr} (hora ${tzLabel})</p>` : ''}
      </div>
      <p>Revisaré tu solicitud y te confirmaré la cita a la brevedad. Si necesitas comunicarte, puedes escribirme por WhatsApp.</p>
      <p style="color: #888; font-style: italic;">Gracias por tu confianza.</p>
    `),
  });
}

// ─── Notification: New Booking → Silvana ──────────────────

export async function sendNewBookingNotification(params: {
  adminEmail: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  reason?: string;
  preferredDate?: string;
  isFirstSession: boolean;
  isFree?: boolean;
  bookingId: string;
}): Promise<void> {
  if (!(await isNotificationEnabled('booking_received', 'admin'))) return;
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL;
  const tz = await loadEmailDisplayTz();
  const tzLabel = tzShortLabel(tz);

  await sendEmail({
    to: params.adminEmail,
    subject: `Nueva solicitud de cita — ${params.clientName}`,
    html: wrapTemplate(`
      <h3 style="color: ${brandColor};">Nueva solicitud de cita</h3>
      <div style="background: ${brandLight}; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <p><strong>Cliente:</strong> ${params.clientName}</p>
        <p><strong>Email:</strong> ${params.clientEmail}</p>
        ${params.clientPhone ? `<p><strong>Teléfono:</strong> ${params.clientPhone}</p>` : ''}
        ${params.reason ? `<p><strong>Motivo:</strong> ${params.reason}</p>` : ''}
        ${params.preferredDate ? `<p><strong>Fecha preferida:</strong> ${fmtDate(params.preferredDate, tz)} (hora ${tzLabel})</p>` : ''}
        <p><strong>Tipo:</strong> ${params.isFree ? '🟢 Sesión gratuita' : '🔵 Sesión pagada'}</p>
      </div>
      <a href="${adminUrl}/admin/dashboard"
         style="display: inline-block; background: ${brandColor}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 8px;">
        Revisar solicitud
      </a>
    `),
  });
}

// ─── Confirmation: Booking Accepted → Client ──────────────

export async function sendBookingConfirmedEmail(params: {
  clientEmail: string;
  clientName: string;
  confirmedDate: string;
  serviceName: string;
  durationMin: number;
  meetLink?: string | null;
}): Promise<void> {
  if (!(await isNotificationEnabled('booking_confirmed', 'client'))) return;
  const tz = await loadEmailDisplayTz();
  const tzLabel = tzShortLabel(tz);
  const dateStr = fmtDate(params.confirmedDate, tz);

  await sendEmail({
    to: params.clientEmail,
    subject: 'Tu cita ha sido confirmada — Lda. Silvana López',
    html: wrapTemplate(`
      <h3 style="color: ${brandColor};">¡Tu cita está confirmada!</h3>
      <p>Hola ${params.clientName},</p>
      <p>Tu sesión ha sido confirmada para:</p>
      <div style="background: ${brandLight}; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <p style="font-size: 18px; color: ${brandColor}; margin: 0;"><strong>${dateStr}</strong></p>
        <p style="margin: 8px 0 0;">${params.serviceName} · ${params.durationMin} minutos · hora ${tzLabel}</p>
      </div>
      ${params.meetLink ? `
      <div style="text-align: center; margin: 20px 0;">
        <a href="${params.meetLink}"
           style="display: inline-block; background: ${brandColor}; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-size: 16px;">
          Unirse a la videollamada
        </a>
        <p style="font-size: 12px; color: #888; margin-top: 8px;">Enlace de Google Meet — guarda este correo para acceder el día de la cita.</p>
      </div>
      ` : `<p>La sesión se realizará por videollamada. Recibirás el enlace antes de la cita.</p>`}
      <p style="color: #888; font-style: italic;">Si necesitas reagendar, escríbeme por WhatsApp.</p>
    `),
  });
}

// ─── Rejection: Booking Rejected → Client ─────────────────

export async function sendBookingRejectedEmail(params: {
  clientEmail: string;
  clientName: string;
  reason?: string;
}): Promise<void> {
  if (!(await isNotificationEnabled('booking_rejected', 'client'))) return;
  await sendEmail({
    to: params.clientEmail,
    subject: 'Sobre tu solicitud de cita — Lda. Silvana López',
    html: wrapTemplate(`
      <p>Hola ${params.clientName},</p>
      <p>Lamentablemente, no pudimos confirmar tu cita en este momento.</p>
      ${params.reason ? `<p><em>${params.reason}</em></p>` : ''}
      <p>Si deseas, puedes solicitar una nueva cita en otro horario o contactarme por WhatsApp para coordinar.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/booking"
         style="display: inline-block; background: ${brandColor}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 8px;">
        Solicitar nueva cita
      </a>
    `),
  });
}

// ─── Payment Link → Client ────────────────────────────────

export async function sendPaymentLinkEmail(params: {
  clientEmail: string;
  clientName: string;
  amount: number;
  total: number;
  provider: 'stripe' | 'paypal';
  paymentUrl: string;
  expiresAt?: string;
}): Promise<void> {
  if (!(await isNotificationEnabled('payment_link', 'client'))) return;
  const tz = await loadEmailDisplayTz();
  const tzLabel = tzShortLabel(tz);
  const surchargeNote = params.provider === 'paypal'
    ? `<p style="font-size: 13px; color: #888;">* El monto incluye un recargo del 10% por uso de PayPal.</p>`
    : '';

  await sendEmail({
    to: params.clientEmail,
    subject: 'Enlace de pago para tu sesión — Lda. Silvana López',
    html: wrapTemplate(`
      <p>Hola ${params.clientName},</p>
      <p>Aquí tienes el enlace para realizar el pago de tu próxima sesión:</p>
      <div style="background: ${brandLight}; padding: 20px; border-radius: 8px; margin: 16px 0; text-align: center;">
        <p style="font-size: 24px; color: ${brandColor}; margin: 0;"><strong>$${params.total.toFixed(2)} USD</strong></p>
        ${surchargeNote}
      </div>
      <div style="text-align: center;">
        <a href="${params.paymentUrl}"
           style="display: inline-block; background: ${brandColor}; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-size: 16px;">
          Realizar pago
        </a>
      </div>
      ${params.expiresAt ? `<p style="font-size: 13px; color: #888; text-align: center; margin-top: 12px;">Este enlace expira el ${fmtDate(params.expiresAt, tz)} (hora ${tzLabel}).</p>` : ''}
    `),
  });
}

// ─── Rescheduled → Client ─────────────────────────────────

export async function sendRescheduledEmail(params: {
  clientEmail: string;
  clientName: string;
  oldDate: string;
  newDate: string;
  meetLink?: string | null;
}): Promise<void> {
  if (!(await isNotificationEnabled('booking_rescheduled', 'client'))) return;
  const tz = await loadEmailDisplayTz();
  const tzLabel = tzShortLabel(tz);
  const oldDateStr = fmtDate(params.oldDate, tz);
  const newDateStr = fmtDate(params.newDate, tz);

  await sendEmail({
    to: params.clientEmail,
    subject: 'Tu cita ha sido reagendada — Lda. Silvana López',
    html: wrapTemplate(`
      <p>Hola ${params.clientName},</p>
      <p>Tu cita ha sido reagendada (hora ${tzLabel}):</p>
      <div style="background: ${brandLight}; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <p style="text-decoration: line-through; color: #999;">${oldDateStr}</p>
        <p style="font-size: 18px; color: ${brandColor}; margin: 8px 0 0;"><strong>${newDateStr}</strong></p>
      </div>
      ${params.meetLink ? `
      <div style="text-align: center; margin: 20px 0;">
        <a href="${params.meetLink}"
           style="display: inline-block; background: ${brandColor}; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none;">
          Unirse a la videollamada
        </a>
      </div>
      ` : ''}
      <p style="color: #888; font-style: italic;">Si necesitas coordinar otro horario, escríbeme por WhatsApp.</p>
    `),
  });
}

// ─── Password Recovery → Admin ────────────────────────────

export async function sendPasswordResetEmail(params: {
  email: string;
  resetLink: string;
}): Promise<void> {
  await sendEmail({
    to: params.email,
    subject: 'Recuperar contraseña — Panel Admin',
    html: wrapTemplate(`
      <h3 style="color: ${brandColor};">Recuperar contraseña</h3>
      <p>Se solicitó un cambio de contraseña para tu cuenta del panel de administración.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${params.resetLink}"
           style="display: inline-block; background: ${brandColor}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Cambiar contraseña
        </a>
      </div>
      <p style="font-size: 13px; color: #888;">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este correo.</p>
    `),
  });
}

// ─── Invoice/Comprobante → Client ────────────────────────

export async function sendInvoiceEmail(params: {
  clientEmail: string;
  clientName: string;
  concepto: string;
  monto: number;
  estado: string;
  fecha: string;
  paymentMethods?: { nombre: string; instrucciones?: string }[];
}): Promise<void> {
  if (!(await isNotificationEnabled('invoice', 'client'))) return;
  const tz = await loadEmailDisplayTz();
  const methodsHtml = (params.paymentMethods || []).map(m =>
    `<div style="background: #fff; padding: 10px 14px; border: 1px solid #e2ede2; border-radius: 6px; margin-bottom: 6px;">
      <strong>${m.nombre}</strong>
      ${m.instrucciones ? `<br><span style="font-size: 12px; color: #666;">${m.instrucciones}</span>` : ''}
    </div>`
  ).join('');

  await sendEmail({
    to: params.clientEmail,
    subject: `Comprobante de pago — Lda. Silvana López`,
    html: wrapTemplate(`
      <h3 style="color: ${brandColor};">Comprobante de pago</h3>
      <p>Hola ${params.clientName},</p>
      <p>Te enviamos los detalles de tu comprobante:</p>
      <div style="background: ${brandLight}; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <p><strong>Concepto:</strong> ${params.concepto}</p>
        <p><strong>Monto:</strong> $${params.monto.toFixed(2)} USD</p>
        <p><strong>Estado:</strong> ${params.estado}</p>
        <p><strong>Fecha:</strong> ${fmtDate(params.fecha, tz, false)}</p>
      </div>
      ${params.estado !== 'pagada' && methodsHtml ? `
        <p><strong>Métodos de pago disponibles:</strong></p>
        ${methodsHtml}
      ` : ''}
      <p style="color: #888; font-style: italic;">Si tienes dudas, escríbeme por WhatsApp.</p>
    `),
  });
}

// ─── Cancellation → Client ───────────────────────────────

export async function sendBookingCancelledEmail(params: {
  clientEmail: string;
  clientName: string;
  cancelledDate: string;
  serviceName: string;
  reason?: string;
  cancelledBy: 'client' | 'admin';
}): Promise<void> {
  if (!(await isNotificationEnabled('booking_cancelled', 'client'))) return;
  const tz = await loadEmailDisplayTz();
  const dateStr = fmtDate(params.cancelledDate, tz);
  const isAdminCancel = params.cancelledBy === 'admin';

  await sendEmail({
    to: params.clientEmail,
    subject: 'Tu cita ha sido cancelada — Lda. Silvana López',
    html: wrapTemplate(`
      <h3 style="color: ${brandColor};">Cita cancelada</h3>
      <p>Hola ${params.clientName},</p>
      <p>
        ${isAdminCancel
          ? 'Te informamos que tu cita ha sido cancelada.'
          : 'Hemos registrado la cancelación de tu cita.'}
      </p>
      <div style="background: ${brandLight}; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <p><strong>Servicio:</strong> ${params.serviceName}</p>
        <p><strong>Fecha cancelada:</strong> <span style="text-decoration: line-through; color: #999;">${dateStr}</span></p>
      </div>
      ${params.reason ? `<p><strong>Motivo:</strong> <em>${params.reason}</em></p>` : ''}
      <p>Si deseas agendar una nueva cita, puedes hacerlo directamente desde la web:</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/booking"
           style="display: inline-block; background: ${brandColor}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Solicitar nueva cita
        </a>
      </div>
      <p style="color: #888; font-style: italic;">Cualquier duda, escríbeme por WhatsApp.</p>
    `),
  });
}

// ─── Cancellation → Admin ────────────────────────────────

export async function sendBookingCancelledAdminNotification(params: {
  adminEmail: string;
  clientName: string;
  clientEmail: string;
  cancelledDate: string;
  serviceName: string;
  reason?: string;
  cancelledBy: 'client' | 'admin';
}): Promise<void> {
  if (!(await isNotificationEnabled('booking_cancelled', 'admin'))) return;
  const tz = await loadEmailDisplayTz();
  const tzLabel = tzShortLabel(tz);
  const dateStr = fmtDate(params.cancelledDate, tz);
  const byLabel = params.cancelledBy === 'client' ? 'el cliente' : 'administración';

  await sendEmail({
    to: params.adminEmail,
    subject: `Cita cancelada — ${params.clientName}`,
    html: wrapTemplate(`
      <h3 style="color: ${brandColor};">Cita cancelada</h3>
      <p>Se ha cancelado una cita programada (cancelada por ${byLabel}).</p>
      <div style="background: ${brandLight}; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <p><strong>Cliente:</strong> ${params.clientName}</p>
        <p><strong>Email:</strong> ${params.clientEmail}</p>
        <p><strong>Servicio:</strong> ${params.serviceName}</p>
        <p><strong>Fecha cancelada:</strong> ${dateStr} (hora ${tzLabel})</p>
        ${params.reason ? `<p><strong>Motivo:</strong> <em>${params.reason}</em></p>` : ''}
      </div>
      <a href="${process.env.NEXT_PUBLIC_ADMIN_URL}/admin/dashboard"
         style="display: inline-block; background: ${brandColor}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 8px;">
        Ver panel
      </a>
    `),
  });
}

// ─── Reminder 24h antes → Client ─────────────────────────
//
// NOTA: esta plantilla YA ESTÁ LISTA pero NO se dispara automáticamente.
// Requiere un scheduler (pg_cron en Supabase o cron externo) que
// seleccione bookings con confirmed_date entre now+23h y now+25h y llame
// a esta función por cada uno. Ver docs/DEPLOY.md §9 (pendientes) para
// la tarea de configurar el scheduler post-deploy.

export async function sendReminderEmail(params: {
  clientEmail: string;
  clientName: string;
  confirmedDate: string;
  serviceName: string;
  durationMin: number;
  meetLink?: string | null;
}): Promise<void> {
  if (!(await isNotificationEnabled('reminder_24h', 'client'))) return;
  const tz = await loadEmailDisplayTz();
  const tzLabel = tzShortLabel(tz);
  const dateStr = fmtDate(params.confirmedDate, tz);

  await sendEmail({
    to: params.clientEmail,
    subject: 'Recordatorio: tu cita es mañana — Lda. Silvana López',
    html: wrapTemplate(`
      <h3 style="color: ${brandColor};">Tu cita es mañana</h3>
      <p>Hola ${params.clientName},</p>
      <p>Te recordamos que tienes una sesión agendada para:</p>
      <div style="background: ${brandLight}; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <p style="font-size: 18px; color: ${brandColor}; margin: 0;"><strong>${dateStr}</strong></p>
        <p style="margin: 8px 0 0;">${params.serviceName} · ${params.durationMin} minutos · hora ${tzLabel}</p>
      </div>
      ${params.meetLink ? `
      <div style="text-align: center; margin: 20px 0;">
        <a href="${params.meetLink}"
           style="display: inline-block; background: ${brandColor}; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-size: 16px;">
          Unirse a la videollamada
        </a>
        <p style="font-size: 12px; color: #888; margin-top: 8px;">Guarda este enlace para acceder a la sesión mañana.</p>
      </div>
      ` : ''}
      <p style="color: #888; font-style: italic;">Si necesitas reagendar, escríbeme cuanto antes por WhatsApp.</p>
    `),
  });
}
