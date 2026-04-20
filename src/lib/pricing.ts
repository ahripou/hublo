/**
 * Hublo.be — fonction centrale de calcul prix / commissions / TVA / reversements.
 *
 * Règles :
 *  - Montants en centimes entiers (int). Jamais de decimal.
 *  - Commissions en basis points : 3500 = 35%.
 *  - Arrondi half-up à l'entier le plus proche, appliqué uniquement à
 *    l'étape finale de chaque ligne.
 *  - Snapshots : les valeurs figées dans `order_lines` servent de source
 *    pour les reversements, jamais les tables de catalogue.
 */

export const BPS_DENOMINATOR = 10_000;

export type VatRate = 0 | 6 | 21;

function assertNonNegativeInt(value: number, label: string): void {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${label} must be a non-negative integer (got ${value})`);
    }
}

function assertPositiveInt(value: number, label: string): void {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${label} must be a positive integer (got ${value})`);
    }
}

/** Arrondi half-up à l'entier. 0.5 → 1, -0.5 → 0 (half-up, pas banker's rounding). */
export function roundHalfUp(value: number): number {
    return Math.floor(value + 0.5);
}

export interface ComputeUnitPriceInput {
    priceHtProducerCents: number;
    platformCommissionBps: number;
    coordinatorCommissionBps: number;
    vatRate: VatRate;
}

export interface ComputedUnitPrice {
    priceHtClientCents: number;
    priceTtcClientCents: number;
    vatAmountCents: number;
}

/**
 * Calcule le prix unitaire HT et TTC payé par le client à partir du prix HT
 * producteur. Commissions appliquées en cascade.
 */
export function computeUnitPrice(input: ComputeUnitPriceInput): ComputedUnitPrice {
    assertNonNegativeInt(input.priceHtProducerCents, 'priceHtProducerCents');
    assertNonNegativeInt(input.platformCommissionBps, 'platformCommissionBps');
    assertNonNegativeInt(input.coordinatorCommissionBps, 'coordinatorCommissionBps');
    if (![0, 6, 21].includes(input.vatRate)) {
        throw new Error(`vatRate must be 0, 6 or 21 (got ${input.vatRate})`);
    }

    const platformFactor = 1 + input.platformCommissionBps / BPS_DENOMINATOR;
    const coordinatorFactor = 1 + input.coordinatorCommissionBps / BPS_DENOMINATOR;
    const priceHtClient = roundHalfUp(input.priceHtProducerCents * platformFactor * coordinatorFactor);

    const vatFactor = 1 + input.vatRate / 100;
    const priceTtcClient = roundHalfUp(priceHtClient * vatFactor);
    const vatAmount = priceTtcClient - priceHtClient;

    return {
        priceHtClientCents: priceHtClient,
        priceTtcClientCents: priceTtcClient,
        vatAmountCents: vatAmount,
    };
}

export interface OrderLineSnapshot {
    qty: number;
    unitPriceHtCents: number;
    vatRate: VatRate;
    platformCommissionBps: number;
    coordinatorCommissionBps: number;
}

export interface LineTotals {
    lineHtClientCents: number;
    lineVatCents: number;
    lineTtcClientCents: number;
    producerPayoutCents: number;
    coordinatorCommissionCents: number;
    platformMarginCents: number;
}

/**
 * À partir d'une ligne de commande figée (snapshots), calcule tous les
 * totaux nécessaires à l'affichage, au bon de préparation et aux
 * reversements. Utilisé aussi bien au checkout qu'en lecture admin.
 */
export function computeLineTotals(line: OrderLineSnapshot): LineTotals {
    assertPositiveInt(line.qty, 'qty');
    const unit = computeUnitPrice({
        priceHtProducerCents: line.unitPriceHtCents,
        platformCommissionBps: line.platformCommissionBps,
        coordinatorCommissionBps: line.coordinatorCommissionBps,
        vatRate: line.vatRate,
    });

    const lineHtClient = unit.priceHtClientCents * line.qty;
    const lineVat = unit.vatAmountCents * line.qty;
    const lineTtcClient = unit.priceTtcClientCents * line.qty;
    const producerPayout = line.unitPriceHtCents * line.qty;
    const coordinatorCommission = roundHalfUp(
        (line.unitPriceHtCents * line.coordinatorCommissionBps * line.qty) / BPS_DENOMINATOR,
    );
    const platformMargin = lineTtcClient - lineVat - producerPayout - coordinatorCommission;

    return {
        lineHtClientCents: lineHtClient,
        lineVatCents: lineVat,
        lineTtcClientCents: lineTtcClient,
        producerPayoutCents: producerPayout,
        coordinatorCommissionCents: coordinatorCommission,
        platformMarginCents: platformMargin,
    };
}

export interface OrderTotals {
    totalHtCents: number;
    totalVatCents: number;
    totalTtcCents: number;
    totalProducerPayoutCents: number;
    totalCoordinatorCommissionCents: number;
    totalPlatformMarginCents: number;
}

/** Agrège les totaux sur une commande complète (toutes les lignes actives). */
export function computeOrderTotals(lines: readonly OrderLineSnapshot[]): OrderTotals {
    const totals: OrderTotals = {
        totalHtCents: 0,
        totalVatCents: 0,
        totalTtcCents: 0,
        totalProducerPayoutCents: 0,
        totalCoordinatorCommissionCents: 0,
        totalPlatformMarginCents: 0,
    };
    for (const line of lines) {
        const t = computeLineTotals(line);
        totals.totalHtCents += t.lineHtClientCents;
        totals.totalVatCents += t.lineVatCents;
        totals.totalTtcCents += t.lineTtcClientCents;
        totals.totalProducerPayoutCents += t.producerPayoutCents;
        totals.totalCoordinatorCommissionCents += t.coordinatorCommissionCents;
        totals.totalPlatformMarginCents += t.platformMarginCents;
    }
    return totals;
}

/** Formate un montant en centimes pour affichage. Usage UI uniquement. */
export function formatEuros(cents: number): string {
    const sign = cents < 0 ? '-' : '';
    const absCents = Math.abs(cents);
    const euros = Math.floor(absCents / 100);
    const remainder = absCents % 100;
    return `${sign}${euros},${remainder.toString().padStart(2, '0')} €`;
}
