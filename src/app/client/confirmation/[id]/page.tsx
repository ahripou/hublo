import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { formatCentsAsEuros, formatDate } from '@/lib/format';
import type { CollectionPointRow, SaleRow } from '@/lib/supabase/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface OrderWithSale {
    id: string;
    status: string;
    total_ttc_cents: number;
    client_user_id: string;
    created_at: string;
    sales: (SaleRow & { collection_points: CollectionPointRow | null }) | null;
}

export default async function ConfirmationPage({ params }: { params: { id: string } }) {
    const supabase = createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/auth/login?redirect=/client/confirmation/${params.id}`);

    const { data: order } = await supabase
        .from('orders')
        .select('id, status, total_ttc_cents, client_user_id, created_at, sales(*, collection_points(*))')
        .eq('id', params.id)
        .maybeSingle<OrderWithSale>();

    if (!order || order.client_user_id !== user.id) notFound();

    const { status } = order;
    const sale = order.sales;

    return (
        <div className="max-w-xl mx-auto space-y-6 text-center">
            {status === 'confirmed' ? (
                <>
                    <h1 className="text-2xl font-semibold text-[var(--accent)]">
                        Commande confirmée 🎉
                    </h1>
                    <p className="text-gray-700">
                        Merci ! Votre paiement a bien été reçu. Un email de confirmation
                        vous a été envoyé.
                    </p>
                </>
            ) : status === 'pending_payment' ? (
                <>
                    <h1 className="text-2xl font-semibold text-gray-900">
                        Paiement en cours de vérification
                    </h1>
                    <p className="text-gray-700">
                        Nous attendons la confirmation de Mollie. Ça prend normalement
                        quelques secondes. Actualisez la page dans un instant.
                    </p>
                </>
            ) : status === 'payment_failed' ? (
                <>
                    <h1 className="text-2xl font-semibold text-red-600">Paiement échoué</h1>
                    <p className="text-gray-700">
                        Le paiement n&apos;a pas abouti. Vous pouvez réessayer depuis votre
                        panier.
                    </p>
                </>
            ) : (
                <>
                    <h1 className="text-2xl font-semibold text-gray-900">Commande {order.id.slice(0, 8)}</h1>
                    <p className="text-gray-700">Statut : {status}</p>
                </>
            )}

            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-left space-y-1">
                <div className="flex justify-between">
                    <span className="text-gray-600">Commande</span>
                    <span className="font-mono">{order.id.slice(0, 8)}</span>
                </div>
                {sale && sale.collection_points ? (
                    <>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Distribution</span>
                            <span>{formatDate(sale.distribution_date)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Point de collecte</span>
                            <span>{sale.collection_points.name}</span>
                        </div>
                    </>
                ) : null}
                <div className="flex justify-between font-semibold text-base pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span>{formatCentsAsEuros(order.total_ttc_cents)}</span>
                </div>
            </div>

            <Link href={`/client/commandes/${order.id}`} className="btn-primary inline-flex">
                Voir le détail
            </Link>
        </div>
    );
}
