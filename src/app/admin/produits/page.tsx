import Link from 'next/link';

import { formatCentsAsEuros } from '@/lib/format';
import type { ProducerRow, ProductRow } from '@/lib/supabase/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { archiveProductAction, restoreProductAction } from './actions';

export const dynamic = 'force-dynamic';

type ProductWithProducer = ProductRow & { producers: Pick<ProducerRow, 'name'> | null };

export default async function ProduitsPage() {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
        .from('products')
        .select('*, producers(name)')
        .order('status', { ascending: true })
        .order('name', { ascending: true })
        .returns<ProductWithProducer[]>();

    const products = data ?? [];

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Produits</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        {products.length} produit{products.length > 1 ? 's' : ''}.
                    </p>
                </div>
                <Link href="/admin/produits/nouveau" className="btn-primary">
                    Nouveau
                </Link>
            </header>

            {error ? (
                <p className="text-sm text-red-600">{error.message}</p>
            ) : products.length === 0 ? (
                <p className="text-sm text-gray-600">
                    Aucun produit. Créer d&apos;abord un producteur, puis un produit.
                </p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-left text-gray-600">
                            <tr>
                                <th className="px-4 py-2 font-medium">Nom</th>
                                <th className="px-4 py-2 font-medium">Producteur</th>
                                <th className="px-4 py-2 font-medium">Prix HT</th>
                                <th className="px-4 py-2 font-medium">TVA</th>
                                <th className="px-4 py-2 font-medium">Stock</th>
                                <th className="px-4 py-2 font-medium">Statut</th>
                                <th className="px-4 py-2" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {products.map((p) => (
                                <tr key={p.id}>
                                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                                    <td className="px-4 py-3 text-gray-600">{p.producers?.name ?? '—'}</td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {formatCentsAsEuros(p.price_ht_cents)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{p.vat_rate}%</td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {p.stock_unlimited ? 'Illimité' : (p.stock_qty ?? 0)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={p.status} />
                                    </td>
                                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                                        <Link
                                            href={`/admin/produits/${p.id}`}
                                            className="text-[var(--accent)] font-medium"
                                        >
                                            Modifier
                                        </Link>
                                        {p.status !== 'archived' ? (
                                            <form action={archiveProductAction} className="inline">
                                                <input type="hidden" name="id" value={p.id} />
                                                <button
                                                    type="submit"
                                                    className="text-gray-600 hover:text-gray-900"
                                                >
                                                    Archiver
                                                </button>
                                            </form>
                                        ) : (
                                            <form action={restoreProductAction} className="inline">
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
    const label = status === 'active' ? 'Actif' : status === 'suspended' ? 'Suspendu' : 'Archivé';
    const classes =
        status === 'active'
            ? 'bg-green-50 text-[var(--accent)]'
            : status === 'suspended'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-gray-100 text-gray-600';
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
            {label}
        </span>
    );
}
