import Link from 'next/link';
import { redirect } from 'next/navigation';

import { loadCart } from '@/lib/cart';
import { formatCentsAsEuros, formatDate, formatDateTime } from '@/lib/format';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ConfirmButton } from './ConfirmButton';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
    const supabase = createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login?redirect=/client/checkout');

    const cart = await loadCart(supabase, user.id);

    if (cart.items.length === 0 || !cart.sale) {
        return (
            <div className="space-y-4">
                <h1 className="text-2xl font-semibold text-gray-900">Finaliser la commande</h1>
                <p className="text-gray-600">
                    Votre panier est vide ou la vente est fermée.
                </p>
                <Link href="/" className="btn-primary inline-flex">
                    Retour à l&apos;accueil
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-xl">
            <header>
                <h1 className="text-2xl font-semibold text-gray-900">Finaliser la commande</h1>
                {cart.collectionPoint ? (
                    <p className="mt-1 text-sm text-gray-600">
                        Distribution le {formatDate(cart.sale.distribution_date)} à{' '}
                        {cart.collectionPoint.name}.
                    </p>
                ) : null}
                <p className="mt-1 text-xs text-gray-500">
                    Ventes fermées le {formatDateTime(cart.sale.closes_at)}.
                </p>
            </header>

            <section className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                {cart.items.map((item) => (
                    <div key={item.id} className="p-4 flex justify-between gap-4 text-sm">
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900">{item.product.name}</div>
                            <div className="text-gray-600">
                                {item.producer.name} · Qté {item.qty}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-semibold">
                                {formatCentsAsEuros(item.totals.lineTtcClientCents)}
                            </div>
                        </div>
                    </div>
                ))}
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-1 text-sm">
                <div className="flex justify-between">
                    <span className="text-gray-600">Sous-total HT</span>
                    <span>{formatCentsAsEuros(cart.totals.totalHtCents)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">TVA</span>
                    <span>{formatCentsAsEuros(cart.totals.totalVatCents)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base pt-2 border-t border-gray-200">
                    <span>Total à payer</span>
                    <span className="text-[var(--accent)]">
                        {formatCentsAsEuros(cart.totals.totalTtcCents)}
                    </span>
                </div>
            </section>

            <ConfirmButton />

            <Link href="/client/panier" className="block text-sm text-gray-600 hover:text-gray-900 text-center">
                ← Retour au panier
            </Link>
        </div>
    );
}
