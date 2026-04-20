import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseMiddlewareClient } from '@/lib/supabase/middleware';
import type { UserRole } from '@/lib/supabase/types';

const ADMIN_PREFIX = '/admin';
const CLIENT_PREFIX = '/client';
const AUTH_PREFIX = '/auth';

/**
 * Protection des routes :
 *  - /admin/* → admin uniquement
 *  - /client/* → authentifié uniquement
 *  - /auth/login & /auth/register → redirige vers /client si déjà connecté
 */
export async function middleware(request: NextRequest) {
    const { supabase, response } = createSupabaseMiddlewareClient(request);
    const { pathname } = request.nextUrl;

    // Renouvelle la session à chaque requête.
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const isAdminRoute = pathname.startsWith(ADMIN_PREFIX);
    const isClientRoute = pathname.startsWith(CLIENT_PREFIX);
    const isAuthPage = pathname === '/auth/login' || pathname === '/auth/register';

    if (!user) {
        if (isAdminRoute || isClientRoute) {
            const url = request.nextUrl.clone();
            url.pathname = '/auth/login';
            url.searchParams.set('redirect', pathname);
            return NextResponse.redirect(url);
        }
        return response;
    }

    // Utilisateur connecté : on lit le rôle depuis public.users.
    const { data: profile } = await supabase
        .from('users')
        .select('role, status')
        .eq('id', user.id)
        .single<{ role: UserRole; status: string }>();

    if (!profile || profile.status !== 'active') {
        // Compte suspendu ou rangée applicative manquante → on déconnecte.
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = '/auth/login';
        return NextResponse.redirect(url);
    }

    if (isAdminRoute && profile.role !== 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/client';
        return NextResponse.redirect(url);
    }

    if (isAuthPage) {
        const url = request.nextUrl.clone();
        url.pathname = profile.role === 'admin' ? '/admin' : '/client';
        return NextResponse.redirect(url);
    }

    if (pathname.startsWith(AUTH_PREFIX) && pathname !== '/auth/logout') {
        // Tout autre chemin /auth reste public pour l'instant.
        return response;
    }

    return response;
}

export const config = {
    matcher: [
        // Exclut les fichiers statiques, images, favicon et la route webhook
        '/((?!_next/static|_next/image|favicon.ico|api/webhooks/|.*\\..*).*)',
    ],
};
