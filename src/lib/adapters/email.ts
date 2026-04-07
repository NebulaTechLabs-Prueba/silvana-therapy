import { Resend } from 'resend';

/**
 * Email Adapter
 * Uses Resend for transactional emails.
 * All email templates and sending logic centralized here.
 */

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}
const FROM = process.env.EMAIL_FROM || 'Silvana López <noreply@terapiasilvanalopez.com>';

// ─── Types ────────────────────────────────────────────────

interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(params: EmailParams): Promise<void> {
  const { error } = await getResend().emails.send({
    from: FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    console.error('[Email] Failed to send:', error);
    throw new Error(`Email send failed: ${error.message}`);
  }
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

// ─── Notification: New Booking → Silvana ──────────────────

export async function sendNewBookingNotification(params: {
  adminEmail: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  reason?: string;
  preferredDate?: string;
  isFirstSession: boolean;
  bookingId: string;
}): Promise<void> {
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL;

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
        ${params.preferredDate ? `<p><strong>Fecha preferida:</strong> ${new Date(params.preferredDate).toLocaleString('es-AR')}</p>` : ''}
        <p><strong>Tipo:</strong> ${params.isFirstSession ? '🟢 Primera cita (gratuita)' : '🔵 Cita de seguimiento'}</p>
      </div>
      <a href="${adminUrl}/admin/bookings/${params.bookingId}" 
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
}): Promise<void> {
  const dateStr = new Date(params.confirmedDate).toLocaleString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  await sendEmail({
    to: params.clientEmail,
    subject: 'Tu cita ha sido confirmada — Lda. Silvana López',
    html: wrapTemplate(`
      <h3 style="color: ${brandColor};">¡Tu cita está confirmada!</h3>
      <p>Hola ${params.clientName},</p>
      <p>Tu sesión ha sido confirmada para:</p>
      <div style="background: ${brandLight}; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <p style="font-size: 18px; color: ${brandColor}; margin: 0;"><strong>${dateStr}</strong></p>
        <p style="margin: 8px 0 0;">${params.serviceName} · ${params.durationMin} minutos</p>
      </div>
      <p>La sesión se realizará por videollamada. Recibirás el enlace antes de la cita.</p>
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
  await sendEmail({
    to: params.clientEmail,
    subject: 'Sobre tu solicitud de cita — Lda. Silvana López',
    html: wrapTemplate(`
      <p>Hola ${params.clientName},</p>
      <p>Lamentablemente, no pudimos confirmar tu cita en este momento.</p>
      ${params.reason ? `<p><em>${params.reason}</em></p>` : ''}
      <p>Si deseas, puedes solicitar una nueva cita en otro horario o contactarme por WhatsApp para coordinar.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/reservar" 
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
      ${params.expiresAt ? `<p style="font-size: 13px; color: #888; text-align: center; margin-top: 12px;">Este enlace expira el ${new Date(params.expiresAt).toLocaleString('es-AR')}.</p>` : ''}
    `),
  });
}

// ─── Rescheduled → Client ─────────────────────────────────

export async function sendRescheduledEmail(params: {
  clientEmail: string;
  clientName: string;
  oldDate: string;
  newDate: string;
}): Promise<void> {
  const oldDateStr = new Date(params.oldDate).toLocaleString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
  const newDateStr = new Date(params.newDate).toLocaleString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });

  await sendEmail({
    to: params.clientEmail,
    subject: 'Tu cita ha sido reagendada — Lda. Silvana López',
    html: wrapTemplate(`
      <p>Hola ${params.clientName},</p>
      <p>Tu cita ha sido reagendada:</p>
      <div style="background: ${brandLight}; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <p style="text-decoration: line-through; color: #999;">${oldDateStr}</p>
        <p style="font-size: 18px; color: ${brandColor}; margin: 8px 0 0;"><strong>${newDateStr}</strong></p>
      </div>
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
