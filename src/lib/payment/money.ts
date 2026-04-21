/**
 * Helpers de conversion cents ↔ chaîne décimale « 10.00 » pour les APIs
 * paiement (Mollie, Stripe, …). Évite les float toFixed() sur les montants.
 */

export function centsToDecimalString(cents: number): string {
    if (!Number.isInteger(cents) || cents < 0) {
        throw new Error(`centsToDecimalString expects a non-negative integer (got ${cents})`);
    }
    const euros = Math.floor(cents / 100);
    const remainder = cents % 100;
    return `${euros}.${remainder.toString().padStart(2, '0')}`;
}

export function decimalStringToCents(value: string): number {
    if (!/^\d+(\.\d+)?$/.test(value)) {
        throw new Error(`decimalStringToCents expects a decimal string (got "${value}")`);
    }
    const [euros, decimals = '00'] = value.split('.');
    const normalised = decimals.padEnd(2, '0').slice(0, 2);
    return parseInt(euros, 10) * 100 + parseInt(normalised, 10);
}
