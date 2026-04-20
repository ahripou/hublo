import Link from 'next/link';
import { notFound } from 'next/navigation';

import { toDateTimeLocalInput } from '@/lib/format';
import type { SaleRow } from '@/lib/supabase/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { SaleForm } from '../SaleForm';

export const dynamic = 'force-dynamic';

export default async function EditSalePage({ params }: { params: { id: string } }) {
    const supabase = createSupabaseServerClient();
    const [{ data: sale }, { data: points }] = await Promise.all([
        supabase.from('sales').select('*').eq('id', params.id).maybeSingle<SaleRow>(),
        supabase.from('collection_points').select('id, name').eq('status', 'active').order('name'),
    ]);

    if (!sale) notFound();

    return (
        <div className="space-y-6">
            <div>
                <Link href="/admin/ventes" className="text-sm text-gray-600 hover:text-gray-900">
                    ← Retour
                </Link>
                <h1 className="mt-2 text-2xl font-semibold text-gray-900">
                    Vente du {sale.distribution_date}
                </h1>
            </div>
            <SaleForm
                mode="edit"
                saleId={sale.id}
                collectionPoints={points ?? []}
                defaultValues={{
                    collection_point_id: sale.collection_point_id,
                    distribution_date: sale.distribution_date,
                    distribution_start_at: toDateTimeLocalInput(sale.distribution_start_at),
                    distribution_end_at: toDateTimeLocalInput(sale.distribution_end_at),
                    closes_at: toDateTimeLocalInput(sale.closes_at),
                }}
            />
        </div>
    );
}
