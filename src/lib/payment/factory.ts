import { MollieProvider } from './mollie';
import type { PaymentProvider } from './types';

/**
 * Renvoie le provider configuré via `PAYMENT_PROVIDER`. Au MVP, un seul
 * provider actif (Mollie standard). L'abstraction existe pour pouvoir
 * ajouter Stripe ou Adyen sans toucher au code métier.
 */
let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
    if (cached) return cached;
    const name = process.env.PAYMENT_PROVIDER ?? 'mollie';
    switch (name) {
        case 'mollie': {
            const apiKey = process.env.MOLLIE_API_KEY;
            if (!apiKey) throw new Error('MOLLIE_API_KEY is required.');
            cached = new MollieProvider(apiKey);
            return cached;
        }
        default:
            throw new Error(`Unknown PAYMENT_PROVIDER="${name}"`);
    }
}

/** Pour les tests : permet d'injecter un provider mock. */
export function __setPaymentProviderForTests(provider: PaymentProvider | null): void {
    cached = provider;
}
