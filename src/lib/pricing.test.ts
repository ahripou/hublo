import { describe, it, expect } from 'vitest';
import { computeLine } from './pricing';

describe('computeLine — exemple de référence CLAUDE.md', () => {
  it('740 cts HT × 35% plateforme × 0% coord × TVA 6% × qty 1 → 999 HT / 1059 TTC', () => {
    const r = computeLine({
      producerPriceHtCents: 740,
      platformCommissionBps: 3500,
      coordinatorCommissionBps: 0,
      vatRate: 6,
      qty: 1,
    });
    expect(r.unitPriceHtCents).toBe(999);
    expect(r.unitPriceTtcCents).toBe(1059);
    expect(r.lineHtCents).toBe(999);
    expect(r.lineTtcCents).toBe(1059);
    expect(r.lineTvaCents).toBe(60);
    expect(r.producerPayoutCents).toBe(740);
    expect(r.coordinatorCommissionCents).toBe(0);
    expect(r.platformCommissionCents).toBe(259);
  });
});

describe('computeLine — arrondi half-up', () => {
  it('arrondit 0,5 vers le haut (pas banker rounding)', () => {
    // 750 × 1.35 = 1012.5 → 1013 (half-up), PAS 1012 (half-to-even)
    const r = computeLine({
      producerPriceHtCents: 750,
      platformCommissionBps: 3500,
      coordinatorCommissionBps: 0,
      vatRate: 0,
      qty: 1,
    });
    expect(r.unitPriceHtCents).toBe(1013);
  });

  it('arrondit chaque sortie depuis le raw HT, pas en cascade', () => {
    // 750 × 1.35 × 1.06 = 1073.25 → 1073
    // Si on cascadait (1013 × 1.06 = 1073.78), on obtiendrait 1074. Non !
    const r = computeLine({
      producerPriceHtCents: 750,
      platformCommissionBps: 3500,
      coordinatorCommissionBps: 0,
      vatRate: 6,
      qty: 1,
    });
    expect(r.unitPriceHtCents).toBe(1013);
    expect(r.unitPriceTtcCents).toBe(1073);
  });
});

describe('computeLine — TVA', () => {
  it('TVA 0% → HT = TTC, TVA = 0', () => {
    const r = computeLine({
      producerPriceHtCents: 1000,
      platformCommissionBps: 3500,
      coordinatorCommissionBps: 0,
      vatRate: 0,
      qty: 2,
    });
    expect(r.unitPriceHtCents).toBe(1350);
    expect(r.unitPriceTtcCents).toBe(1350);
    expect(r.lineHtCents).toBe(2700);
    expect(r.lineTtcCents).toBe(2700);
    expect(r.lineTvaCents).toBe(0);
  });

  it('TVA 21%', () => {
    const r = computeLine({
      producerPriceHtCents: 500,
      platformCommissionBps: 3500,
      coordinatorCommissionBps: 0,
      vatRate: 21,
      qty: 1,
    });
    // 500 × 1.35 = 675 HT
    // 675 × 1.21 = 816.75 → 817 TTC
    expect(r.unitPriceHtCents).toBe(675);
    expect(r.unitPriceTtcCents).toBe(817);
    expect(r.lineTvaCents).toBe(142);
  });
});

describe('computeLine — commission coordinateur', () => {
  it('coord 5% sur plat 30% + TVA 6%', () => {
    const r = computeLine({
      producerPriceHtCents: 1000,
      platformCommissionBps: 3000,
      coordinatorCommissionBps: 500,
      vatRate: 6,
      qty: 1,
    });
    // HT = 1000 × 1.30 × 1.05 = 1365
    // TTC = 1365 × 1.06 = 1446.9 → 1447
    expect(r.unitPriceHtCents).toBe(1365);
    expect(r.unitPriceTtcCents).toBe(1447);
    expect(r.producerPayoutCents).toBe(1000);
    expect(r.coordinatorCommissionCents).toBe(50); // 1000 × 500/10000
    // plat = 1447 - 82 - 1000 - 50 = 315
    expect(r.lineTvaCents).toBe(82);
    expect(r.platformCommissionCents).toBe(315);
  });
});

describe('computeLine — quantité > 1', () => {
  it('totaux ligne = arrondi(qty × raw), pas qty × unit arrondi', () => {
    // 740 × 1.35 × 1.06 = 1058.94 raw unit TTC
    // qty = 3 : raw line TTC = 3176.82 → 3177
    const r = computeLine({
      producerPriceHtCents: 740,
      platformCommissionBps: 3500,
      coordinatorCommissionBps: 0,
      vatRate: 6,
      qty: 3,
    });
    expect(r.unitPriceTtcCents).toBe(1059);
    expect(r.lineTtcCents).toBe(3177);
    expect(r.lineHtCents).toBe(2997); // 740 × 1.35 × 3 = 2997
  });

  it('reversement producteur = qty × producerPriceHtCents, exact', () => {
    const r = computeLine({
      producerPriceHtCents: 1234,
      platformCommissionBps: 3500,
      coordinatorCommissionBps: 0,
      vatRate: 6,
      qty: 7,
    });
    expect(r.producerPayoutCents).toBe(1234 * 7);
  });
});

describe('computeLine — invariants', () => {
  const cases = [
    { producerPriceHtCents: 740, platformCommissionBps: 3500, coordinatorCommissionBps: 0, vatRate: 6 as const, qty: 1 },
    { producerPriceHtCents: 875, platformCommissionBps: 3500, coordinatorCommissionBps: 300, vatRate: 21 as const, qty: 4 },
    { producerPriceHtCents: 10, platformCommissionBps: 3500, coordinatorCommissionBps: 0, vatRate: 0 as const, qty: 1 },
    { producerPriceHtCents: 999900, platformCommissionBps: 3500, coordinatorCommissionBps: 0, vatRate: 21 as const, qty: 1 },
    { producerPriceHtCents: 1299, platformCommissionBps: 2500, coordinatorCommissionBps: 500, vatRate: 6 as const, qty: 12 },
  ];

  it.each(cases)('producteur + coord + plateforme + TVA = TTC — $producerPriceHtCents cts × $qty', (input) => {
    const r = computeLine(input);
    expect(
      r.producerPayoutCents +
        r.coordinatorCommissionCents +
        r.platformCommissionCents +
        r.lineTvaCents,
    ).toBe(r.lineTtcCents);
  });

  it.each(cases)('lineTvaCents = lineTtcCents − lineHtCents', (input) => {
    const r = computeLine(input);
    expect(r.lineTtcCents - r.lineHtCents).toBe(r.lineTvaCents);
  });
});
