import { NextRequest, NextResponse } from 'next/server';
import { verifyPayPalWebhook, parsePayPalEvent } from '@/lib/adapters/paypal';
import { handlePaymentConfirmed } from '@/lib/services/booking.service';

/**
 * POST /api/webhooks/paypal
 * Receives PayPal webhook events.
 * No auth — verified via PayPal signature verification.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Extract PayPal headers
    const headers: Record<string, string> = {};
    ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time'].forEach((h) => {
      const val = request.headers.get(h);
      if (val) headers[h] = val;
    });

    // Verify webhook authenticity
    const isValid = await verifyPayPalWebhook(headers, body);
    if (!isValid) {
      console.error('[Webhook] PayPal signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);
    const parsed = parsePayPalEvent(event);

    if (!parsed) {
      return NextResponse.json({ received: true });
    }

    if (parsed.type === 'payment_success' && parsed.bookingId) {
      await handlePaymentConfirmed({
        bookingId: parsed.bookingId,
        provider: 'paypal',
        providerTxId: parsed.orderId,
        amount: parsed.amount,
        currency: parsed.currency,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Webhook] PayPal error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 400 }
    );
  }
}
