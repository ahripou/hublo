import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { ProductRow } from '@/lib/supabase/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ProductForm } from '../ProductForm';

export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: { params: { id: string } }) {
    const supabase = createSupabaseServerClient();
    const [{ data: product }, { data: producers }, { data: points }] = await Promise.all([
        supabase.from('products').select('*').eq('id', params.id).maybeSingle<ProductRow>(),
        supabase.from('producers').select('id, name').eq('status', 'active').order('name'),
        supabase.from('collection_points').select('id, name').eq('status', 'active').order('name'),
    ]);

    if (!product) notFound();

    return (
        <div className="space-y-6">
            <div>
                <Link href="/admin/produits" className="text-sm text-gray-600 hover:text-gray-900">
                    ← Retour
                </Link>
                <h1 className="mt-2 text-2xl font-semibold text-gray-900">{product.name}</h1>
            </div>
            <ProductForm
                mode="edit"
                productId={product.id}
                producers={producers ?? []}
                collectionPoints={points ?? []}
                defaultValues={{
                    producer_id: product.producer_id,
                    collection_point_id: product.collection_point_id ?? '',
                    name: product.name,
                    slug: product.slug,
                    description: product.description,
                    photo_url: product.photo_url ?? '',
                    photo_alt: product.photo_alt ?? '',
                    price_euros: (product.price_ht_cents / 100).toFixed(2),
                    vat_rate: String(product.vat_rate),
                    stock_mode: product.stock_unlimited ? 'unlimited' : 'limited',
                    stock_qty: product.stock_qty !== null ? String(product.stock_qty) : '',
                }}
            />
        </div>
    );
}
