import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';

export const metadata = {
  title: 'Iniciar sesión — Panel Admin',
  description: 'Acceso privado al panel de administración.',
};

/**
 * Login Page (Server Component)
 * Redirects to dashboard if user is already authenticated.
 */
export default async function LoginPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/admin/dashboard');
  }

  return <LoginForm />;
}
