'use server';

import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export type AuthFormState = { error: string | null };

function sanitizeRedirect(raw: FormDataEntryValue | null): string | null {
    if (typeof raw !== 'string') return null;
    if (!raw.startsWith('/') || raw.startsWith('//')) return null;
    return raw;
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const redirectTo = sanitizeRedirect(formData.get('redirect'));

    if (!email || !password) {
        return { error: 'Email et mot de passe requis.' };
    }

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        return { error: 'Identifiants invalides.' };
    }

    // Le middleware se chargera de rediriger vers /admin ou /client selon le rôle
    // si on pointe vers une page d'auth — on privilégie le redirect explicite sinon.
    redirect(redirectTo ?? '/client');
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const firstName = String(formData.get('first_name') ?? '').trim() || null;
    const lastName = String(formData.get('last_name') ?? '').trim() || null;

    if (!email || !password) {
        return { error: 'Email et mot de passe requis.' };
    }
    if (password.length < 8) {
        return { error: 'Le mot de passe doit contenir au moins 8 caractères.' };
    }

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { first_name: firstName, last_name: lastName },
        },
    });
    if (error) {
        return { error: error.message };
    }

    redirect('/client');
}

export async function logoutAction(): Promise<void> {
    const supabase = createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect('/');
}
