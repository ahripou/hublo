import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatCentsAsEuros } from '@/lib/format';
import { computeUnitPrice } from '@/lib/pricing';
import type { CollectionPointRow, ProducerRow, ProductRow } from '@/lib/supabase/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';

type ProductWithPoint = ProductRow & {
    collection_points: Pick<CollectionPointRow, 'id' | 'name' | 'slug' | 'coordinator_commission_bps'> | null;
};

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
        .from('producers')
        .select('name, description')
        .eq('slug', params.slug)
        .eq('status', 'active')
        .maybeSingle<Pick<ProducerRow, 'name' | 'description'>>();

    if (!data) return { title: 'Producteur introuvable' };
    return {
        title: `${data.name} — Hublo.be`,
        description:
            data.description?.slice(0, 160) ??
            `Découvrez les produits de ${data.name} sur Hublo.be.`,
    };
}

export const dynamic = 'force-dynamic';

export default async function ProducerPage({ params }: { params: { slug: string } }) {
    const supabase = createSupabaseServerClient();

    const [{ data: producer }, { data: setting }] = await Promise.all([
        supabase
            .from('producers')
            .select('*')
            .eq('slug', params.slug)
            .eq('status', 'active')
            .maybeSingle<ProducerRow>(),
        supabase
            .from('settings')
            .select('value')
            .eq('key', 'platform_commission_bps')
            .maybeSingle<{ value: number }>(),
    ]);

    if (!producer) notFound();

    const platformBps = typeof setting?.value === 'number' ? setting.value : 3500;

    const { data: products } = await supabase
        .from('products')
        .select('*, collection_points(id, name, slug, coordinator_commission_bps)')
        .eq('producer_id', producer.id)
        .eq('status', 'active')
        .order('name')
        .returns<ProductWithPoint[]>();

    const productList = products ?? [];

    return (
        <main className="min-h-screen flex flex-col">
            <PublicHeader />

            <div className="mx-auto max-w-5xl w-full px-4 py-8 flex-1 space-y-8">
                {/* Breadcrumb */}
                <nav className="text-sm text-gray-500">
                    <Link href="/" className="hover:text-gray-900">Accueil</Link>
                    {' › '}
                    <span className="text-gray-900">{producer.name}</span>
                </nav>

                {/* Producer header */}
                <section>
                    <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">{producer.name}</h1>
                    {producer.description ? (
                        <p className="mt-2 text-gray-700 max-w-2xl whitespace-pre-line">
                            {producer.description}
                        </p>
                    ) : null}
                    {producer.vat_number ? (
                        <p className="mt-2 text-xs text-gray-500">N° TVA : {producer.vat_number}</p>
                    ) : null}
                </section>

                {/* Products */}
                <section>
                    <h2 className="text-lg font-medium text-gray-900 mb-4">
                        Produits ({productList.length})
                    </h2>

                    {productList.length === 0 ? (
                        <p className="text-sm text-gray-600">
                            Aucun produit disponible pour ce producteur.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {productList.map((p) => {
                                const coordBps = p.collection_points?.coordinator_commission_bps ?? 0;
                                const { priceTtcClientCents } = computeUnitPrice({
                                    priceHtProducerCents: p.price_ht_cents,
                                    platformCommissionBps: platformBps,
                                    coordinatorCommissionBps: coordBps,
                                    vatRate: p.vat_rate as 0 | 6 | 21,
                                });
                                return (
                                    <Link
                                        key={p.id}
                                        href={`/produits/${p.slug}`}
                                        className="rounded-lg border border-gray-200 bg-white p-4 hover:border-[var(--accent)] transition-colors block"
                                    >
                                        <div className="font-medium text-gray-900">{p.name}</div>
                                        <div className="mt-1 text-sm text-gray-600 line-clamp-2">
                                            {p.description}
                                        </div>
                                        {p.collection_points ? (
                                            <div className="mt-2 text-xs text-gray-500">
                                                📍 {p.collection_points.name}
                                            </div>
                                        ) : null}
                                        <div className="mt-2 font-semibold text-gray-900">
                                            {formatCentsAsEuros(priceTtcClientCents)}{' '}
                                            <span className="text-xs font-normal text-gray-500">TTC</span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            <PublicFooter />
        </main>
    );
}
