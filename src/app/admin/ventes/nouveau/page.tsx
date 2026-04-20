import Link from 'next/link';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { SaleForm } from '../SaleForm';

export const dynamic = 'force-dynamic';

export default async function NewSalePage() {
    const supabase = createSupabaseServerClient();
    const { data: points } = await supabase
        .from('collection_points')
        .select('id, name')
        .eq('status', 'active')
        .order('name');

    return (
        <div className="space-y-6">
            <div>
                <Link href="/admin/ventes" className="text-sm text-gray-600 hover:text-gray-900">
                    ← Retour
                </Link>
                <h1 className="mt-2 text-2xl font-semibold text-gray-900">Nouvelle vente</h1>
            </div>
            {(points ?? []).length === 0 ? (
                <p className="text-sm text-gray-600">
                    Il faut d&apos;abord créer un point de collecte actif.
                </p>
            ) : (
                <SaleForm mode="create" collectionPoints={points ?? []} />
            )}
        </div>
    );
}
