import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendReminderEmail } from '@/lib/adapters/email';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/reminders
 * Sends 24h reminder emails for confirmed bookings whose confirmed_date
 * falls in [now+23h, now+25h] and that haven't been reminded yet.
 *
 * Protected via CRON_SECRET header (Authorization: Bearer <secret>).
 * Schedule externally (droplet crontab) every 30 min.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });

  const auth = request.headers.get('authorization') || '';
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const from = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
  const to = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, confirmed_date, meet_link, client:clients(full_name, email), service:services(name, duration_min)')
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .gte('confirmed_date', from)
    .lte('confirmed_date', to);

  if (error) {
    console.error('[cron/reminders] query failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const b of bookings ?? []) {
    const client = b.client as { full_name: string; email: string } | null;
    const service = b.service as { name: string; duration_min: number } | null;
    if (!client?.email || !b.confirmed_date) {
      results.push({ id: b.id, ok: false, error: 'missing email or date' });
      continue;
    }
    try {
      await sendReminderEmail({
        clientEmail: client.email,
        clientName: client.full_name,
        confirmedDate: b.confirmed_date,
        serviceName: service?.name ?? 'Consulta',
        durationMin: service?.duration_min ?? 60,
        meetLink: b.meet_link,
      });
      await supabase
        .from('bookings')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', b.id);
      results.push({ id: b.id, ok: true });
    } catch (e) {
      console.error('[cron/reminders] send failed for', b.id, e);
      results.push({ id: b.id, ok: false, error: (e as Error).message });
    }
  }

  return NextResponse.json({ sent: results.filter(r => r.ok).length, total: results.length, results });
}
