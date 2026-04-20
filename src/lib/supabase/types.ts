/**
 * Types applicatifs alignés sur le schéma SQL.
 * Pas de types auto-générés au MVP — on duplique manuellement les shapes
 * utiles pour garder la surface de code petite. À migrer vers
 * `supabase gen types` quand le schéma sera stable.
 */

export type UserRole = 'admin' | 'client';
export type UserStatus = 'active' | 'suspended' | 'disabled';

export interface AppUser {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    role: UserRole;
    status: UserStatus;
    created_at: string;
    updated_at: string;
}
