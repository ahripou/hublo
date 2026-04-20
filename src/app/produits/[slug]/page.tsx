import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatCentsAsEuros } from '@/lib/format';
import { computeUnitPrice } from '@/lib/pricing';
import type { CollectionPointRow, ProducerRow, ProductRow } from '@/lib/supabase/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';

type ProductFull = ProductRow & {
    producers: Pick<ProducerRow, 'id' | 'name' | 'slug' | 'description'> | null;
    collection_points: Pick<CollectionPointRow, 'id' | 'name' | 'slug' | 'coordinator_commission_bps'> | null;
};

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
        .from('products')
        .select('name, description, photo_url, photo_alt, producers(name)')
        .eq('slug', params.slug)
        .eq('status', 'active')
        .maybeSingle<ProductRow & { producers: Pick<ProducerRow, 'name'> | null }>();

    if (!data) return { title: 'Produit introuvable' };

    return {
        title: `${data.name} — ${data.producers?.name ?? 'Hublo.be'}`,
        description: data.description.slice(0, 160),
        openGraph: {
            title: data.name,
            description: data.description.slice(0, 160),
            images: data.photo_url
                ? [{ url: data.photo_url, alt: data.photo_alt ?? data.name }]
                : [],
        },
    };
}

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: { slug: string } }) {
    const supabase = createSupabaseServerClient();

    const [{ data: product }, { data: setting }] = await Promise.all([
        supabase
            .from('products')
            .select('*, producers(id, name, slug, description), collection_points(id, name, slug, coordinator_commission_bps)')
            .eq('slug', params.slug)
            .eq('status', 'active')
            .maybeSingle<ProductFull>(),
        supabase
            .from('settings')
            .select('value')
            .eq('key', 'platform_commission_bps')
            .maybeSingle<{ value: number }>(),
    ]);

    if (!product) notFound();

    const platformBps = typeof setting?.value === 'number' ? setting.value : 3500;
    const coordinatorBps = product.collection_points?.coordinator_commission_bps ?? 0;

    const { priceHtClientCents, priceTtcClientCents, vatAmountCents } = computeUnitPrice({
        priceHtProducerCents: product.price_ht_cents,
        platformCommissionBps: platformBps,
        coordinatorCommissionBps: coordinatorBps,
        vatRate: product.vat_rate as 0 | 6 | 21,
    });

    return (
        <main className="min-h-screen flex flex-col">
            <PublicHeader />

            <div className="mx-auto max-w-5xl w-full px-4 py-8 flex-1">
                {/* Breadcrumb */}
                <nav className="text-sm text-gray-500 mb-6 flex flex-wrap gap-1">
                    <Link href="/" className="hover:text-gray-900">Accueil</Link>
                    <span>›</span>
                    {product.collection_points ? (
                        <>
                            <Link
                                href={`/points-de-collecte/${product.collection_points.slug}`}
                                className="hover:text-gray-900"
                            >
                                {product.collection_points.name}
                            </Link>
                            <span>›</span>
                        </>
                    ) : null}
                    <span className="text-gray-900">{product.name}</span>
                </nav>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    {/* Photo */}
                    <div className="rounded-lg overflow-hidden bg-gray-100 aspect-square relative">
                        {product.photo_url ? (
                            <Image
                                src={product.photo_url}
                                alt={product.photo_alt ?? product.name}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 50vw"
                                priority
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                                Pas de photo
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="space-y-4">
                        {product.producers ? (
                            <Link
                                href={`/producteurs/${product.producers.slug}`}
                                className="text-sm font-medium text-[var(--accent)]"
                            >
                                {product.producers.name}
                            </Link>
                        ) : null}
                        <h1 className="text-2xl font-semibold text-gray-900">{product.name}</h1>
                        <p className="text-gray-700">{product.description}</p>

                        {/* Pricing */}
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Prix HT</span>
                                <span>{formatCentsAsEuros(priceHtClientCents)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">TVA ({product.vat_rate}%)</span>
                                <span>{formatCentsAsEuros(vatAmountCents)}</span>
                            </div>
                            <div className="flex justify-between font-semibold text-base pt-1 border-t border-gray-200">
                                <span>Prix TTC</span>
                                <span className="text-[var(--accent)]">{formatCentsAsEuros(priceTtcClientCents)}</span>
                            </div>
                        </div>

                        {/* Stock */}
                        {!product.stock_unlimited && (product.stock_qty ?? 0) < 10 ? (
                            <p className="text-sm text-amber-700">
                                Plus que {product.stock_qty} en stock.
                            </p>
                        ) : null}

                        <Link href="/auth/login" className="btn-primary w-full justify-center">
                            Commander
                        </Link>
                        <p className="text-xs text-gray-500">
                            Connexion requise pour passer une commande.
                        </p>
                    </div>
                </div>
            </div>

            <PublicFooter />
        </main>
    );
}
