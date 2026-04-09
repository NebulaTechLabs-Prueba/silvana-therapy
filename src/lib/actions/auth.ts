'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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

  if (!email || !email.includes('@') || email.length > 320) {
    return { success: false, error: 'Email inválido' };
  }

  const supabase = await createServerSupabaseClient();
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/login`,
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

// ─── Security Question Recovery ──────────────────────────

export async function getSecurityQuestionAction(): Promise<ActionResult<string>> {
  // Use admin client — this runs on the unauthenticated login page
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('admin_settings')
    .select('security_question')
    .limit(1)
    .single();

  if (!data?.security_question) {
    return { success: false, error: 'No hay pregunta de seguridad configurada.' };
  }

  return { success: true, data: data.security_question };
}

export async function verifySecurityAnswerAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const answer = (formData.get('answer') as string)?.trim().toLowerCase();

  if (!answer) {
    return { success: false, error: 'Ingresa tu respuesta.' };
  }

  if (answer.length > 200) {
    return { success: false, error: 'Respuesta demasiado larga.' };
  }

  // Use admin client — this runs on the unauthenticated login page
  const adminSupabase = createAdminClient();
  const { data } = await adminSupabase
    .from('admin_settings')
    .select('security_answer, notification_email')
    .limit(1)
    .single();

  if (!data?.security_answer) {
    return { success: false, error: 'No hay pregunta de seguridad configurada.' };
  }

  if (answer !== data.security_answer.trim().toLowerCase()) {
    return { success: false, error: 'Respuesta incorrecta.' };
  }

  // Answer correct — generate a magic link token without sending email
  const email = data.notification_email;
  if (!email) {
    return { success: false, error: 'No hay email de administrador configurado.' };
  }

  try {
    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('[Auth] generateLink error:', linkError);
      return { success: false, error: 'Error al generar acceso. Intenta nuevamente.' };
    }

    // Return the hashed token and email so the client can verify the OTP
    return {
      success: true,
      data: { token: linkData.properties.hashed_token, email },
    };
  } catch (err) {
    console.error('[Auth] Security question login error:', err);
    return { success: false, error: 'Error interno. Intenta nuevamente.' };
  }
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
