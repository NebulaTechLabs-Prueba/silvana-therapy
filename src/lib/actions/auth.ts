'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { loginSchema } from '@/lib/validators/schemas';

/**
 * Server Actions — Auth
 * ─────────────────────────────────────────────────────────────
 * Why Server Actions instead of API routes?
 * - Built-in CSRF protection
 * - Direct function calls from Client Components (no fetch boilerplate)
 * - Type-safe end to end
 * - Automatic cookie handling via Supabase SSR
 */

export type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// ─── Login ────────────────────────────────────────────────

export async function loginAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  // 1. Validate input
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // 2. Attempt login via Supabase
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Generic message — don't leak whether email exists
    return {
      success: false,
      error: 'Email o contraseña incorrectos',
    };
  }

  // 3. Redirect to dashboard
  // Note: redirect() throws internally, so this function
  // never returns on success — that's expected.
  revalidatePath('/', 'layout');
  redirect('/admin/dashboard');
}

// ─── Logout ───────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

// ─── Request Password Reset ───────────────────────────────

export async function requestPasswordResetAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const email = formData.get('email') as string;

  if (!email || !email.includes('@')) {
    return { success: false, error: 'Email inválido' };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_ADMIN_URL}/auth/reset-password`,
  });

  // Always return success even if email doesn't exist
  // (prevents email enumeration attacks)
  if (error) {
    console.error('[Auth] Password reset error:', error);
  }

  return {
    success: true,
    data: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña.',
  };
}

// ─── Update Password (after reset link clicked) ───────────

export async function updatePasswordAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!password || password.length < 8) {
    return { success: false, error: 'La contraseña debe tener al menos 8 caracteres' };
  }

  if (password !== confirmPassword) {
    return { success: false, error: 'Las contraseñas no coinciden' };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { success: false, error: 'Error al actualizar la contraseña' };
  }

  redirect('/admin/dashboard');
}
