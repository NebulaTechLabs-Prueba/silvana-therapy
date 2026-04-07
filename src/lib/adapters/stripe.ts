import Stripe from 'stripe';

/**
 * Stripe Adapter
 * Follows Adapter Pattern — all Stripe-specific logic lives here.
 * The service layer calls these methods without knowing Stripe internals.
 */

let _stripe: Stripe | null = null;
function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
  }
  return _stripe;
}

export interface CreatePaymentLinkParams {
  amount: number;           // In dollars (e.g., 60.00)
  currency?: string;
  bookingId: string;
  clientEmail: string;
  clientName: string;
  description: string;
  expiresAt?: Date;
}

export interface PaymentLinkResult {
  url: string;
  providerLinkId: string;
}

export interface WebhookEvent {
  type: string;
  bookingId: string | null;
  paymentIntentId: string;
  amount: number;
  currency: string;
  metadata: Record<string, string>;
}

// ─── Create Payment Link ──────────────────────────────────

export async function createStripePaymentLink(
  params: CreatePaymentLinkParams
): Promise<PaymentLinkResult> {
  const { amount, currency = 'usd', bookingId, clientEmail, clientName, description } = params;

  // Create a Stripe Checkout Session (acts as a payment link)
  const session = await getStripe().checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: clientEmail,
    line_items: [
      {
        price_data: {
          currency,
          unit_amount: Math.round(amount * 100), // Stripe uses cents
          product_data: {
            name: description,
            description: `Sesión de terapia — ${clientName}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      booking_id: bookingId,
      client_name: clientName,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/reserva/confirmada?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/reserva/pendiente`,
    expires_at: params.expiresAt
      ? Math.floor(params.expiresAt.getTime() / 1000)
      : undefined,
  });

  return {
    url: session.url!,
    providerLinkId: session.id,
  };
}

// ─── Verify Webhook Signature ─────────────────────────────

export function verifyStripeWebhook(
  body: string | Buffer,
  signature: string
): Stripe.Event {
  return getStripe().webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}

// ─── Parse Webhook Event ──────────────────────────────────

export function parseStripeEvent(event: Stripe.Event): WebhookEvent | null {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    return {
      type: 'payment_success',
      bookingId: session.metadata?.booking_id || null,
      paymentIntentId: session.payment_intent as string,
      amount: (session.amount_total || 0) / 100,
      currency: session.currency || 'usd',
      metadata: session.metadata || {},
    };
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    return {
      type: 'payment_expired',
      bookingId: session.metadata?.booking_id || null,
      paymentIntentId: '',
      amount: 0,
      currency: session.currency || 'usd',
      metadata: session.metadata || {},
    };
  }

  return null;
}

// ─── (Sin reembolsos — se reagenda o acuerdo mutuo) ───────
