import { Resend } from 'resend';

import { formatCentsAsEuros, formatDate } from '@/lib/format';
import type { CollectionPointRow, ProducerRow, ProductRow, SaleRow } from '@/lib/supabase/db-types';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';

function getResend(): Resend | null {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    return new Resend(key);
}

function getFromAddress(): string {
    return process.env.RESEND_FROM ?? 'Hublo <noreply@hublo.be>';
}

interface OrderEmailData {
    clientEmail: string;
    orderId: string;
    orderNumber: string;
    totalTtcCents: number;
    sale: SaleRow & { collection_points: CollectionPointRow | null };
    lines: {
        name: string;
        producerName: string;
        qty: number;
        lineTtcCents: number;
    }[];
}

interface JoinedLine {
    qty: number;
    unit_price_ht_cents: number;
    vat_rate: number;
    platform_commission_bps: number;
    coordinator_commission_bps: number;
    products: Pick<ProductRow, 'name'> | null;
    producers: Pick<ProducerRow, 'name'> | null;
}

async function loadOrderForEmail(orderId: string): Promise<OrderEmailData | null> {
    const supabase = createSupabaseServiceRoleClient();
    const [{ data: order }, { data: lines }] = await Promise.all([
        supabase
            .from('orders')
            .select(
                'id, client_user_id, total_ttc_cents, sales(*, collection_points(*)), users:client_user_id(email)',
            )
            .eq('id', orderId)
            .maybeSingle<{
                id: string;
                client_user_id: string;
                total_ttc_cents: number;
                sales: (SaleRow & { collection_points: CollectionPointRow | null }) | null;
                users: { email: string } | null;
            }>(),
        supabase
            .from('order_lines')
            .select(
                'qty, unit_price_ht_cents, vat_rate, platform_commission_bps, coordinator_commission_bps, ' +
                    'products(name), producers(name)',
            )
            .eq('order_id', orderId)
            .eq('status', 'active')
            .returns<JoinedLine[]>(),
    ]);

    if (!order || !order.users?.email || !order.sales) return null;

    const { computeUnitPrice } = await import('@/lib/pricing');
    const emailLines = (lines ?? []).map((l) => {
        const unit = computeUnitPrice({
            priceHtProducerCents: l.unit_price_ht_cents,
            platformCommissionBps: l.platform_commission_bps,
            coordinatorCommissionBps: l.coordinator_commission_bps,
            vatRate: l.vat_rate as 0 | 6 | 21,
        });
        return {
            name: l.products?.name ?? 'Produit',
            producerName: l.producers?.name ?? '—',
            qty: l.qty,
            lineTtcCents: unit.priceTtcClientCents * l.qty,
        };
    });

    return {
        clientEmail: order.users.email,
        orderId: order.id,
        orderNumber: order.id.slice(0, 8),
        totalTtcCents: order.total_ttc_cents,
        sale: order.sales,
        lines: emailLines,
    };
}

function renderOrderConfirmationHtml(data: OrderEmailData): string {
    const lines = data.lines
        .map(
            (l) =>
                `<tr><td style="padding:4px 8px;">${escapeHtml(l.name)} <span style="color:#6b7280;">× ${l.qty}</span></td><td style="padding:4px 8px; color:#6b7280;">${escapeHtml(l.producerName)}</td><td style="padding:4px 8px; text-align:right;">${formatCentsAsEuros(l.lineTtcCents)}</td></tr>`,
        )
        .join('');
    const pointName = data.sale.collection_points?.name ?? '—';
    return `<!doctype html>
<html lang="fr"><body style="font-family:system-ui,sans-serif; color:#171717;">
<div style="max-width:560px; margin:0 auto; padding:24px;">
  <h1 style="color:#2f7a3a;">Merci pour votre commande !</h1>
  <p>Votre paiement est confirmé. Voici le récapitulatif :</p>
  <p><strong>Commande :</strong> ${escapeHtml(data.orderNumber)}<br>
  <strong>Distribution :</strong> ${formatDate(data.sale.distribution_date)} à ${escapeHtml(pointName)}</p>
  <table style="width:100%; border-collapse:collapse; font-size:14px; margin-top:16px;">
    <thead><tr style="background:#f9fafb;">
      <th style="padding:8px; text-align:left;">Produit</th>
      <th style="padding:8px; text-align:left;">Producteur</th>
      <th style="padding:8px; text-align:right;">Total TTC</th>
    </tr></thead>
    <tbody>${lines}</tbody>
    <tfoot><tr style="border-top:1px solid #e5e7eb; font-weight:600;">
      <td colspan="2" style="padding:8px;">Total</td>
      <td style="padding:8px; text-align:right; color:#2f7a3a;">${formatCentsAsEuros(data.totalTtcCents)}</td>
    </tr></tfoot>
  </table>
  <p style="margin-top:24px; color:#6b7280; font-size:12px;">À bientôt sur Hublo.be</p>
</div></body></html>`;
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => {
        switch (c) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case "'":
                return '&#39;';
            default:
                return c;
        }
    });
}

export async function sendOrderConfirmationEmail(orderId: string): Promise<void> {
    const resend = getResend();
    if (!resend) {
        console.warn('sendOrderConfirmationEmail: RESEND_API_KEY missing, skipping.');
        return;
    }

    const data = await loadOrderForEmail(orderId);
    if (!data) {
        console.error('sendOrderConfirmationEmail: order not loadable', orderId);
        return;
    }

    await resend.emails.send({
        from: getFromAddress(),
        to: data.clientEmail,
        subject: `Hublo — commande ${data.orderNumber} confirmée`,
        html: renderOrderConfirmationHtml(data),
    });
}
