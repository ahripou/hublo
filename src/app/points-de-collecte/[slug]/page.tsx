import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatCentsAsEuros, formatDateTime } from '@/lib/format';
import type { CollectionPointRow, ProducerRow, ProductRow, SaleRow } from '@/lib/supabase/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { computeUnitPrice } from '@/lib/pricing';

type ScheduleShape = { day?: string | null; start?: string | null; end?: string | null };
type ProductWithProducer = ProductRow & { producers: Pick<ProducerRow, 'id' | 'name' | 'slug'> | null };
type SaleWithPoint = SaleRow & { collection_points: Pick<CollectionPointRow, 'name' | 'slug'> | null };

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
        .from('collection_points')
        .select('name, address')
        .eq('slug', params.slug)
        .eq('status', 'active')
        .maybeSingle<Pick<CollectionPointRow, 'name' | 'address'>>();
    if (!data) return { title: 'Point de collecte introuvable' };
    return {
        title: `${data.name} — Hublo.be`,
        description: `Commandez des produits locaux au point de collecte ${data.name}, ${data.address}.`,
    };
}

export const dynamic = 'force-dynamic';

export default async function CollectionPointPage({ params }: { params: { slug: string } }) {
    const supabase = createSupabaseServerClient();

    const [{ data: point }, { data: setting }] = await Promise.all([
        supabase
            .from('collection_points')
            .select('*')
            .eq('slug', params.slug)
            .eq('status', 'active')
            .maybeSingle<CollectionPointRow>(),
        supabase
            .from('settings')
            .select('value')
            .eq('key', 'platform_commission_bps')
            .maybeSingle<{ value: number }>(),
    ]);

    if (!point) notFound();

    const platformBps = typeof setting?.value === 'number' ? setting.value : 3500;

    const [{ data: products }, { data: openSale }] = await Promise.all([
        supabase
            .from('products')
            .select('*, producers(id, name, slug)')
            .eq('collection_point_id', point.id)
            .eq('status', 'active')
            .order('name')
            .returns<ProductWithProducer[]>(),
        supabase
            .from('sales')
            .select('*, collection_points(name, slug)')
            .eq('collection_point_id', point.id)
            .eq('status', 'open')
            .order('closes_at', { ascending: true })
            .limit(1)
            .maybeSingle<SaleWithPoint>(),
    ]);

    const schedule = (point.schedule as ScheduleShape | null) ?? null;
    const productList = products ?? [];

    // Group by producer
    const byProducer = productList.reduce<Record<string, { producer: ProductWithProducer['producers']; products: ProductWithProducer[] }>>((acc, p) => {
        const key = p.producer_id;
        if (!acc[key]) acc[key] = { producer: p.producers, products: [] };
        acc[key].products.push(p);
        return acc;
    }, {});

    return (
        <main className="min-h-screen flex flex-col">
            <PublicHeader />

            <div className="mx-auto max-w-5xl w-full px-4 py-8 flex-1 space-y-8">
                {/* Point header */}
                <section>
                    <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">{point.name}</h1>
                    <p className="mt-1 text-gray-600">{point.address}</p>
                    {schedule?.day ? (
                        <p className="mt-1 text-sm text-gray-500">
                            Distribution le {schedule.day}
                            {schedule.start && schedule.end
                                ? ` de ${schedule.start} à ${schedule.end}`
                                : ''}
                        </p>
                    ) : null}
                </section>

                {/* Open sale banner */}
                {openSale ? (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                        <p className="font-medium text-[var(--accent)]">
                            Vente ouverte — distribution le{' '}
                            {new Date(openSale.distribution_date).toLocaleDateString('fr-BE', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                            })}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                            Commandez avant le {formatDateTime(openSale.closes_at)}.
                        </p>
                        <Link href="/auth/login" className="mt-3 btn-primary inline-flex">
                            Commander →
                        </Link>
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                        Aucune vente ouverte en ce moment. Revenez bientôt !
                    </div>
                )}

                {/* Catalogue */}
                {productList.length === 0 ? (
                    <p className="text-sm text-gray-600">Aucun produit au catalogue pour le moment.</p>
                ) : (
                    Object.values(byProducer).map(({ producer, products: prods }) => (
                        <section key={producer?.id ?? 'unknown'} className="space-y-3">
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-lg font-medium text-gray-900">{producer?.name ?? 'Producteur'}</h2>
                                {producer?.slug ? (
                                    <Link
                                        href={`/producteurs/${producer.slug}`}
                                        className="text-xs text-[var(--accent)]"
                                    >
                                        Voir la fiche
                                    </Link>
                                ) : null}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {prods.map((product) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        platformBps={platformBps}
                                        coordinatorBps={point.coordinator_commission_bps}
                                    />
                                ))}
                            </div>
                        </section>
                    ))
                )}
            </div>

            <PublicFooter />
        </main>
    );
}

function ProductCard({
    product,
    platformBps,
    coordinatorBps,
}: {
    product: ProductWithProducer;
    platformBps: number;
    coordinatorBps: number;
}) {
    const { priceTtcClientCents } = computeUnitPrice({
        priceHtProducerCents: product.price_ht_cents,
        platformCommissionBps: platformBps,
        coordinatorCommissionBps: coordinatorBps,
        vatRate: product.vat_rate as 0 | 6 | 21,
    });

    return (
        <Link
            href={`/produits/${product.slug}`}
            className="rounded-lg border border-gray-200 bg-white overflow-hidden hover:border-[var(--accent)] transition-colors block"
        >
            {product.photo_url ? (
                <div className="relative aspect-video bg-gray-100">
                    <Image
                        src={product.photo_url}
                        alt={product.photo_alt ?? product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                </div>
            ) : (
                <div className="aspect-video bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                    Pas de photo
                </div>
            )}
            <div className="p-3">
                <div className="font-medium text-gray-900">{product.name}</div>
                <div className="mt-1 text-sm text-gray-600 line-clamp-2">{product.description}</div>
                <div className="mt-2 font-semibold text-gray-900">
                    {formatCentsAsEuros(priceTtcClientCents)}{' '}
                    <span className="text-xs font-normal text-gray-500">TTC</span>
                </div>
            </div>
        </Link>
    );
}
