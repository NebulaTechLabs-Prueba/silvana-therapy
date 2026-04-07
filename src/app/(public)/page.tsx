import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';
import HeroSection from '@/components/public/home/HeroSection';
import ParallaxBand from '@/components/public/home/ParallaxBand';
import AboutSection from '@/components/public/home/AboutSection';
import StepsSection from '@/components/public/home/StepsSection';
import BenefitsSection from '@/components/public/home/BenefitsSection';
import WhenToStartSection from '@/components/public/home/WhenToStartSection';
import CTABanner from '@/components/public/home/CTABanner';
import ProfileSection from '@/components/public/home/ProfileSection';
import ContactSection from '@/components/public/home/ContactSection';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Lda. Silvana López — Psicoterapia Online',
  description:
    'Un espacio para comenzar a sentirte mejor. Sesiones personalizadas y confidenciales. Primera consulta sin cargo.',
};

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: payMethods }, { data: settings }] = await Promise.all([
    supabase.from('payment_methods').select('nombre, tipo').eq('activo', true).order('prioridad'),
    supabase.from('admin_settings').select('contact_email, contact_phone').limit(1).single(),
  ]);

  const activePaymentMethods = (payMethods ?? []).map((m: { nombre: string; tipo: string }) => ({ nombre: m.nombre, tipo: m.tipo }));

  return (
    <>
      <Navbar />
      <HeroSection />
      <ParallaxBand />
      <AboutSection />
      <StepsSection />
      <BenefitsSection />
      <WhenToStartSection />
      <CTABanner />
      <ProfileSection />
      <ContactSection
        paymentMethods={activePaymentMethods}
        contactEmail={settings?.contact_email || ''}
        contactPhone={settings?.contact_phone || ''}
      />
      <Footer />
    </>
  );
}
