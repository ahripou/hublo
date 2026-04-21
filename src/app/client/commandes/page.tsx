import Link from 'next/link';
import { redirect } from 'next/navigation';

import { formatCentsAsEuros, formatDate, formatDateTime } from '@/lib/format';
import type { CollectionPointRow, SaleRow } from '@/lib/supabase/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface OrderWithSale {
    id: string;
    status: string;
    total_ttc_cents: number;
    created_at: string;
    sales: (SaleRow & { collection_points: Pick<CollectionPointRow, 'name'> | null }) | null;
}

export default async function OrdersListPage() {
    const supabase = createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login?redirect=/client/commandes');

    const { data: orders } = await supabase
        .from('orders')
        .select('id, status, total_ttc_cents, created_at, sales(*, collection_points(name))')
        .eq('client_user_id', user.id)
        .order('created_at', { ascending: false })
        .returns<OrderWithSale[]>();

    const orderList = orders ?? [];

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-gray-900">Mes commandes</h1>
            </header>

            {orderList.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                    <p className="text-gray-600">Vous n&apos;avez pas encore passé de commande.</p>
                </div>
            ) : (
                <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                    {orderList.map((o) => (
                        <Link
                            key={o.id}
                            href={`/client/commandes/${o.id}`}
                            className="block p-4 hover:bg-gray-50"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="font-mono text-xs text-gray-500">
                                        #{o.id.slice(0, 8)}
                                    </div>
                                    <div className="font-medium text-gray-900">
                                        {o.sales?.collection_points?.name ?? '—'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        Distribution{' '}
                                        {o.sales ? formatDate(o.sales.distribution_date) : '—'}
                                        {' · '}
                                        passée le {formatDateTime(o.created_at)}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <OrderStatusBadge status={o.status} />
                                    <div className="mt-1 font-semibold">
                                        {formatCentsAsEuros(o.total_ttc_cents)}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

function OrderStatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; classes: string }> = {
        draft: { label: 'Brouillon', classes: 'bg-gray-100 text-gray-600' },
        pending_payment: { label: 'En attente', classes: 'bg-amber-50 text-amber-700' },
        confirmed: { label: 'Confirmée', classes: 'bg-green-50 text-[var(--accent)]' },
        cancelled: { label: 'Annulée', classes: 'bg-gray-100 text-gray-600' },
        payment_failed: { label: 'Paiement échoué', classes: 'bg-red-50 text-red-700' },
    };
    const entry = map[status] ?? { label: status, classes: 'bg-gray-100 text-gray-600' };
    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${entry.classes}`}
        >
            {entry.label}
        </span>
    );
}
