import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatDate } from '@/lib/format';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface OrderLine {
    id: string;
    qty: number;
    status: string;
    products: { id: string; name: string } | null;
    producers: { id: string; name: string } | null;
    orders: {
        id: string;
        status: string;
        users: { email: string; first_name: string | null; last_name: string | null } | null;
    } | null;
}

interface SaleBasic {
    id: string;
    distribution_date: string;
    distribution_start_at: string | null;
    distribution_end_at: string | null;
    status: string;
    collection_points: { name: string; address: string } | null;
}

function clientName(u: { email: string; first_name: string | null; last_name: string | null } | null): string {
    if (!u) return '—';
    const full = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();
    return full || u.email;
}

export default async function BonDePreparationPage({ params }: { params: { id: string } }) {
    const supabase = createSupabaseServerClient();

    const [{ data: sale }, { data: lines }] = await Promise.all([
        supabase
            .from('sales')
            .select('id, distribution_date, distribution_start_at, distribution_end_at, status, collection_points(name, address)')
            .eq('id', params.id)
            .maybeSingle<SaleBasic>(),
        supabase
            .from('order_lines')
            .select(
                'id, qty, status, products(id, name), producers(id, name), orders!inner(id, status, users(email, first_name, last_name))',
            )
            .eq('orders.sale_id', params.id)
            .eq('orders.status', 'confirmed')
            .eq('status', 'active')
            .returns<OrderLine[]>(),
    ]);

    if (!sale) notFound();

    const lineList = lines ?? [];

    // Vue par produit : {productId → { name, producerName, clients: [{name, qty}], totalQty }}
    const byProduct = new Map<
        string,
        { name: string; producerName: string; totalQty: number; clients: { name: string; qty: number }[] }
    >();
    for (const line of lineList) {
        const pid = line.products?.id ?? 'unknown';
        if (!byProduct.has(pid)) {
            byProduct.set(pid, {
                name: line.products?.name ?? '—',
                producerName: line.producers?.name ?? '—',
                totalQty: 0,
                clients: [],
            });
        }
        const entry = byProduct.get(pid)!;
        entry.totalQty += line.qty;
        entry.clients.push({ name: clientName(line.orders?.users ?? null), qty: line.qty });
    }

    // Vue par client : {clientKey → { name, lines: [{productName, producerName, qty}] }}
    const byClient = new Map<
        string,
        { name: string; lines: { productName: string; producerName: string; qty: number }[] }
    >();
    for (const line of lineList) {
        const u = line.orders?.users ?? null;
        const key = line.orders?.id ?? 'unknown';
        if (!byClient.has(key)) {
            byClient.set(key, { name: clientName(u), lines: [] });
        }
        byClient.get(key)!.lines.push({
            productName: line.products?.name ?? '—',
            producerName: line.producers?.name ?? '—',
            qty: line.qty,
        });
    }

    const productEntries = Array.from(byProduct.entries()).sort((a, b) =>
        a[1].producerName.localeCompare(b[1].producerName) ||
        a[1].name.localeCompare(b[1].name),
    );
    const clientEntries = Array.from(byClient.entries()).sort((a, b) =>
        a[1].name.localeCompare(b[1].name),
    );

    const cp = sale.collection_points as unknown as { name: string; address: string } | null;

    return (
        <div className="min-h-screen bg-white">
            {/* Barre d'actions — masquée à l'impression */}
            <div className="print:hidden bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-4">
                <Link
                    href={`/admin/ventes/${sale.id}/commandes`}
                    className="text-sm text-gray-600 hover:text-gray-900"
                >
                    ← Retour aux commandes
                </Link>
                <button
                    onClick={() => window.print()}
                    className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                    Imprimer / Enregistrer PDF
                </button>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">
                {/* En-tête */}
                <header className="border-b-2 border-gray-900 pb-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Bon de préparation</h1>
                            <p className="text-gray-700">
                                Distribution du{' '}
                                <strong>{formatDate(sale.distribution_date)}</strong>
                                {sale.distribution_start_at && sale.distribution_end_at && (
                                    <>
                                        {' '}
                                        — {new Date(sale.distribution_start_at).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
                                        {' '}à{' '}
                                        {new Date(sale.distribution_end_at).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
                                    </>
                                )}
                            </p>
                            {cp && (
                                <p className="text-gray-600 text-sm">{cp.name} · {cp.address}</p>
                            )}
                        </div>
                        <div className="text-right text-sm text-gray-500 shrink-0">
                            <div>{clientEntries.length} client(s)</div>
                            <div>
                                {lineList.reduce((s, l) => s + l.qty, 0)} article(s)
                            </div>
                            <div className="mt-1 text-xs">
                                Imprimé le{' '}
                                {new Date().toLocaleDateString('fr-BE', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                })}
                            </div>
                        </div>
                    </div>
                </header>

                {lineList.length === 0 ? (
                    <p className="text-gray-500 text-center py-12">
                        Aucune commande confirmée pour cette vente.
                    </p>
                ) : (
                    <>
                        {/* ═══ VUE PAR PRODUIT ═══ */}
                        <section>
                            <h2 className="text-lg font-bold text-gray-900 mb-4 uppercase tracking-wide border-b border-gray-300 pb-2">
                                Vue par produit
                            </h2>
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="text-left px-3 py-2 font-semibold border border-gray-300">Produit</th>
                                        <th className="text-left px-3 py-2 font-semibold border border-gray-300">Producteur</th>
                                        <th className="text-center px-3 py-2 font-semibold border border-gray-300 w-20">Total</th>
                                        <th className="text-left px-3 py-2 font-semibold border border-gray-300">Détail par client</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productEntries.map(([, entry]) => (
                                        <tr key={entry.name + entry.producerName} className="even:bg-gray-50">
                                            <td className="px-3 py-2 border border-gray-200 font-medium align-top">
                                                {entry.name}
                                            </td>
                                            <td className="px-3 py-2 border border-gray-200 text-gray-600 align-top">
                                                {entry.producerName}
                                            </td>
                                            <td className="px-3 py-2 border border-gray-200 text-center font-bold text-lg align-top">
                                                {entry.totalQty}
                                            </td>
                                            <td className="px-3 py-2 border border-gray-200 align-top">
                                                <ul className="space-y-0.5">
                                                    {entry.clients.map((c, i) => (
                                                        <li key={i} className="flex justify-between gap-4">
                                                            <span className="text-gray-700">{c.name}</span>
                                                            <span className="font-medium shrink-0">× {c.qty}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>

                        {/* ═══ VUE PAR CLIENT ═══ */}
                        <section className="break-before-page">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 uppercase tracking-wide border-b border-gray-300 pb-2">
                                Vue par client
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {clientEntries.map(([, entry]) => (
                                    <div
                                        key={entry.name}
                                        className="border border-gray-300 rounded-md overflow-hidden break-inside-avoid"
                                    >
                                        <div className="bg-gray-100 px-3 py-2 font-semibold text-gray-900 border-b border-gray-300">
                                            {entry.name}
                                        </div>
                                        <ul className="divide-y divide-gray-100 px-3">
                                            {entry.lines.map((l, i) => (
                                                <li key={i} className="py-1.5 flex items-center justify-between gap-4 text-sm">
                                                    <div className="min-w-0">
                                                        <span className="text-gray-800">{l.productName}</span>
                                                        <span className="text-gray-400 ml-1 text-xs">
                                                            ({l.producerName})
                                                        </span>
                                                    </div>
                                                    <span className="font-bold text-gray-900 shrink-0">× {l.qty}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
