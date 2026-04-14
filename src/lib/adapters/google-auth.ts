import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Google OAuth helper.
 *
 * Flow:
 *   1. /api/google/connect  → buildAuthUrl()           → redirect to Google
 *   2. /api/google/callback → exchangeCodeForTokens()  → saveTokens()
 *   3. Any server code      → getAuthenticatedClient() → auto-refresh if needed
 *
 * Storage: one row in `google_integrations` (single-tenant for now).
 */

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

function getRedirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google/callback';
}

/** Builds a fresh OAuth2 client with env credentials (no tokens loaded). */
export function createOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth no configurado: falta GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET');
  }
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

/** URL to start the OAuth consent flow. `state` is echoed back in callback. */
export function buildAuthUrl(state: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',  // needed for refresh_token
    prompt: 'consent',       // force refresh_token even on re-consent
    scope: SCOPES,
    state,
  });
}

/** Exchanges an auth code for tokens (does not persist). */
export async function exchangeCodeForTokens(code: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Google no devolvió tokens completos (falta refresh_token). Intenta desconectar y reconectar desde Google.');
  }
  // Fetch the account email so we can display it
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const userInfo = await oauth2.userinfo.get();
  return {
    tokens,
    email: userInfo.data.email || '',
  };
}

export async function saveTokens(params: {
  tokens: { access_token?: string | null; refresh_token?: string | null; token_type?: string | null; scope?: string | null; expiry_date?: number | null };
  email: string;
}) {
  const supabase = createAdminClient();
  const expiresAt = params.tokens.expiry_date
    ? new Date(params.tokens.expiry_date).toISOString()
    : new Date(Date.now() + 60 * 60 * 1000).toISOString();

  // Upsert single row
  const { data: existing } = await supabase
    .from('google_integrations')
    .select('id')
    .limit(1)
    .single();

  const row = {
    account_email:  params.email,
    access_token:   params.tokens.access_token!,
    refresh_token:  params.tokens.refresh_token!,
    token_type:     params.tokens.token_type || 'Bearer',
    scope:          params.tokens.scope || SCOPES.join(' '),
    expires_at:     expiresAt,
    calendar_id:    'primary',
  };

  if (existing?.id) {
    const { error } = await supabase.from('google_integrations').update(row).eq('id', existing.id);
    if (error) throw new Error('Error al guardar tokens: ' + error.message);
  } else {
    const { error } = await supabase.from('google_integrations').insert(row);
    if (error) throw new Error('Error al guardar tokens: ' + error.message);
  }
}

/**
 * Returns an OAuth2Client with credentials loaded and auto-refresh wired.
 * Throws if no integration is configured.
 */
export async function getAuthenticatedClient(): Promise<{ client: OAuth2Client; calendarId: string; email: string } | null> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from('google_integrations')
    .select('*')
    .limit(1)
    .single();

  if (!row) return null;

  const client = createOAuthClient();
  client.setCredentials({
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    token_type: row.token_type,
    scope: row.scope,
    expiry_date: new Date(row.expires_at).getTime(),
  });

  // When google-auth-library refreshes automatically, persist the new token.
  client.on('tokens', async (tokens) => {
    if (!tokens.access_token) return;
    const update: Record<string, unknown> = {
      access_token: tokens.access_token,
      expires_at: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
    if (tokens.refresh_token) update.refresh_token = tokens.refresh_token;
    await supabase.from('google_integrations').update(update).eq('id', row.id);
  });

  return { client, calendarId: row.calendar_id || 'primary', email: row.account_email };
}

export async function disconnectGoogle(): Promise<void> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from('google_integrations')
    .select('id, access_token')
    .limit(1)
    .single();
  if (!row) return;

  // Best-effort revoke
  try {
    const client = createOAuthClient();
    await client.revokeToken(row.access_token);
  } catch {
    // ignore: token may already be invalid
  }

  await supabase.from('google_integrations').delete().eq('id', row.id);
}

export async function getGoogleIntegrationStatus(): Promise<{ connected: boolean; email?: string }> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from('google_integrations')
    .select('account_email')
    .limit(1)
    .single();
  if (!row) return { connected: false };
  return { connected: true, email: row.account_email };
}
