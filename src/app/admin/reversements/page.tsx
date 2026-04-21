import { formatCentsAsEuros, formatDate } from '@/lib/format';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface OrderLineWithProducer {
    qty: number;
    unit_price_ht_cents: number;
    coordinator_commission_bps: number;
    status: string;
    producers: { id: string; name: string } | null;
    orders: { status: string; sales: { distribution_date: string } | null } | null;
}

interface ProducerPayout {
    producerId: string;
    producerName: string;
    payoutCents: number;
    lineCount: number;
}

function getDateRange(from: string | null, to: string | null): { from: Date; to: Date } {
    const now = new Date();
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0); // fin du mois courant
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);   // début du mois courant
    return {
        from: from ? new Date(from) : defaultFrom,
        to: to ? new Date(to) : defaultTo,
    };
}

export default async function ReversementsPage({
    searchParams,
}: {
    searchParams: { from?: string; to?: string };
}) {
    const range = getDateRange(searchParams.from ?? null, searchParams.to ?? null);
    const fromIso = range.from.toISOString().slice(0, 10);
    const toIso = range.to.toISOString().slice(0, 10);

    const supabase = createSupabaseServerClient();

    const { data: lines } = await supabase
        .from('order_lines')
        .select(
            'qty, unit_price_ht_cents, coordinator_commission_bps, status, producers(id, name), orders!inner(status, sales!inner(distribution_date))',
        )
        .eq('status', 'active')
        .eq('orders.status', 'confirmed')
        .gte('orders.sales.distribution_date', fromIso)
        .lte('orders.sales.distribution_date', toIso)
        .returns<OrderLineWithProducer[]>();

    const lineList = lines ?? [];

    // Agréger par producteur
    const byProducer = new Map<string, ProducerPayout>();
    for (const line of lineList) {
        const pid = line.producers?.id ?? 'unknown';
        if (!byProducer.has(pid)) {
            byProducer.set(pid, {
                producerId: pid,
                producerName: line.producers?.name ?? '—',
                payoutCents: 0,
                lineCount: 0,
            });
        }
        const entry = byProducer.get(pid)!;
        entry.payoutCents += line.qty * line.unit_price_ht_cents;
        entry.lineCount += 1;
    }

    const payouts = Array.from(byProducer.values()).sort((a, b) =>
        a.producerName.localeCompare(b.producerName),
    );
    const totalPayout = payouts.reduce((s, p) => s + p.payoutCents, 0);

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-gray-900">Reversements producteurs</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Montants HT à reverser, calculés depuis les commandes confirmées.
                </p>
            </header>

            {/* Filtres de période */}
            <form className="flex flex-wrap items-end gap-4 bg-white rounded-lg border border-gray-200 p-4">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Du</label>
                    <input
                        type="date"
                        name="from"
                        defaultValue={fromIso}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Au</label>
                    <input
                        type="date"
                        name="to"
                        defaultValue={toIso}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                </div>
                <button
                    type="submit"
                    className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                    Filtrer
                </button>
            </form>

            <div className="text-sm text-gray-600">
                Période :{' '}
                <strong>
                    {formatDate(fromIso)} → {formatDate(toIso)}
                </strong>
                {' '}· Total à reverser :{' '}
                <strong className="text-gray-900">{formatCentsAsEuros(totalPayout)}</strong>
            </div>

            {payouts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                    <p className="text-gray-500">
                        Aucune commande confirmée sur cette période.
                    </p>
                </div>
            ) : (
                <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-left px-4 py-3 font-semibold text-gray-700">
                                    Producteur
                                </th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-700">
                                    Lignes
                                </th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-700">
                                    Montant HT à reverser
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {payouts.map((p) => (
                                <tr key={p.producerId} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">
                                        {p.producerName}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-600">
                                        {p.lineCount}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                        {formatCentsAsEuros(p.payoutCents)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-gray-300 bg-gray-50">
                                <td className="px-4 py-3 font-bold text-gray-900" colSpan={2}>
                                    Total
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-gray-900 text-base">
                                    {formatCentsAsEuros(totalPayout)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            <p className="text-xs text-gray-500">
                Les montants sont calculés depuis les snapshots figés dans{' '}
                <code>order_lines</code> (prix HT producteur × quantité). Filtre sur la date
                de distribution de la vente.
            </p>
        </div>
    );
}
