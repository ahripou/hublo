import Link from 'next/link';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ProductForm } from '../ProductForm';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
    const supabase = createSupabaseServerClient();
    const [{ data: producers }, { data: points }] = await Promise.all([
        supabase.from('producers').select('id, name').eq('status', 'active').order('name'),
        supabase.from('collection_points').select('id, name').eq('status', 'active').order('name'),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <Link href="/admin/produits" className="text-sm text-gray-600 hover:text-gray-900">
                    ← Retour
                </Link>
                <h1 className="mt-2 text-2xl font-semibold text-gray-900">Nouveau produit</h1>
            </div>
            {(producers ?? []).length === 0 ? (
                <p className="text-sm text-gray-600">
                    Il faut d&apos;abord créer un producteur actif avant de créer un produit.
                </p>
            ) : (
                <ProductForm
                    mode="create"
                    producers={producers ?? []}
                    collectionPoints={points ?? []}
                />
            )}
        </div>
    );
}
