'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginAction, requestPasswordResetAction, getSecurityQuestionAction, verifySecurityAnswerAction, type ActionResult } from '@/lib/actions/auth';
import { createBrowserClient } from '@supabase/ssr';

/**
 * Login Form (Client Component)
 * ─────────────────────────────────────────────────────────────
 * - Uses Server Actions (loginAction) for auth
 * - useFormState for error handling
 * - useFormStatus for submit button loading state
 * - Toggleable password visibility
 * - Inline password reset flow
 */

const initialState: ActionResult | null = null;

export default function LoginForm() {
  const [loginState, loginFormAction] = useFormState(loginAction, initialState);
  const [resetState, resetFormAction] = useFormState(requestPasswordResetAction, initialState);
  const [securityState, securityFormAction] = useFormState(verifySecurityAnswerAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'login' | 'reset' | 'security'>('login');
  const [securityQuestion, setSecurityQuestion] = useState<string | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (mode === 'security' && !securityQuestion) {
      getSecurityQuestionAction().then(res => {
        if (res.success && res.data) setSecurityQuestion(res.data as string);
        else setSecurityQuestion(null);
      });
    }
  }, [mode, securityQuestion]);

  // Handle security question verification + direct login via token
  useEffect(() => {
    if (securityState?.success && securityState.data && typeof securityState.data === 'object') {
      const { token, email } = securityState.data as { token: string; email: string };
      if (token && email) {
        setSecurityLoading(true);
        setSecurityError(null);
        setSecuritySuccess('Respuesta correcta. Iniciando sesión...');
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        supabase.auth.verifyOtp({ type: 'magiclink', email, token })
          .then(({ error }) => {
            if (error) {
              setSecurityError('Error al iniciar sesión: ' + error.message);
              setSecuritySuccess(null);
              setSecurityLoading(false);
            } else {
              router.push('/admin/dashboard');
            }
          });
      }
    }
  }, [securityState, router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#fdfcfa',
        fontFamily: "'DM Sans', sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
      }}
    >
      {/* ─── Decorative background pattern ─── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          opacity: 0.4,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-10%',
            right: '-5%',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(200, 221, 200, 0.3) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-15%',
            left: '-10%',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(143, 176, 143, 0.2) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* ─── Login card ─── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 420,
          background: '#ffffff',
          borderRadius: 16,
          padding: '2.5rem 2.25rem 2rem',
          boxShadow: '0 4px 24px rgba(74, 122, 74, 0.08), 0 1px 3px rgba(74, 122, 74, 0.04)',
          border: '1px solid #e2ede2',
          animation: 'slideUp 0.4s ease-out',
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #4a7a4a 0%, #3a6a3a 100%)',
              marginBottom: '1rem',
              boxShadow: '0 4px 12px rgba(74, 122, 74, 0.25)',
            }}
          >
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 24,
                color: '#ffffff',
                fontWeight: 400,
                letterSpacing: '-0.02em',
              }}
            >
              SL
            </span>
          </div>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 28,
              fontWeight: 400,
              color: '#2a3528',
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Panel de <em style={{ color: '#4a7a4a' }}>administración</em>
          </h1>
          <p
            style={{
              fontSize: 13,
              color: '#849884',
              margin: '0.5rem 0 0',
              letterSpacing: '0.02em',
            }}
          >
            Lda. Silvana López — Psicoterapia Online
          </p>
        </div>

        {mode === 'login' ? (
          <form action={loginFormAction}>
            {/* Email */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#4e6050',
                  marginBottom: '0.5rem',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="login-input"
                placeholder="tu@email.com"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1.5px solid #c8ddc8',
                  fontSize: 14,
                  fontFamily: "'DM Sans', sans-serif",
                  color: '#2a3528',
                  background: '#fdfcfa',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box' as const,
                }}
              />
              {loginState && !loginState.success && loginState.fieldErrors?.email && (
                <p style={{ fontSize: 12, color: '#c62828', marginTop: 6 }}>
                  {loginState.fieldErrors.email[0]}
                </p>
              )}
            </div>

            {/* Password */}
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#4e6050',
                  marginBottom: '0.5rem',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  minLength={8}
                  className="login-input"
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '12px 44px 12px 14px',
                    borderRadius: 10,
                    border: '1.5px solid #c8ddc8',
                    fontSize: 14,
                    fontFamily: "'DM Sans', sans-serif",
                    color: '#2a3528',
                    background: '#fdfcfa',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box' as const,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#849884',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </div>
              {loginState && !loginState.success && loginState.fieldErrors?.password && (
                <p style={{ fontSize: 12, color: '#c62828', marginTop: 6 }}>
                  {loginState.fieldErrors.password[0]}
                </p>
              )}
            </div>

            {/* Forgot password */}
            <div style={{ textAlign: 'right', marginBottom: '1.5rem' }}>
              <button
                type="button"
                onClick={() => setMode('reset')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4a7a4a',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {/* Error message */}
            {loginState && !loginState.success && loginState.error && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  background: '#FFEBEE',
                  border: '1px solid #ffcdd2',
                  borderRadius: 8,
                  color: '#c62828',
                  fontSize: 13,
                  marginBottom: '1.25rem',
                }}
              >
                {loginState.error}
              </div>
            )}

            <SubmitButton label="Iniciar sesión" />
          </form>
        ) : mode === 'reset' ? (
          <form action={resetFormAction}>
            <p style={{ fontSize: 13, color: '#4e6050', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label
                htmlFor="reset-email"
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#4e6050',
                  marginBottom: '0.5rem',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Email
              </label>
              <input
                id="reset-email"
                name="email"
                type="email"
                required
                className="login-input"
                placeholder="tu@email.com"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1.5px solid #c8ddc8',
                  fontSize: 14,
                  fontFamily: "'DM Sans', sans-serif",
                  color: '#2a3528',
                  background: '#fdfcfa',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box' as const,
                }}
              />
            </div>

            {resetState?.success && resetState.data != null && (
              <div
                role="status"
                style={{
                  padding: '10px 14px',
                  background: '#f0f5f0',
                  border: '1px solid #c8ddc8',
                  borderRadius: 8,
                  color: '#4a7a4a',
                  fontSize: 13,
                  marginBottom: '1.25rem',
                }}
              >
                {String(resetState.data)}
              </div>
            )}

            {resetState && !resetState.success && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  background: '#FFEBEE',
                  border: '1px solid #ffcdd2',
                  borderRadius: 8,
                  color: '#c62828',
                  fontSize: 13,
                  marginBottom: '1.25rem',
                }}
              >
                {resetState.error}
              </div>
            )}

            <SubmitButton label="Enviar enlace" />

            <div style={{ textAlign: 'center', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setMode('security')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#849884',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Recuperar con pregunta de seguridad
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4a7a4a',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                ← Volver al inicio de sesión
              </button>
            </div>
          </form>
        ) : mode === 'security' ? (
          <form action={securityFormAction}>
            <p style={{ fontSize: 13, color: '#4e6050', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              Responde tu pregunta de seguridad para acceder al panel.
            </p>

            {securityQuestion ? (
              <>
                <div style={{ padding: '12px 14px', background: '#f0f5f0', border: '1px solid #c8ddc8', borderRadius: 10, marginBottom: '1.25rem', fontSize: 14, color: '#2a3528', fontWeight: 500 }}>
                  {securityQuestion}
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label htmlFor="security-answer" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#4e6050', marginBottom: '0.5rem', letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>
                    Tu respuesta
                  </label>
                  <input
                    id="security-answer"
                    name="answer"
                    type="text"
                    required
                    className="login-input"
                    placeholder="Escribe tu respuesta..."
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #c8ddc8', fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: '#2a3528', background: '#fdfcfa', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box' as const }}
                  />
                </div>
              </>
            ) : (
              <div style={{ padding: '10px 14px', background: '#FFEBEE', border: '1px solid #ffcdd2', borderRadius: 8, color: '#c62828', fontSize: 13, marginBottom: '1.25rem' }}>
                No hay pregunta de seguridad configurada. Usa el enlace por correo.
              </div>
            )}

            {securitySuccess && (
              <div role="status" style={{ padding: '10px 14px', background: '#f0f5f0', border: '1px solid #c8ddc8', borderRadius: 8, color: '#4a7a4a', fontSize: 13, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                {securityLoading && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
                    <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
                  </svg>
                )}
                {securitySuccess}
              </div>
            )}

            {(securityError || (securityState && !securityState.success && securityState.error)) && (
              <div role="alert" style={{ padding: '10px 14px', background: '#FFEBEE', border: '1px solid #ffcdd2', borderRadius: 8, color: '#c62828', fontSize: 13, marginBottom: '1.25rem' }}>
                {securityError || securityState?.error}
              </div>
            )}

            {securityQuestion && !securityLoading && <SubmitButton label="Verificar e ingresar" />}

            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button type="button" onClick={() => setMode('reset')} style={{ background: 'none', border: 'none', color: '#4a7a4a', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                ← Volver a recuperación por correo
              </button>
            </div>
          </form>
        ) : null}

        {/* Footer */}
        <div
          style={{
            marginTop: '2rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid #e2ede2',
            textAlign: 'center',
          }}
        >
          <Link
            href="/"
            style={{
              fontSize: 12,
              color: '#849884',
              textDecoration: 'none',
              letterSpacing: '0.02em',
            }}
          >
            ← Volver al sitio público
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Submit button with built-in loading state
 * Uses useFormStatus which reads from the parent <form>
 */
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="login-submit"
      style={{
        width: '100%',
        padding: '13px 22px',
        borderRadius: 11,
        border: 'none',
        background: 'linear-gradient(135deg, #4a7a4a 0%, #3a6a3a 100%)',
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 500,
        fontFamily: "'DM Sans', sans-serif",
        cursor: 'pointer',
        boxShadow: '0 2px 10px rgba(74, 122, 74, 0.25)',
        transition: 'all 0.2s',
        letterSpacing: '0.02em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}
    >
      {pending && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{ animation: 'spin 0.8s linear infinite' }}
        >
          <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
        </svg>
      )}
      {pending ? 'Procesando...' : label}
    </button>
  );
}
