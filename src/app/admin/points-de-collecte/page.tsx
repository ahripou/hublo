import Link from 'next/link';

import type { CollectionPointRow } from '@/lib/supabase/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { archiveCollectionPointAction, restoreCollectionPointAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function CollectionPointsPage() {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
        .from('collection_points')
        .select('*')
        .order('status', { ascending: true })
        .order('name', { ascending: true })
        .returns<CollectionPointRow[]>();

    const points = data ?? [];

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Points de collecte</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        {points.length} point{points.length > 1 ? 's' : ''} enregistré
                        {points.length > 1 ? 's' : ''}.
                    </p>
                </div>
                <Link href="/admin/points-de-collecte/nouveau" className="btn-primary">
                    Nouveau
                </Link>
            </header>

            {error ? (
                <p className="text-sm text-red-600">{error.message}</p>
            ) : points.length === 0 ? (
                <p className="text-sm text-gray-600">Aucun point de collecte pour le moment.</p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-left text-gray-600">
                            <tr>
                                <th className="px-4 py-2 font-medium">Nom</th>
                                <th className="px-4 py-2 font-medium">Adresse</th>
                                <th className="px-4 py-2 font-medium">Commission coord.</th>
                                <th className="px-4 py-2 font-medium">Statut</th>
                                <th className="px-4 py-2" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {points.map((p) => (
                                <tr key={p.id}>
                                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{p.address}</td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {(p.coordinator_commission_bps / 100).toFixed(2)}%
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={p.status} />
                                    </td>
                                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                                        <Link
                                            href={`/admin/points-de-collecte/${p.id}`}
                                            className="text-[var(--accent)] font-medium"
                                        >
                                            Modifier
                                        </Link>
                                        {p.status !== 'archived' ? (
                                            <form action={archiveCollectionPointAction} className="inline">
                                                <input type="hidden" name="id" value={p.id} />
                                                <button
                                                    type="submit"
                                                    className="text-gray-600 hover:text-gray-900"
                                                >
                                                    Archiver
                                                </button>
                                            </form>
                                        ) : (
                                            <form action={restoreCollectionPointAction} className="inline">
                                                <input type="hidden" name="id" value={p.id} />
                                                <button
                                                    type="submit"
                                                    className="text-gray-600 hover:text-gray-900"
                                                >
                                                    Restaurer
                                                </button>
                                            </form>
                                        )}
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
    const label = status === 'active' ? 'Actif' : status === 'inactive' ? 'Inactif' : 'Archivé';
    const classes =
        status === 'active'
            ? 'bg-green-50 text-[var(--accent)]'
            : status === 'inactive'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-gray-100 text-gray-600';
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
            {label}
        </span>
    );
}
