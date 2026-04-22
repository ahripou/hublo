/**
 * Calcul central prix / commission / TVA — source de vérité unique.
 *
 * Règles (CLAUDE.md) :
 * - Montants en centimes entiers, commissions en basis points (3500 = 35%).
 * - Rounding half-up, appliqué **uniquement à l'étape finale** de chaque montant
 *   (jamais de cascade : on part toujours du raw HT producteur, pas d'une valeur déjà arrondie).
 * - Inputs attendus = snapshots figés dans `order_lines` (ou settings pour `platformCommissionBps`).
 */

export const ALLOWED_VAT_RATES = [0, 6, 21] as const;
export type VatRate = (typeof ALLOWED_VAT_RATES)[number];

export interface PricingInput {
  /** `products.price_ht_cents` (ou `order_lines.unit_price_ht_cents` snapshot) */
  producerPriceHtCents: number;
  /** `settings.platform_commission_bps` (ou snapshot) */
  platformCommissionBps: number;
  /** `collection_points.coordinator_commission_bps` (snapshot). 0 au MVP. */
  coordinatorCommissionBps: number;
  /** `products.vat_rate` (snapshot) */
  vatRate: VatRate;
  /** `order_lines.qty` — doit être un entier strictement positif */
  qty: number;
}

export interface LineBreakdown {
  /** Prix HT client, par unité — affichage catalogue */
  unitPriceHtCents: number;
  /** Prix TTC client, par unité — affichage panier */
  unitPriceTtcCents: number;
  /** Total HT de la ligne (= arrondi(qty × raw HT client), pas qty × unit arrondi) */
  lineHtCents: number;
  /** Total TVA de la ligne (= lineTtcCents − lineHtCents) */
  lineTvaCents: number;
  /** Total TTC de la ligne */
  lineTtcCents: number;
  /** À reverser au producteur (qty × producerPriceHtCents, toujours exact) */
  producerPayoutCents: number;
  /** Commission coordinateur à payer (0 au MVP) */
  coordinatorCommissionCents: number;
  /** Commission plateforme conservée (= ttc − tva − producteur − coordinateur) */
  platformCommissionCents: number;
}

function roundHalfUp(n: number): number {
  return Math.floor(n + 0.5);
}

export function computeLine(input: PricingInput): LineBreakdown {
  const {
    producerPriceHtCents,
    platformCommissionBps,
    coordinatorCommissionBps,
    vatRate,
    qty,
  } = input;

  const commissionMultiplier =
    (1 + platformCommissionBps / 10000) * (1 + coordinatorCommissionBps / 10000);
  const vatMultiplier = 1 + vatRate / 100;

  const unitPriceHtCents = roundHalfUp(producerPriceHtCents * commissionMultiplier);
  const unitPriceTtcCents = roundHalfUp(
    producerPriceHtCents * commissionMultiplier * vatMultiplier,
  );

  const lineHtCents = roundHalfUp(producerPriceHtCents * commissionMultiplier * qty);
  const lineTtcCents = roundHalfUp(
    producerPriceHtCents * commissionMultiplier * vatMultiplier * qty,
  );
  const lineTvaCents = lineTtcCents - lineHtCents;

  const producerPayoutCents = producerPriceHtCents * qty;
  const coordinatorCommissionCents = roundHalfUp(
    (producerPriceHtCents * qty * coordinatorCommissionBps) / 10000,
  );
  const platformCommissionCents =
    lineTtcCents - lineTvaCents - producerPayoutCents - coordinatorCommissionCents;

  return {
    unitPriceHtCents,
    unitPriceTtcCents,
    lineHtCents,
    lineTvaCents,
    lineTtcCents,
    producerPayoutCents,
    coordinatorCommissionCents,
    platformCommissionCents,
  };
}
