import { describe, expect, it } from 'vitest';

import {
    computeLineTotals,
    computeOrderTotals,
    computeUnitPrice,
    formatEuros,
    roundHalfUp,
} from './pricing';

describe('roundHalfUp', () => {
    it('rounds 0.5 up to 1', () => {
        expect(roundHalfUp(0.5)).toBe(1);
    });

    it('rounds 1.4 down to 1', () => {
        expect(roundHalfUp(1.4)).toBe(1);
    });

    it('rounds 1.5 up to 2', () => {
        expect(roundHalfUp(1.5)).toBe(2);
    });

    it('keeps integers unchanged', () => {
        expect(roundHalfUp(42)).toBe(42);
    });
});

describe('computeUnitPrice — reference example from CLAUDE.md', () => {
    it('74 cts HT × 1.35 × 1.06 = 1059 cts TTC (35% platform, 0% coord, 6% VAT)', () => {
        const result = computeUnitPrice({
            priceHtProducerCents: 740,
            platformCommissionBps: 3500,
            coordinatorCommissionBps: 0,
            vatRate: 6,
        });
        expect(result.priceHtClientCents).toBe(999);
        expect(result.priceTtcClientCents).toBe(1059);
        expect(result.vatAmountCents).toBe(60);
    });
});

describe('computeUnitPrice — cascade with coordinator commission', () => {
    it('1000 cts HT × 1.125 × 1.03 × 1.06 → 1229 cts TTC (cascade, half-up rounding at each stage end)', () => {
        const result = computeUnitPrice({
            priceHtProducerCents: 1000,
            platformCommissionBps: 1250,
            coordinatorCommissionBps: 300,
            vatRate: 6,
        });
        // 1000 × 1.125 × 1.03 = 1158.75 → 1159 (HT client)
        expect(result.priceHtClientCents).toBe(1159);
        // 1159 × 1.06 = 1228.54 → 1229 (TTC client)
        expect(result.priceTtcClientCents).toBe(1229);
        expect(result.vatAmountCents).toBe(70);
    });
});

describe('computeUnitPrice — edge cases', () => {
    it('handles 0% commission (pass-through)', () => {
        const result = computeUnitPrice({
            priceHtProducerCents: 1000,
            platformCommissionBps: 0,
            coordinatorCommissionBps: 0,
            vatRate: 21,
        });
        expect(result.priceHtClientCents).toBe(1000);
        expect(result.priceTtcClientCents).toBe(1210);
        expect(result.vatAmountCents).toBe(210);
    });

    it('handles 0% VAT', () => {
        const result = computeUnitPrice({
            priceHtProducerCents: 500,
            platformCommissionBps: 3500,
            coordinatorCommissionBps: 0,
            vatRate: 0,
        });
        expect(result.priceHtClientCents).toBe(675);
        expect(result.priceTtcClientCents).toBe(675);
        expect(result.vatAmountCents).toBe(0);
    });

    it('rejects negative producer price', () => {
        expect(() =>
            computeUnitPrice({
                priceHtProducerCents: -1,
                platformCommissionBps: 3500,
                coordinatorCommissionBps: 0,
                vatRate: 6,
            }),
        ).toThrow();
    });

    it('rejects non-integer producer price', () => {
        expect(() =>
            computeUnitPrice({
                priceHtProducerCents: 1.5,
                platformCommissionBps: 3500,
                coordinatorCommissionBps: 0,
                vatRate: 6,
            }),
        ).toThrow();
    });

    it('rejects invalid VAT rate', () => {
        expect(() =>
            computeUnitPrice({
                priceHtProducerCents: 1000,
                platformCommissionBps: 3500,
                coordinatorCommissionBps: 0,
                vatRate: 10 as unknown as 6,
            }),
        ).toThrow();
    });
});

describe('computeLineTotals', () => {
    it('line snapshot with 3 units at 740 cts HT, 35% platform, 0% coord, 6% VAT', () => {
        const totals = computeLineTotals({
            qty: 3,
            unitPriceHtCents: 740,
            vatRate: 6,
            platformCommissionBps: 3500,
            coordinatorCommissionBps: 0,
        });
        expect(totals.lineHtClientCents).toBe(999 * 3);
        expect(totals.lineTtcClientCents).toBe(1059 * 3);
        expect(totals.lineVatCents).toBe(60 * 3);
        expect(totals.producerPayoutCents).toBe(740 * 3);
        expect(totals.coordinatorCommissionCents).toBe(0);
        expect(totals.platformMarginCents).toBe(
            totals.lineTtcClientCents - totals.lineVatCents - totals.producerPayoutCents,
        );
    });

    it('coordinator commission computed on snapshot HT × bps × qty', () => {
        const totals = computeLineTotals({
            qty: 2,
            unitPriceHtCents: 1000,
            vatRate: 6,
            platformCommissionBps: 1250,
            coordinatorCommissionBps: 300,
        });
        expect(totals.coordinatorCommissionCents).toBe(60);
        expect(totals.producerPayoutCents).toBe(2000);
        const expectedMargin =
            totals.lineTtcClientCents -
            totals.lineVatCents -
            totals.producerPayoutCents -
            totals.coordinatorCommissionCents;
        expect(totals.platformMarginCents).toBe(expectedMargin);
    });

    it('rejects qty <= 0', () => {
        expect(() =>
            computeLineTotals({
                qty: 0,
                unitPriceHtCents: 1000,
                vatRate: 6,
                platformCommissionBps: 3500,
                coordinatorCommissionBps: 0,
            }),
        ).toThrow();
    });
});

describe('computeOrderTotals', () => {
    it('sums totals across multiple lines', () => {
        const order = computeOrderTotals([
            {
                qty: 2,
                unitPriceHtCents: 740,
                vatRate: 6,
                platformCommissionBps: 3500,
                coordinatorCommissionBps: 0,
            },
            {
                qty: 1,
                unitPriceHtCents: 500,
                vatRate: 21,
                platformCommissionBps: 3500,
                coordinatorCommissionBps: 0,
            },
        ]);
        // line 1 : 999 ht × 2, 60 vat × 2, 1059 ttc × 2
        // line 2 : 675 ht × 1, 142 vat × 1, 817 ttc × 1  (675 × 1.21 = 816.75 → 817)
        expect(order.totalHtCents).toBe(999 * 2 + 675);
        expect(order.totalTtcCents).toBe(1059 * 2 + 817);
        expect(order.totalVatCents).toBe(60 * 2 + 142);
        expect(order.totalProducerPayoutCents).toBe(740 * 2 + 500);
    });

    it('returns zeros on empty line list', () => {
        const order = computeOrderTotals([]);
        expect(order.totalHtCents).toBe(0);
        expect(order.totalVatCents).toBe(0);
        expect(order.totalTtcCents).toBe(0);
        expect(order.totalProducerPayoutCents).toBe(0);
        expect(order.totalCoordinatorCommissionCents).toBe(0);
        expect(order.totalPlatformMarginCents).toBe(0);
    });
});

describe('formatEuros', () => {
    it('formats positive amounts', () => {
        expect(formatEuros(1059)).toBe('10,59 €');
        expect(formatEuros(100)).toBe('1,00 €');
        expect(formatEuros(5)).toBe('0,05 €');
    });

    it('formats zero', () => {
        expect(formatEuros(0)).toBe('0,00 €');
    });

    it('formats negative amounts', () => {
        expect(formatEuros(-150)).toBe('-1,50 €');
    });
});
