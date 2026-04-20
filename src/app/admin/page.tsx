import Link from 'next/link';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function countActive(table: string, status: string | null = 'active') {
    const supabase = createSupabaseServerClient();
    const query = supabase.from(table).select('*', { count: 'exact', head: true });
    const scoped = status ? query.eq('status', status) : query;
    const { count } = await scoped;
    return count ?? 0;
}

export default async function AdminHomePage() {
    const supabase = createSupabaseServerClient();
    const [
        { data: user },
        producers,
        collectionPoints,
        products,
        openSales,
        { data: commission },
    ] = await Promise.all([
        supabase.auth.getUser(),
        countActive('producers'),
        countActive('collection_points'),
        countActive('products'),
        countActive('sales', 'open'),
        supabase
            .from('settings')
            .select('value')
            .eq('key', 'platform_commission_bps')
            .maybeSingle<{ value: number }>(),
    ]);

    const commissionPercent =
        typeof commission?.value === 'number' ? (commission.value / 100).toFixed(2) : '35.00';

    const cards: { title: string; value: string; href: string }[] = [
        { title: 'Producteurs actifs', value: String(producers), href: '/admin/producteurs' },
        { title: 'Produits actifs', value: String(products), href: '/admin/produits' },
        { title: 'Points de collecte actifs', value: String(collectionPoints), href: '/admin/points-de-collecte' },
        { title: 'Ventes ouvertes', value: String(openSales), href: '/admin/ventes' },
        { title: 'Commission plateforme', value: `${commissionPercent}%`, href: '/admin/parametres' },
    ];

    return (
        <div className="space-y-6">
            <section>
                <h1 className="text-2xl font-semibold text-gray-900">Tableau de bord</h1>
                <p className="mt-1 text-sm text-gray-600">
                    Connecté en tant que {user.user?.email}.
                </p>
            </section>
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map((card) => (
                    <Link
                        key={card.title}
                        href={card.href}
                        className="rounded-lg border border-gray-200 bg-white p-4 hover:border-[var(--accent)] transition-colors"
                    >
                        <div className="text-sm text-gray-600">{card.title}</div>
                        <div className="mt-2 text-2xl font-semibold text-gray-900">{card.value}</div>
                    </Link>
                ))}
            </section>
        </div>
    );
}
