import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { ProducerRow } from '@/lib/supabase/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ProducerForm } from '../ProducerForm';

export const dynamic = 'force-dynamic';

export default async function EditProducerPage({ params }: { params: { id: string } }) {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
        .from('producers')
        .select('*')
        .eq('id', params.id)
        .maybeSingle<ProducerRow>();

    if (!data) notFound();

    return (
        <div className="space-y-6">
            <div>
                <Link href="/admin/producteurs" className="text-sm text-gray-600 hover:text-gray-900">
                    ← Retour
                </Link>
                <h1 className="mt-2 text-2xl font-semibold text-gray-900">{data.name}</h1>
            </div>
            <ProducerForm
                mode="edit"
                producerId={data.id}
                defaultValues={{
                    name: data.name,
                    slug: data.slug,
                    description: data.description ?? '',
                    vat_number: data.vat_number ?? '',
                }}
            />
        </div>
    );
}
