import Link from 'next/link';

import type { ProducerRow } from '@/lib/supabase/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { archiveProducerAction, restoreProducerAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function ProducteursPage() {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
        .from('producers')
        .select('*')
        .order('status', { ascending: true })
        .order('name', { ascending: true })
        .returns<ProducerRow[]>();

    const producers = data ?? [];

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Producteurs</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        {producers.length} producteur{producers.length > 1 ? 's' : ''} enregistré
                        {producers.length > 1 ? 's' : ''}.
                    </p>
                </div>
                <Link href="/admin/producteurs/nouveau" className="btn-primary">
                    Nouveau
                </Link>
            </header>

            {error ? (
                <p className="text-sm text-red-600">{error.message}</p>
            ) : producers.length === 0 ? (
                <p className="text-sm text-gray-600">Aucun producteur pour le moment.</p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-left text-gray-600">
                            <tr>
                                <th className="px-4 py-2 font-medium">Nom</th>
                                <th className="px-4 py-2 font-medium">Slug</th>
                                <th className="px-4 py-2 font-medium">TVA</th>
                                <th className="px-4 py-2 font-medium">Statut</th>
                                <th className="px-4 py-2" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {producers.map((p) => (
                                <tr key={p.id}>
                                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                                    <td className="px-4 py-3 text-gray-600">{p.slug}</td>
                                    <td className="px-4 py-3 text-gray-600">{p.vat_number ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={p.status} />
                                    </td>
                                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                                        <Link
                                            href={`/admin/producteurs/${p.id}`}
                                            className="text-[var(--accent)] font-medium"
                                        >
                                            Modifier
                                        </Link>
                                        {p.status === 'active' ? (
                                            <form action={archiveProducerAction} className="inline">
                                                <input type="hidden" name="id" value={p.id} />
                                                <button
                                                    type="submit"
                                                    className="text-gray-600 hover:text-gray-900"
                                                >
                                                    Archiver
                                                </button>
                                            </form>
                                        ) : (
                                            <form action={restoreProducerAction} className="inline">
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
    const active = status === 'active';
    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                active ? 'bg-green-50 text-[var(--accent)]' : 'bg-gray-100 text-gray-600'
            }`}
        >
            {active ? 'Actif' : 'Archivé'}
        </span>
    );
}
