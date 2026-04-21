'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { loadCart } from '@/lib/cart';
import { getPaymentProvider } from '@/lib/payment/factory';
import { computeOrderTotals, type OrderLineSnapshot } from '@/lib/pricing';
import type { VatRate } from '@/lib/supabase/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type CheckoutResult = { error: string | null };

function appUrl(): string {
    const url = process.env.NEXT_PUBLIC_APP_URL;
    if (!url) throw new Error('NEXT_PUBLIC_APP_URL is required.');
    return url.replace(/\/$/, '');
}

/**
 * Action de checkout : transforme le panier en commande + paiement Mollie.
 *
 * Garanties :
 *  - Les snapshots figés dans `order_lines` utilisent la commission et la TVA
 *    courantes au moment de la confirmation (jamais recalculés ensuite).
 *  - L'ordre des opérations protège le panier : on ne le vide qu'une fois
 *    que Mollie a validé la création du paiement.
 *  - Pas de décrément de stock ici — c'est le webhook qui le fait après
 *    `paid` (cf. CLAUDE.md §webhook).
 */
export async function confirmCheckoutAction(): Promise<CheckoutResult> {
    const supabase = createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return { error: 'Non authentifié.' };
    }

    const cart = await loadCart(supabase, user.id);
    if (!cart.sale || cart.items.length === 0) {
        return { error: 'Votre panier est vide ou la vente est close.' };
    }

    // Sanity check : stock suffisant pour chaque ligne (best effort ; le
    // webhook refait la vérif en transaction avec SELECT FOR UPDATE).
    for (const item of cart.items) {
        if (!item.product.stock_unlimited && (item.product.stock_qty ?? 0) < item.qty) {
            return {
                error: `Stock insuffisant pour ${item.product.name} (${
                    item.product.stock_qty ?? 0
                } disponibles).`,
            };
        }
    }

    const coordinatorBps = cart.collectionPoint?.coordinator_commission_bps ?? 0;

    const snapshots: OrderLineSnapshot[] = cart.items.map((it) => ({
        qty: it.qty,
        unitPriceHtCents: it.product.price_ht_cents,
        vatRate: it.product.vat_rate as VatRate,
        platformCommissionBps: cart.platformCommissionBps,
        coordinatorCommissionBps: coordinatorBps,
    }));
    const totals = computeOrderTotals(snapshots);

    // 1) INSERT order (status='pending_payment', locked_at=now())
    const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
            client_user_id: user.id,
            sale_id: cart.sale.id,
            status: 'pending_payment',
            total_ht_cents: totals.totalHtCents,
            total_tva_cents: totals.totalVatCents,
            total_ttc_cents: totals.totalTtcCents,
            locked_at: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle<{ id: string }>();

    if (orderErr || !order) {
        return { error: orderErr?.message ?? 'Impossible de créer la commande.' };
    }

    // 2) INSERT order_lines avec les snapshots
    const linesPayload = cart.items.map((it, idx) => ({
        order_id: order.id,
        product_id: it.product.id,
        producer_id: it.producer.id,
        qty: it.qty,
        unit_price_ht_cents: snapshots[idx].unitPriceHtCents,
        vat_rate: snapshots[idx].vatRate,
        platform_commission_bps: snapshots[idx].platformCommissionBps,
        coordinator_commission_bps: snapshots[idx].coordinatorCommissionBps,
    }));
    const { error: linesErr } = await supabase.from('order_lines').insert(linesPayload);
    if (linesErr) {
        return { error: linesErr.message };
    }

    // 3) Créer le paiement chez Mollie
    const base = appUrl();
    let checkoutUrl: string;
    try {
        const provider = getPaymentProvider();
        const payment = await provider.createPayment({
            orderId: order.id,
            amountCents: totals.totalTtcCents,
            description: `Hublo commande ${order.id.slice(0, 8)}`,
            redirectUrl: `${base}/client/confirmation/${order.id}`,
            webhookUrl: `${base}/api/webhooks/mollie`,
        });
        checkoutUrl = payment.checkoutUrl;

        // 4) Persister le payment avant de rediriger
        const { error: payErr } = await supabase.from('payments').insert({
            order_id: order.id,
            provider: provider.name,
            provider_payment_id: payment.providerPaymentId,
            amount_cents: totals.totalTtcCents,
            status: 'created',
        });
        if (payErr) {
            return { error: payErr.message };
        }
    } catch (e) {
        // En cas d'échec Mollie, on passe la commande en 'payment_failed' pour
        // éviter de polluer les pending_payment en attente.
        await supabase.from('orders').update({ status: 'payment_failed' }).eq('id', order.id);
        const message = e instanceof Error ? e.message : 'Erreur paiement.';
        return { error: `Paiement indisponible : ${message}` };
    }

    // 5) Vider le panier de l'utilisateur pour cette vente
    await supabase
        .from('cart_items')
        .delete()
        .eq('client_user_id', user.id)
        .eq('sale_id', cart.sale.id);

    revalidatePath('/client/panier');
    revalidatePath('/client/commandes');

    // 6) Rediriger vers Mollie
    redirect(checkoutUrl);
}
