/**
 * PayPal Adapter
 * Uses PayPal REST API v2 directly (no SDK dependency issues).
 * Follows the same interface pattern as Stripe adapter.
 */

const PAYPAL_BASE_URL =
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

// ─── Auth ─────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`PayPal auth failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// ─── Types ────────────────────────────────────────────────

export interface CreatePayPalOrderParams {
  amount: number;          // Base amount in dollars
  surchargePercent: number; // e.g., 10 for 10%
  currency?: string;
  bookingId: string;
  clientName: string;
  description: string;
}

export interface PayPalOrderResult {
  url: string;
  providerLinkId: string;
  total: number;
}

export interface PayPalWebhookEvent {
  type: string;
  bookingId: string | null;
  orderId: string;
  amount: number;
  currency: string;
}

// ─── Create Order (Payment Link) ──────────────────────────

export async function createPayPalOrder(
  params: CreatePayPalOrderParams
): Promise<PayPalOrderResult> {
  const { amount, surchargePercent, currency = 'USD', bookingId, description } = params;

  const surcharge = amount * (surchargePercent / 100);
  const total = Math.round((amount + surcharge) * 100) / 100;

  const token = await getAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: bookingId,
          description,
          amount: {
            currency_code: currency,
            value: total.toFixed(2),
            breakdown: {
              item_total: { currency_code: currency, value: amount.toFixed(2) },
              handling: { currency_code: currency, value: surcharge.toFixed(2) },
            },
          },
          custom_id: bookingId,
        },
      ],
      application_context: {
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/reserva/confirmada`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/reserva/pendiente`,
        brand_name: 'Lda. Silvana López — Terapia Online',
        user_action: 'PAY_NOW',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal order creation failed: ${error}`);
  }

  const order = await response.json();
  const approveLink = order.links.find(
    (l: { rel: string }) => l.rel === 'approve'
  );

  return {
    url: approveLink?.href || '',
    providerLinkId: order.id,
    total,
  };
}

// ─── Verify Webhook ───────────────────────────────────────

export async function verifyPayPalWebhook(
  headers: Record<string, string>,
  body: string
): Promise<boolean> {
  const token = await getAccessToken();

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: JSON.parse(body),
      }),
    }
  );

  const result = await response.json();
  return result.verification_status === 'SUCCESS';
}

// ─── Parse Webhook Event ──────────────────────────────────

export function parsePayPalEvent(body: Record<string, unknown>): PayPalWebhookEvent | null {
  const eventType = body.event_type as string;
  const resource = body.resource as Record<string, unknown>;

  if (eventType === 'CHECKOUT.ORDER.APPROVED' || eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    const purchaseUnit = (resource.purchase_units as Array<Record<string, unknown>>)?.[0];
    return {
      type: 'payment_success',
      bookingId: (purchaseUnit?.custom_id as string) || null,
      orderId: resource.id as string,
      amount: parseFloat((purchaseUnit?.amount as Record<string, string>)?.value || '0'),
      currency: (purchaseUnit?.amount as Record<string, string>)?.currency_code || 'USD',
    };
  }

  return null;
}

// ─── Capture Order (after client approves) ────────────────

export async function capturePayPalOrder(orderId: string): Promise<void> {
  const token = await getAccessToken();

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`PayPal capture failed: ${response.statusText}`);
  }
}

// ─── (Sin reembolsos — se reagenda o acuerdo mutuo) ───────
