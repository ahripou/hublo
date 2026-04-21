/**
 * Interface d'abstraction pour les providers de paiement.
 *
 * Règle d'architecture : le code métier (checkout, webhook, admin) ne doit
 * JAMAIS appeler directement `@mollie/api-client` ni un autre SDK. Tout
 * passe par cette interface pour faciliter le futur switch Mollie → Stripe
 * ou l'ajout d'un provider secondaire.
 */

export type ProviderPaymentStatus =
    | 'created'
    | 'pending'
    | 'paid'
    | 'failed'
    | 'cancelled'
    | 'refunded'
    | 'expired';

export interface CreatePaymentInput {
    orderId: string;
    amountCents: number;
    description: string;
    redirectUrl: string;
    webhookUrl: string;
    metadata?: Record<string, string>;
}

export interface CreatePaymentResult {
    providerPaymentId: string;
    checkoutUrl: string;
}

export interface PaymentDetails {
    providerPaymentId: string;
    status: ProviderPaymentStatus;
    amountCents: number;
    metadata: Record<string, unknown>;
}

export interface PaymentProvider {
    readonly name: string;
    createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
    getPayment(providerPaymentId: string): Promise<PaymentDetails>;
}
