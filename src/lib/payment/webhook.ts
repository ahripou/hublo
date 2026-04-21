import type { SupabaseClient } from '@supabase/supabase-js';

import type { PaymentProvider } from './types';

export interface WebhookHandlerDeps {
    supabase: SupabaseClient;
    provider: PaymentProvider;
    /** Déclenche l'envoi d'email post-confirmation (fire-and-forget). */
    onOrderConfirmed?: (orderId: string) => void;
    /** Permet d'injecter une horloge en test. */
    now?: () => Date;
}

export type WebhookResult =
    | { ok: true; status: 'processed_paid'; orderId: string }
    | { ok: true; status: 'already_confirmed'; orderId: string }
    | { ok: true; status: 'payment_failed'; orderId: string }
    | { ok: true; status: 'still_pending'; orderId: string }
    | { ok: false; code: 'stock_error' | 'provider_error' | 'invalid_body' | 'missing_order_id'; message?: string };

/**
 * Cœur du webhook Mollie, sans dépendance à Next.js ni à l'ordre d'appel.
 * Extrait du route.ts pour être testable unitairement.
 */
export async function handleMollieWebhook(
    mollieId: string,
    deps: WebhookHandlerDeps,
): Promise<WebhookResult> {
    const { supabase, provider, now = () => new Date() } = deps;

    const eventKey = `${mollieId}:${now().getTime()}`;
    await supabase.from('payment_webhook_events').insert({
        provider: 'mollie',
        provider_payment_id: mollieId,
        provider_event_id: eventKey,
        payload: { id: mollieId },
        processed: false,
    });

    let details;
    try {
        details = await provider.getPayment(mollieId);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, code: 'provider_error', message };
    }

    const orderId =
        typeof details.metadata.order_id === 'string' ? details.metadata.order_id : null;
    if (!orderId) {
        return { ok: false, code: 'missing_order_id' };
    }

    await supabase
        .from('payments')
        .update({ status: details.status, payload: details as unknown as Record<string, unknown> })
        .eq('provider', 'mollie')
        .eq('provider_payment_id', mollieId);

    let result: WebhookResult;

    if (details.status === 'paid') {
        const { data, error } = await supabase.rpc('confirm_paid_order', { p_order_id: orderId });
        if (error) {
            result = { ok: false, code: 'stock_error', message: error.message };
        } else if (data === 'already_confirmed') {
            result = { ok: true, status: 'already_confirmed', orderId };
        } else {
            if (deps.onOrderConfirmed) deps.onOrderConfirmed(orderId);
            result = { ok: true, status: 'processed_paid', orderId };
        }
    } else if (
        details.status === 'failed' ||
        details.status === 'cancelled' ||
        details.status === 'expired'
    ) {
        await supabase
            .from('orders')
            .update({ status: 'payment_failed' })
            .eq('id', orderId)
            .in('status', ['pending_payment', 'draft']);
        result = { ok: true, status: 'payment_failed', orderId };
    } else {
        result = { ok: true, status: 'still_pending', orderId };
    }

    await supabase
        .from('payment_webhook_events')
        .update({ processed: true, processed_at: now().toISOString() })
        .eq('provider_event_id', eventKey);

    return result;
}
