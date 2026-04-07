import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';
import ConfirmationClient from '@/components/public/ConfirmationClient';

export const metadata = {
  title: 'Reserva confirmada — Lda. Silvana López',
};

export default function BookingConfirmationPage() {
  return (
    <>
      <Navbar />
      <ConfirmationClient />
      <Footer />
    </>
  );
}
