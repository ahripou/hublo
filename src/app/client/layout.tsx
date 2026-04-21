import Link from 'next/link';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
    const supabase = createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    let cartCount = 0;
    if (user) {
        const { data } = await supabase
            .from('cart_items')
            .select('qty')
            .eq('client_user_id', user.id)
            .returns<{ qty: number }[]>();
        cartCount = (data ?? []).reduce((acc, it) => acc + it.qty, 0);
    }

    return (
        <div className="min-h-screen flex flex-col">
            <header className="border-b border-gray-200 bg-white">
                <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
                    <Link href="/client" className="text-lg font-semibold text-[var(--accent)]">
                        Hublo.be
                    </Link>
                    <nav className="flex items-center gap-3">
                        <Link
                            href="/client/commandes"
                            className="text-sm font-medium text-gray-700 hover:text-gray-900"
                        >
                            Mes commandes
                        </Link>
                        <Link
                            href="/client/panier"
                            className="relative inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
                        >
                            Panier
                            {cartCount > 0 ? (
                                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-[var(--accent)] text-white text-xs font-semibold">
                                    {cartCount}
                                </span>
                            ) : null}
                        </Link>
                        <form action="/auth/logout" method="post">
                            <button type="submit" className="btn-secondary">
                                Déconnexion
                            </button>
                        </form>
                    </nav>
                </div>
            </header>
            <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
        </div>
    );
}
