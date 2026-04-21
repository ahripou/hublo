import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computeLineTotals } from '@/lib/pricing';
import type { VatRate } from '@/lib/supabase/db-types';

// Colonnes Odoo : date_distribution, client_email, client_nom, producteur, produit, qty,
//                 prix_ht_producteur_cts, tva_pct, prix_ht_client_cts, prix_ttc_client_cts,
//                 commission_plateforme_cts, commission_coordinateur_cts
const CSV_HEADER =
    'date_distribution,client_email,client_nom,producteur,produit,qty,' +
    'prix_ht_producteur_cts,tva_pct,prix_ht_client_cts,prix_ttc_client_cts,' +
    'commission_plateforme_cts,commission_coordinateur_cts\n';

interface ExportLine {
    qty: number;
    unit_price_ht_cents: number;
    vat_rate: number;
    platform_commission_bps: number;
    coordinator_commission_bps: number;
    status: string;
    products: { name: string } | null;
    producers: { name: string } | null;
    orders: {
        status: string;
        users: { email: string; first_name: string | null; last_name: string | null } | null;
        sales: { distribution_date: string } | null;
    } | null;
}

function csvField(value: string | number): string {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function clientName(
    u: { email: string; first_name: string | null; last_name: string | null } | null,
): string {
    if (!u) return '';
    return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email;
}

export async function GET(req: NextRequest) {
    const supabase = createSupabaseServerClient();

    // Vérification admin via RLS / session
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return new NextResponse('Unauthorized', { status: 401 });
    }
    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle<{ role: string }>();
    if (profile?.role !== 'admin') {
        return new NextResponse('Forbidden', { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let query = supabase
        .from('order_lines')
        .select(
            'qty, unit_price_ht_cents, vat_rate, platform_commission_bps, coordinator_commission_bps, status, products(name), producers(name), orders!inner(status, users(email, first_name, last_name), sales!inner(distribution_date))',
        )
        .eq('status', 'active')
        .eq('orders.status', 'confirmed')
        .order('orders.sales.distribution_date', { ascending: true });

    if (from) query = query.gte('orders.sales.distribution_date', from);
    if (to) query = query.lte('orders.sales.distribution_date', to);

    const { data: lines, error } = await query.returns<ExportLine[]>();

    if (error) {
        return new NextResponse(error.message, { status: 500 });
    }

    const rows = (lines ?? []).map((line) => {
        const totals = computeLineTotals({
            qty: line.qty,
            unitPriceHtCents: line.unit_price_ht_cents,
            vatRate: line.vat_rate as VatRate,
            platformCommissionBps: line.platform_commission_bps,
            coordinatorCommissionBps: line.coordinator_commission_bps,
        });

        return [
            line.orders?.sales?.distribution_date ?? '',
            line.orders?.users?.email ?? '',
            clientName(line.orders?.users ?? null),
            line.producers?.name ?? '',
            line.products?.name ?? '',
            line.qty,
            line.unit_price_ht_cents,
            line.vat_rate,
            totals.lineHtClientCents,
            totals.lineTtcClientCents,
            totals.platformMarginCents,
            totals.coordinatorCommissionCents,
        ]
            .map(csvField)
            .join(',');
    });

    const csv = CSV_HEADER + rows.join('\n');

    const filename = `hublo_ventes_${from ?? 'all'}_${to ?? 'all'}.csv`;

    return new NextResponse(csv, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
}
