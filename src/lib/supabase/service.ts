import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase avec la clé service_role — bypass RLS.
 *
 * À n'utiliser QUE côté serveur, jamais dans un component client.
 * Cas d'usage MVP :
 *  - Webhook Mollie (pas de session utilisateur, callback server-to-server).
 *  - Jobs cron (cron Supabase → Edge Function).
 *
 * Ne jamais l'utiliser dans un flux authentifié normal — on passe par
 * `createSupabaseServerClient` qui respecte les RLS policies.
 */
let cached: SupabaseClient | null = null;

export function createSupabaseServiceRoleClient(): SupabaseClient {
    if (cached) return cached;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
        throw new Error(
            'Supabase service-role client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        );
    }
    cached = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    return cached;
}
