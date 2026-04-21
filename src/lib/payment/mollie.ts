import createMollieClient, {
    type MollieClient,
    type PaymentStatus as MollieStatus,
} from '@mollie/api-client';

import { centsToDecimalString, decimalStringToCents } from './money';
import type {
    CreatePaymentInput,
    CreatePaymentResult,
    PaymentDetails,
    PaymentProvider,
    ProviderPaymentStatus,
} from './types';

/**
 * Mapping Mollie → statut interne Hublo.
 * Les statuts Mollie sont une chaîne, on fait un switch explicite pour ne
 * jamais propager un statut inconnu dans le métier.
 */
function mapStatus(s: MollieStatus | string): ProviderPaymentStatus {
    switch (s) {
        case 'open':
        case 'pending':
            return 'pending';
        case 'authorized':
            return 'pending';
        case 'paid':
            return 'paid';
        case 'failed':
            return 'failed';
        case 'canceled':
        case 'cancelled':
            return 'cancelled';
        case 'expired':
            return 'expired';
        default:
            return 'created';
    }
}

export class MollieProvider implements PaymentProvider {
    readonly name = 'mollie';
    private client: MollieClient;

    constructor(apiKey: string) {
        this.client = createMollieClient({ apiKey });
    }

    async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
        const payment = await this.client.payments.create({
            amount: { currency: 'EUR', value: centsToDecimalString(input.amountCents) },
            description: input.description,
            redirectUrl: input.redirectUrl,
            webhookUrl: input.webhookUrl,
            metadata: { order_id: input.orderId, ...(input.metadata ?? {}) },
        });

        const checkoutUrl = payment.getCheckoutUrl();
        if (!checkoutUrl) {
            throw new Error('Mollie did not return a checkout URL.');
        }

        return {
            providerPaymentId: payment.id,
            checkoutUrl,
        };
    }

    async getPayment(providerPaymentId: string): Promise<PaymentDetails> {
        const payment = await this.client.payments.get(providerPaymentId);
        return {
            providerPaymentId: payment.id,
            status: mapStatus(payment.status),
            amountCents: decimalStringToCents(payment.amount.value),
            metadata: (payment.metadata as Record<string, unknown>) ?? {},
        };
    }
}
