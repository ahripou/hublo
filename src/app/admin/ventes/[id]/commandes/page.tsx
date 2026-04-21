import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatCentsAsEuros, formatDate, formatDateTime } from '@/lib/format';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface OrderLine {
    id: string;
    qty: number;
    status: string;
    products: { name: string } | null;
    producers: { name: string } | null;
}

interface OrderWithClient {
    id: string;
    status: string;
    total_ttc_cents: number;
    created_at: string;
    users: { email: string; first_name: string | null; last_name: string | null } | null;
    order_lines: OrderLine[];
}

interface SaleBasic {
    id: string;
    distribution_date: string;
    status: string;
}

function clientDisplayName(u: OrderWithClient['users']): string {
    if (!u) return '—';
    const full = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();
    return full || u.email;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
    confirmed: 'Confirmée',
    pending_payment: 'En attente',
    cancelled: 'Annulée',
    payment_failed: 'Paiement échoué',
    draft: 'Brouillon',
};

export default async function SaleOrdersPage({ params }: { params: { id: string } }) {
    const supabase = createSupabaseServerClient();

    const [{ data: sale }, { data: orders }] = await Promise.all([
        supabase
            .from('sales')
            .select('id, distribution_date, status')
            .eq('id', params.id)
            .maybeSingle<SaleBasic>(),
        supabase
            .from('orders')
            .select(
                'id, status, total_ttc_cents, created_at, users(email, first_name, last_name), order_lines(id, qty, status, products(name), producers(name))',
            )
            .eq('sale_id', params.id)
            .order('created_at', { ascending: true })
            .returns<OrderWithClient[]>(),
    ]);

    if (!sale) notFound();

    const orderList = orders ?? [];
    const confirmed = orderList.filter((o) => o.status === 'confirmed');
    const totalTtc = confirmed.reduce((sum, o) => sum + o.total_ttc_cents, 0);

    return (
        <div className="space-y-6">
            <div>
                <Link
                    href={`/admin/ventes/${sale.id}`}
                    className="text-sm text-gray-600 hover:text-gray-900"
                >
                    ← Retour à la vente
                </Link>
                <h1 className="mt-2 text-2xl font-semibold text-gray-900">
                    Commandes — distribution {formatDate(sale.distribution_date)}
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                    {confirmed.length} commande(s) confirmée(s) · Total{' '}
                    {formatCentsAsEuros(totalTtc)}
                </p>
            </div>

            <div className="flex flex-wrap gap-3">
                <Link
                    href={`/admin/ventes/${sale.id}/bon-de-preparation`}
                    className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                    Bon de préparation
                </Link>
            </div>

            {orderList.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                    <p className="text-gray-500">Aucune commande pour cette vente.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {orderList.map((order) => (
                        <div
                            key={order.id}
                            className="rounded-lg border border-gray-200 bg-white overflow-hidden"
                        >
                            <div className="flex items-start justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                                <div>
                                    <span className="font-medium text-gray-900">
                                        {clientDisplayName(order.users)}
                                    </span>
                                    <span className="ml-2 font-mono text-xs text-gray-400">
                                        #{order.id.slice(0, 8)}
                                    </span>
                                    <div className="text-xs text-gray-500">
                                        {formatDateTime(order.created_at)}
                                    </div>
                                </div>
                                <div className="text-right shrink-0 ml-4">
                                    <span className="text-xs text-gray-500">
                                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                                    </span>
                                    <div className="font-semibold text-gray-900">
                                        {formatCentsAsEuros(order.total_ttc_cents)}
                                    </div>
                                </div>
                            </div>
                            <ul className="divide-y divide-gray-50 px-4">
                                {order.order_lines
                                    .filter((l) => l.status === 'active')
                                    .map((line) => (
                                        <li
                                            key={line.id}
                                            className="py-2 flex items-center justify-between text-sm"
                                        >
                                            <span className="text-gray-700">
                                                {line.products?.name ?? '—'}
                                                <span className="text-gray-400 ml-1 text-xs">
                                                    ({line.producers?.name ?? '—'})
                                                </span>
                                            </span>
                                            <span className="font-medium text-gray-900">
                                                × {line.qty}
                                            </span>
                                        </li>
                                    ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
