'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTrafficSnapshot, isCloudflareConfigured, type TrafficSnapshot } from '@/lib/adapters/cloudflare-analytics';

/**
 * Server action: snapshot de tráfico web (Cloudflare Web Analytics).
 *
 * - Requiere usuario autenticado (admin).
 * - Si CF no está configurado → { configured: false }.
 * - Si CF responde con error → { success: false, error }.
 * - El cache lo maneja el cliente (revalida cada 5 min vía polling).
 *   Aquí no usamos unstable_cache para evitar guardar credenciales en el
 *   serializado del cache.
 */
export async function getTrafficData(): Promise<
  | { success: true; configured: true; data: TrafficSnapshot }
  | { success: true; configured: false }
  | { success: false; error: string }
> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'No autorizado' };

  if (!isCloudflareConfigured()) {
    return { success: true, configured: false };
  }

  try {
    const snapshot = await getTrafficSnapshot();
    if (!snapshot) return { success: true, configured: false };
    return { success: true, configured: true, data: snapshot };
  } catch (e) {
    console.error('[getTrafficData] Cloudflare error:', e);
    return { success: false, error: (e as Error).message || 'Error consultando Cloudflare' };
  }
}
