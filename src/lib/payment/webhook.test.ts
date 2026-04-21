import { describe, expect, it, vi } from 'vitest';

import type { PaymentProvider, ProviderPaymentStatus } from './types';
import { handleMollieWebhook } from './webhook';

/**
 * Fake Supabase client minimal qui supporte les appels utilisés par le
 * webhook (`from(table).insert/update/eq/in`, `rpc(...)`). Chaque étape du
 * query builder renvoie le même objet « thenable » ; les appels sont
 * enregistrés pour assertion.
 */
function makeFakeSupabase(opts: {
    rpcImpl?: (
        name: string,
        args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
} = {}) {
    const calls: { op: string; table?: string; args?: unknown }[] = [];

    function chain(table: string): any {
        const obj: any = {};
        const chainMethods = ['insert', 'update', 'select', 'eq', 'in', 'neq', 'order', 'limit'];
        for (const m of chainMethods) {
            obj[m] = (...args: unknown[]) => {
                calls.push({ op: m, table, args });
                return obj;
            };
        }
        // Permet `await chain` en bout de ligne
        obj.then = (resolve: (v: { data: null; error: null }) => void) =>
            resolve({ data: null, error: null });
        obj.maybeSingle = () => Promise.resolve({ data: null, error: null });
        return obj;
    }

    const client = {
        from: (table: string) => {
            calls.push({ op: 'from', table });
            return chain(table);
        },
        rpc: async (name: string, args: Record<string, unknown>) => {
            calls.push({ op: 'rpc', args: { name, ...args } });
            if (opts.rpcImpl) return opts.rpcImpl(name, args);
            return { data: 'ok', error: null };
        },
    };

    return { calls, client };
}

function makeProvider(status: ProviderPaymentStatus, orderId: string | null = 'order-1'): PaymentProvider {
    return {
        name: 'mollie',
        createPayment: async () => {
            throw new Error('unused in webhook tests');
        },
        getPayment: async () => ({
            providerPaymentId: 'tr_xxx',
            status,
            amountCents: 1000,
            metadata: orderId ? { order_id: orderId } : {},
        }),
    };
}

describe('handleMollieWebhook', () => {
    it('paid → calls confirm_paid_order RPC and fires onOrderConfirmed', async () => {
        const onConfirmed = vi.fn();
        const { client, calls } = makeFakeSupabase();
        const provider = makeProvider('paid');

        const res = await handleMollieWebhook('tr_xxx', {
            supabase: client as never,
            provider,
            onOrderConfirmed: onConfirmed,
        });

        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.status).toBe('processed_paid');
            expect(res.orderId).toBe('order-1');
        }
        expect(onConfirmed).toHaveBeenCalledWith('order-1');

        const rpcCall = calls.find((c) => c.op === 'rpc') as { args: { name: string; p_order_id: string } };
        expect(rpcCall.args.name).toBe('confirm_paid_order');
        expect(rpcCall.args.p_order_id).toBe('order-1');
    });

    it('paid duplicate → RPC returns already_confirmed → email NOT sent', async () => {
        const onConfirmed = vi.fn();
        const { client } = makeFakeSupabase({
            rpcImpl: async () => ({ data: 'already_confirmed', error: null }),
        });
        const provider = makeProvider('paid');

        const res = await handleMollieWebhook('tr_xxx', {
            supabase: client as never,
            provider,
            onOrderConfirmed: onConfirmed,
        });

        expect(res.ok).toBe(true);
        if (res.ok) expect(res.status).toBe('already_confirmed');
        expect(onConfirmed).not.toHaveBeenCalled();
    });

    it('failed → marks order payment_failed and skips RPC', async () => {
        const rpcSpy = vi.fn().mockResolvedValue({ data: 'ok', error: null });
        const { client } = makeFakeSupabase({ rpcImpl: rpcSpy });
        const provider = makeProvider('failed');

        const res = await handleMollieWebhook('tr_xxx', {
            supabase: client as never,
            provider,
        });

        expect(res.ok).toBe(true);
        if (res.ok) expect(res.status).toBe('payment_failed');
        expect(rpcSpy).not.toHaveBeenCalled();
    });

    it('stock insufficient → RPC error bubbles as stock_error', async () => {
        const { client } = makeFakeSupabase({
            rpcImpl: async () => ({
                data: null,
                error: { message: 'insufficient_stock:xyz:Pain' },
            }),
        });
        const provider = makeProvider('paid');

        const res = await handleMollieWebhook('tr_xxx', {
            supabase: client as never,
            provider,
        });

        expect(res.ok).toBe(false);
        if (!res.ok) {
            expect(res.code).toBe('stock_error');
            expect(res.message).toContain('insufficient_stock');
        }
    });

    it('missing order_id metadata → returns missing_order_id error', async () => {
        const { client } = makeFakeSupabase();
        const provider = makeProvider('paid', null);

        const res = await handleMollieWebhook('tr_xxx', {
            supabase: client as never,
            provider,
        });

        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.code).toBe('missing_order_id');
    });

    it('provider API down → returns provider_error', async () => {
        const { client } = makeFakeSupabase();
        const provider: PaymentProvider = {
            name: 'mollie',
            createPayment: async () => {
                throw new Error('unused');
            },
            getPayment: async () => {
                throw new Error('network down');
            },
        };

        const res = await handleMollieWebhook('tr_xxx', {
            supabase: client as never,
            provider,
        });

        expect(res.ok).toBe(false);
        if (!res.ok) {
            expect(res.code).toBe('provider_error');
            expect(res.message).toContain('network');
        }
    });

    it('pending/open status → still_pending, no order mutation', async () => {
        const rpcSpy = vi.fn();
        const { client } = makeFakeSupabase({ rpcImpl: rpcSpy });
        const provider = makeProvider('pending');

        const res = await handleMollieWebhook('tr_xxx', {
            supabase: client as never,
            provider,
        });

        expect(res.ok).toBe(true);
        if (res.ok) expect(res.status).toBe('still_pending');
        expect(rpcSpy).not.toHaveBeenCalled();
    });
});
