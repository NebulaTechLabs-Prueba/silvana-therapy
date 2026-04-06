import { NextRequest, NextResponse } from 'next/server';
import { verifyStripeWebhook, parseStripeEvent } from '@/lib/adapters/stripe';
import { handlePaymentConfirmed } from '@/lib/services/booking.service';

/**
 * POST /api/webhooks/stripe
 * Receives Stripe webhook events.
 * No auth — verified via Stripe signature.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Verify webhook authenticity
    const event = verifyStripeWebhook(body, signature);
    const parsed = parseStripeEvent(event);

    if (!parsed) {
      // Event type we don't handle — acknowledge it
      return NextResponse.json({ received: true });
    }

    if (parsed.type === 'payment_success' && parsed.bookingId) {
      await handlePaymentConfirmed({
        bookingId: parsed.bookingId,
        provider: 'stripe',
        providerTxId: parsed.paymentIntentId,
        amount: parsed.amount,
        currency: parsed.currency,
        metadata: parsed.metadata,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Stripe error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 400 }
    );
  }
}
