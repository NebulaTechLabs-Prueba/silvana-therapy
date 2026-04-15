import { NextRequest, NextResponse } from 'next/server';
import { createBookingSchema } from '@/lib/validators/schemas';
import { createBooking } from '@/lib/services/booking.service';

/**
 * POST /api/bookings
 * Public endpoint — no auth required.
 * Creates a new booking from the landing page form.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = createBookingSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const booking = await createBooking(validation.data);

    return NextResponse.json(
      {
        success: true,
        booking: {
          id: booking.id,
          status: booking.status,
          is_first_session: booking.is_first_session,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] POST /api/bookings error:', error);

    const msg = (error as Error).message || '';

    // Idempotency conflict — not an error
    if (msg.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Esta solicitud ya fue enviada' },
        { status: 409 }
      );
    }

    // Time slot conflict
    if (msg.includes('ya está reservado')) {
      return NextResponse.json(
        { error: msg },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: msg || 'Error al crear la reserva. Intenta nuevamente.' },
      { status: 500 }
    );
  }
}
