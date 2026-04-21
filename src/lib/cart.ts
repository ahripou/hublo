import type { SupabaseClient } from '@supabase/supabase-js';

import { computeLineTotals, type OrderLineSnapshot } from './pricing';
import type {
    CollectionPointRow,
    ProducerRow,
    ProductRow,
    SaleRow,
    VatRate,
} from './supabase/db-types';

export interface CartItemRow {
    id: string;
    client_user_id: string;
    sale_id: string;
    product_id: string;
    qty: number;
    updated_at: string;
}

export interface LoadedCartItem {
    id: string;
    qty: number;
    product: ProductRow;
    producer: Pick<ProducerRow, 'id' | 'name' | 'slug'>;
    totals: ReturnType<typeof computeLineTotals>;
}

export interface LoadedCart {
    items: LoadedCartItem[];
    sale: SaleRow | null;
    collectionPoint: CollectionPointRow | null;
    platformCommissionBps: number;
    totals: {
        totalHtCents: number;
        totalVatCents: number;
        totalTtcCents: number;
    };
}

type JoinedCartItem = CartItemRow & {
    products:
        | (ProductRow & { producers: Pick<ProducerRow, 'id' | 'name' | 'slug'> | null })
        | null;
    sales: (SaleRow & { collection_points: CollectionPointRow | null }) | null;
};

/**
 * Charge le panier d'un utilisateur avec toutes les données jointes et les
 * totaux calculés. Filtre automatiquement les items appartenant à une vente
 * qui n'est plus `open` (orphelins après clôture).
 */
export async function loadCart(
    supabase: SupabaseClient,
    userId: string,
): Promise<LoadedCart> {
    const [{ data: items }, { data: setting }] = await Promise.all([
        supabase
            .from('cart_items')
            .select(
                'id, client_user_id, sale_id, product_id, qty, updated_at, ' +
                    'products(*, producers(id, name, slug)), ' +
                    'sales(*, collection_points(*))',
            )
            .eq('client_user_id', userId)
            .order('updated_at', { ascending: false })
            .returns<JoinedCartItem[]>(),
        supabase
            .from('settings')
            .select('value')
            .eq('key', 'platform_commission_bps')
            .maybeSingle<{ value: number }>(),
    ]);

    const platformBps = typeof setting?.value === 'number' ? setting.value : 3500;

    const live =
        (items ?? []).filter(
            (it) =>
                it.products &&
                it.sales &&
                it.sales.status === 'open' &&
                it.products.status === 'active',
        ) ?? [];

    const sale = live[0]?.sales ?? null;
    const collectionPoint = sale?.collection_points ?? null;
    const coordinatorBps = collectionPoint?.coordinator_commission_bps ?? 0;

    const loadedItems: LoadedCartItem[] = live.map((it) => {
        const product = it.products!;
        const snapshot: OrderLineSnapshot = {
            qty: it.qty,
            unitPriceHtCents: product.price_ht_cents,
            vatRate: product.vat_rate as VatRate,
            platformCommissionBps: platformBps,
            coordinatorCommissionBps: coordinatorBps,
        };
        return {
            id: it.id,
            qty: it.qty,
            product,
            producer: it.products!.producers ?? { id: '', name: '—', slug: '' },
            totals: computeLineTotals(snapshot),
        };
    });

    const totals = loadedItems.reduce(
        (acc, it) => {
            acc.totalHtCents += it.totals.lineHtClientCents;
            acc.totalVatCents += it.totals.lineVatCents;
            acc.totalTtcCents += it.totals.lineTtcClientCents;
            return acc;
        },
        { totalHtCents: 0, totalVatCents: 0, totalTtcCents: 0 },
    );

    return {
        items: loadedItems,
        sale,
        collectionPoint,
        platformCommissionBps: platformBps,
        totals,
    };
}
