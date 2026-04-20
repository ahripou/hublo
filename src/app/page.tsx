import Link from 'next/link';

import { formatDate, formatDateTime } from '@/lib/format';
import type { CollectionPointRow, SaleRow } from '@/lib/supabase/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';

type SaleWithPoint = SaleRow & { collection_points: Pick<CollectionPointRow, 'name' | 'slug' | 'address'> | null };

export default async function HomePage() {
    const supabase = createSupabaseServerClient();
    const { data: sales } = await supabase
        .from('sales')
        .select('*, collection_points(name, slug, address)')
        .eq('status', 'open')
        .order('distribution_date', { ascending: true })
        .returns<SaleWithPoint[]>();

    const openSales = sales ?? [];

    return (
        <main className="min-h-screen flex flex-col">
            <PublicHeader />

            <section className="mx-auto max-w-5xl px-4 py-10">
                <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900">
                    Des produits locaux, directement chez votre producteur.
                </h1>
                <p className="mt-3 text-gray-700 max-w-2xl">
                    Commandez en ligne, récupérez sur place à votre point de collecte.
                </p>
            </section>

            <section className="mx-auto max-w-5xl px-4 pb-12 space-y-4">
                <h2 className="text-lg font-medium text-gray-900">Ventes en cours</h2>

                {openSales.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
                        Aucune vente ouverte pour le moment. Revenez bientôt !
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {openSales.map((sale) => (
                            <SaleCard key={sale.id} sale={sale} />
                        ))}
                    </div>
                )}
            </section>

            <PublicFooter />
        </main>
    );
}

function SaleCard({ sale }: { sale: SaleWithPoint }) {
    const point = sale.collection_points;
    const href = point ? `/points-de-collecte/${point.slug}` : '#';

    return (
        <Link
            href={href}
            className="rounded-lg border border-gray-200 bg-white p-5 hover:border-[var(--accent)] transition-colors block"
        >
            <div className="text-xs font-medium text-[var(--accent)] uppercase tracking-wide mb-1">
                Distribution le {formatDate(sale.distribution_date)}
            </div>
            <div className="font-medium text-gray-900 text-lg">{point?.name ?? 'Point de collecte'}</div>
            {point?.address ? (
                <div className="mt-1 text-sm text-gray-600 line-clamp-1">{point.address}</div>
            ) : null}
            <div className="mt-3 text-xs text-gray-500">
                Commandes ouvertes jusqu&apos;au {formatDateTime(sale.closes_at)}
            </div>
            <div className="mt-3 btn-primary inline-flex">Commander →</div>
        </Link>
    );
}
