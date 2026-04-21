import Link from 'next/link';
import { redirect } from 'next/navigation';

import { loadCart } from '@/lib/cart';
import { formatCentsAsEuros, formatDate, formatDateTime } from '@/lib/format';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { clearCartAction, removeCartItemAction, updateCartItemAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function CartPage() {
    const supabase = createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login?redirect=/client/panier');

    const cart = await loadCart(supabase, user.id);

    return (
        <div className="space-y-6 pb-24">
            <header>
                <h1 className="text-2xl font-semibold text-gray-900">Mon panier</h1>
                {cart.sale && cart.collectionPoint ? (
                    <p className="mt-1 text-sm text-gray-600">
                        Distribution le {formatDate(cart.sale.distribution_date)} à{' '}
                        {cart.collectionPoint.name}. Commandes ouvertes jusqu&apos;au{' '}
                        {formatDateTime(cart.sale.closes_at)}.
                    </p>
                ) : null}
            </header>

            {cart.items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center space-y-3">
                    <p className="text-gray-600">Votre panier est vide.</p>
                    <Link href="/" className="btn-primary inline-flex">
                        Voir les ventes en cours
                    </Link>
                </div>
            ) : (
                <>
                    <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                        {cart.items.map((item) => (
                            <div
                                key={item.id}
                                className="p-4 flex items-start gap-4"
                            >
                                <div className="flex-1 min-w-0">
                                    <Link
                                        href={`/produits/${item.product.slug}`}
                                        className="font-medium text-gray-900 hover:text-[var(--accent)]"
                                    >
                                        {item.product.name}
                                    </Link>
                                    <div className="text-sm text-gray-600">{item.producer.name}</div>
                                    <div className="mt-1 text-sm text-gray-500">
                                        {formatCentsAsEuros(item.totals.lineHtClientCents / item.qty)}{' '}
                                        HT / unité
                                    </div>
                                </div>
                                <form action={updateCartItemAction} className="flex items-center gap-2">
                                    <input type="hidden" name="cart_item_id" value={item.id} />
                                    <label htmlFor={`qty-${item.id}`} className="sr-only">
                                        Quantité
                                    </label>
                                    <input
                                        id={`qty-${item.id}`}
                                        name="qty"
                                        type="number"
                                        min={1}
                                        max={99}
                                        defaultValue={item.qty}
                                        className="input-field max-w-[5rem]"
                                    />
                                    <button
                                        type="submit"
                                        className="text-sm text-[var(--accent)] hover:underline"
                                    >
                                        OK
                                    </button>
                                </form>
                                <div className="text-right min-w-[6rem]">
                                    <div className="font-semibold text-gray-900">
                                        {formatCentsAsEuros(item.totals.lineTtcClientCents)}
                                    </div>
                                    <form action={removeCartItemAction}>
                                        <input type="hidden" name="cart_item_id" value={item.id} />
                                        <button
                                            type="submit"
                                            className="text-xs text-red-600 hover:underline mt-1"
                                        >
                                            Retirer
                                        </button>
                                    </form>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Totaux */}
                    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Sous-total HT</span>
                            <span>{formatCentsAsEuros(cart.totals.totalHtCents)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">TVA</span>
                            <span>{formatCentsAsEuros(cart.totals.totalVatCents)}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-base pt-2 border-t border-gray-200">
                            <span>Total TTC</span>
                            <span className="text-[var(--accent)]">
                                {formatCentsAsEuros(cart.totals.totalTtcCents)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <form action={clearCartAction}>
                            <button
                                type="submit"
                                className="text-sm text-gray-600 hover:text-gray-900"
                            >
                                Vider le panier
                            </button>
                        </form>
                        <Link href="/client/checkout" className="btn-primary">
                            Passer la commande →
                        </Link>
                    </div>
                </>
            )}
        </div>
    );
}
