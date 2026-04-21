import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { formatCentsAsEuros, formatDate, formatDateTime } from '@/lib/format';
import { computeUnitPrice } from '@/lib/pricing';
import type {
    CollectionPointRow,
    ProducerRow,
    ProductRow,
    SaleRow,
    VatRate,
} from '@/lib/supabase/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface OrderDetail {
    id: string;
    status: string;
    client_user_id: string;
    total_ht_cents: number;
    total_tva_cents: number;
    total_ttc_cents: number;
    created_at: string;
    sales: (SaleRow & { collection_points: CollectionPointRow | null }) | null;
}

interface LineDetail {
    id: string;
    qty: number;
    unit_price_ht_cents: number;
    vat_rate: VatRate;
    platform_commission_bps: number;
    coordinator_commission_bps: number;
    products: Pick<ProductRow, 'name' | 'slug'> | null;
    producers: Pick<ProducerRow, 'name'> | null;
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
    const supabase = createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/auth/login?redirect=/client/commandes/${params.id}`);

    const [{ data: order }, { data: lines }] = await Promise.all([
        supabase
            .from('orders')
            .select(
                'id, status, client_user_id, total_ht_cents, total_tva_cents, total_ttc_cents, created_at, sales(*, collection_points(*))',
            )
            .eq('id', params.id)
            .maybeSingle<OrderDetail>(),
        supabase
            .from('order_lines')
            .select(
                'id, qty, unit_price_ht_cents, vat_rate, platform_commission_bps, coordinator_commission_bps, products(name, slug), producers(name)',
            )
            .eq('order_id', params.id)
            .eq('status', 'active')
            .returns<LineDetail[]>(),
    ]);

    if (!order || order.client_user_id !== user.id) notFound();

    return (
        <div className="space-y-6 max-w-2xl">
            <nav className="text-sm text-gray-500">
                <Link href="/client/commandes" className="hover:text-gray-900">
                    ← Mes commandes
                </Link>
            </nav>
            <header>
                <h1 className="text-2xl font-semibold text-gray-900">
                    Commande #{order.id.slice(0, 8)}
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                    Passée le {formatDateTime(order.created_at)}
                </p>
            </header>

            {order.sales && order.sales.collection_points ? (
                <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm space-y-1">
                    <div className="flex justify-between">
                        <span className="text-gray-600">Distribution</span>
                        <span>{formatDate(order.sales.distribution_date)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">Point de collecte</span>
                        <span>{order.sales.collection_points.name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">Adresse</span>
                        <span className="text-right">{order.sales.collection_points.address}</span>
                    </div>
                </section>
            ) : null}

            <section className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                {(lines ?? []).map((l) => {
                    const unit = computeUnitPrice({
                        priceHtProducerCents: l.unit_price_ht_cents,
                        platformCommissionBps: l.platform_commission_bps,
                        coordinatorCommissionBps: l.coordinator_commission_bps,
                        vatRate: l.vat_rate,
                    });
                    const lineTtc = unit.priceTtcClientCents * l.qty;
                    return (
                        <div key={l.id} className="p-4 flex items-center justify-between gap-4 text-sm">
                            <div className="min-w-0">
                                {l.products?.slug ? (
                                    <Link
                                        href={`/produits/${l.products.slug}`}
                                        className="font-medium text-gray-900 hover:text-[var(--accent)]"
                                    >
                                        {l.products.name}
                                    </Link>
                                ) : (
                                    <span className="font-medium text-gray-900">{l.products?.name}</span>
                                )}
                                <div className="text-gray-600">
                                    {l.producers?.name ?? '—'} · Qté {l.qty}
                                </div>
                            </div>
                            <div className="text-right shrink-0 font-semibold">
                                {formatCentsAsEuros(lineTtc)}
                            </div>
                        </div>
                    );
                })}
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-1 text-sm">
                <div className="flex justify-between">
                    <span className="text-gray-600">Sous-total HT</span>
                    <span>{formatCentsAsEuros(order.total_ht_cents)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">TVA</span>
                    <span>{formatCentsAsEuros(order.total_tva_cents)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base pt-2 border-t border-gray-200">
                    <span>Total TTC</span>
                    <span className="text-[var(--accent)]">
                        {formatCentsAsEuros(order.total_ttc_cents)}
                    </span>
                </div>
            </section>
        </div>
    );
}
