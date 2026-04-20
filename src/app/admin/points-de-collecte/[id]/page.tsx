import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { CollectionPointRow } from '@/lib/supabase/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { CollectionPointForm } from '../CollectionPointForm';

export const dynamic = 'force-dynamic';

type ScheduleShape = { day?: string | null; start?: string | null; end?: string | null };

export default async function EditCollectionPointPage({ params }: { params: { id: string } }) {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
        .from('collection_points')
        .select('*')
        .eq('id', params.id)
        .maybeSingle<CollectionPointRow>();

    if (!data) notFound();

    const schedule = (data.schedule as ScheduleShape | null) ?? null;

    return (
        <div className="space-y-6">
            <div>
                <Link href="/admin/points-de-collecte" className="text-sm text-gray-600 hover:text-gray-900">
                    ← Retour
                </Link>
                <h1 className="mt-2 text-2xl font-semibold text-gray-900">{data.name}</h1>
            </div>
            <CollectionPointForm
                mode="edit"
                collectionPointId={data.id}
                defaultValues={{
                    name: data.name,
                    slug: data.slug,
                    address: data.address,
                    schedule_day: schedule?.day ?? '',
                    schedule_start: schedule?.start ?? '',
                    schedule_end: schedule?.end ?? '',
                    coordinator_commission_percent: (data.coordinator_commission_bps / 100).toString(),
                }}
            />
        </div>
    );
}
