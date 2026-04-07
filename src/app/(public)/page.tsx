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

export const metadata = {
  title: 'Lda. Silvana López — Psicoterapia Online',
  description:
    'Un espacio para comenzar a sentirte mejor. Sesiones personalizadas y confidenciales. Primera consulta sin cargo.',
};

export default function HomePage() {
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
      <ContactSection />
      <Footer />
    </>
  );
}
