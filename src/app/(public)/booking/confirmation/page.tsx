import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';
import ConfirmationClient from '@/components/public/ConfirmationClient';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Solicitud enviada — Lda. Silvana López',
};

export default async function BookingConfirmationPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc('get_public_contact').single();
  const settings = data as { form_display_tz?: string } | null;
  const formTz = settings?.form_display_tz || 'America/New_York';

  return (
    <>
      <Navbar />
      <ConfirmationClient formTz={formTz} />
      <Footer />
    </>
  );
}
