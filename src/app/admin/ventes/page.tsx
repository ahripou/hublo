import Link from 'next/link';

import { formatDate, formatDateTime } from '@/lib/format';
import type { CollectionPointRow, SaleRow } from '@/lib/supabase/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { cancelSaleAction, closeSaleAction, openSaleAction } from './actions';

export const dynamic = 'force-dynamic';

type SaleWithPoint = SaleRow & { collection_points: Pick<CollectionPointRow, 'name'> | null };

export default async function VentesPage() {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
        .from('sales')
        .select('*, collection_points(name)')
        .order('distribution_date', { ascending: false })
        .returns<SaleWithPoint[]>();

    const sales = data ?? [];

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Ventes</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        {sales.length} vente{sales.length > 1 ? 's' : ''}.
                    </p>
                </div>
                <Link href="/admin/ventes/nouveau" className="btn-primary">
                    Nouvelle
                </Link>
            </header>

            {error ? (
                <p className="text-sm text-red-600">{error.message}</p>
            ) : sales.length === 0 ? (
                <p className="text-sm text-gray-600">
                    Aucune vente. Crée un point de collecte puis ouvre une vente.
                </p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-left text-gray-600">
                            <tr>
                                <th className="px-4 py-2 font-medium">Distribution</th>
                                <th className="px-4 py-2 font-medium">Point</th>
                                <th className="px-4 py-2 font-medium">Clôture</th>
                                <th className="px-4 py-2 font-medium">Statut</th>
                                <th className="px-4 py-2" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sales.map((s) => (
                                <tr key={s.id}>
                                    <td className="px-4 py-3 font-medium text-gray-900">
                                        {formatDate(s.distribution_date)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {s.collection_points?.name ?? '—'}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {formatDateTime(s.closes_at)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={s.status} />
                                    </td>
                                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                                        <Link
                                            href={`/admin/ventes/${s.id}`}
                                            className="text-[var(--accent)] font-medium"
                                        >
                                            Modifier
                                        </Link>
                                        {s.status === 'draft' ? (
                                            <form action={openSaleAction} className="inline">
                                                <input type="hidden" name="id" value={s.id} />
                                                <button type="submit" className="text-gray-600 hover:text-gray-900">
                                                    Ouvrir
                                                </button>
                                            </form>
                                        ) : null}
                                        {s.status === 'open' ? (
                                            <form action={closeSaleAction} className="inline">
                                                <input type="hidden" name="id" value={s.id} />
                                                <button type="submit" className="text-gray-600 hover:text-gray-900">
                                                    Clôturer
                                                </button>
                                            </form>
                                        ) : null}
                                        {s.status !== 'cancelled' && s.status !== 'distributed' ? (
                                            <form action={cancelSaleAction} className="inline">
                                                <input type="hidden" name="id" value={s.id} />
                                                <button type="submit" className="text-red-600 hover:text-red-800">
                                                    Annuler
                                                </button>
                                            </form>
                                        ) : null}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; classes: string }> = {
        draft: { label: 'Brouillon', classes: 'bg-gray-100 text-gray-600' },
        open: { label: 'Ouverte', classes: 'bg-green-50 text-[var(--accent)]' },
        closed: { label: 'Clôturée', classes: 'bg-amber-50 text-amber-700' },
        distributed: { label: 'Distribuée', classes: 'bg-blue-50 text-blue-700' },
        cancelled: { label: 'Annulée', classes: 'bg-red-50 text-red-700' },
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
