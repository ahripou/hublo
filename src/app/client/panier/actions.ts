'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ProductRow, SaleRow } from '@/lib/supabase/db-types';

export type CartActionResult = { error: string | null };

const addSchema = z.object({
    product_id: z.string().uuid('Produit invalide.'),
    qty: z.coerce.number().int().min(1, 'Quantité minimum 1.').max(99, 'Quantité maximum 99.'),
});

async function requireAuthed() {
    const supabase = createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        redirect('/auth/login?redirect=/client/panier');
    }
    return { supabase, userId: user.id };
}

/**
 * Trouve la vente ouverte sur le point de collecte du produit.
 * Retourne null si aucune vente ouverte (on refuse l'ajout au panier).
 */
async function findOpenSaleForProduct(
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    product: Pick<ProductRow, 'collection_point_id'>,
): Promise<SaleRow | null> {
    if (!product.collection_point_id) return null;
    const { data } = await supabase
        .from('sales')
        .select('*')
        .eq('collection_point_id', product.collection_point_id)
        .eq('status', 'open')
        .order('closes_at', { ascending: true })
        .limit(1)
        .maybeSingle<SaleRow>();
    return data ?? null;
}

export async function addToCartAction(formData: FormData): Promise<CartActionResult> {
    const { supabase, userId } = await requireAuthed();

    const parsed = addSchema.safeParse({
        product_id: String(formData.get('product_id') ?? ''),
        qty: formData.get('qty') ?? '1',
    });
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? 'Entrée invalide.' };
    }

    // Vérifier que le produit existe et est actif
    const { data: product } = await supabase
        .from('products')
        .select('id, collection_point_id, status, stock_unlimited, stock_qty, name')
        .eq('id', parsed.data.product_id)
        .maybeSingle<Pick<ProductRow, 'id' | 'collection_point_id' | 'status' | 'stock_unlimited' | 'stock_qty' | 'name'>>();

    if (!product || product.status !== 'active') {
        return { error: 'Ce produit n’est plus disponible.' };
    }

    const sale = await findOpenSaleForProduct(supabase, product);
    if (!sale) {
        return { error: 'Aucune vente ouverte pour ce produit.' };
    }

    if (!product.stock_unlimited && (product.stock_qty ?? 0) < parsed.data.qty) {
        return { error: `Stock insuffisant (${product.stock_qty ?? 0} disponibles).` };
    }

    // Le panier ne peut contenir qu'une seule vente à la fois (simplifie le
    // checkout : 1 panier = 1 commande = 1 paiement Mollie).
    const { data: existing } = await supabase
        .from('cart_items')
        .select('sale_id')
        .eq('client_user_id', userId)
        .limit(1)
        .maybeSingle<{ sale_id: string }>();
    if (existing && existing.sale_id !== sale.id) {
        return {
            error:
                'Vous avez déjà des articles d’une autre vente dans votre panier. Videz-le avant d’ajouter ceci.',
        };
    }

    // Upsert : si déjà dans le panier, on remplace la quantité (pas d'addition,
    // plus simple et déterministe pour l'utilisateur).
    const { error } = await supabase
        .from('cart_items')
        .upsert(
            {
                client_user_id: userId,
                sale_id: sale.id,
                product_id: product.id,
                qty: parsed.data.qty,
            },
            { onConflict: 'client_user_id,product_id' },
        );

    if (error) return { error: error.message };

    revalidatePath('/client/panier');
    return { error: null };
}

const updateSchema = z.object({
    cart_item_id: z.string().uuid(),
    qty: z.coerce.number().int().min(1).max(99),
});

export async function updateCartItemAction(formData: FormData): Promise<void> {
    const { supabase, userId } = await requireAuthed();
    const parsed = updateSchema.safeParse({
        cart_item_id: String(formData.get('cart_item_id') ?? ''),
        qty: formData.get('qty') ?? '1',
    });
    if (!parsed.success) return;

    await supabase
        .from('cart_items')
        .update({ qty: parsed.data.qty })
        .eq('id', parsed.data.cart_item_id)
        .eq('client_user_id', userId);

    revalidatePath('/client/panier');
}

export async function removeCartItemAction(formData: FormData): Promise<void> {
    const { supabase, userId } = await requireAuthed();
    const id = String(formData.get('cart_item_id') ?? '');
    if (!id) return;

    await supabase.from('cart_items').delete().eq('id', id).eq('client_user_id', userId);
    revalidatePath('/client/panier');
}

export async function clearCartAction(): Promise<void> {
    const { supabase, userId } = await requireAuthed();
    await supabase.from('cart_items').delete().eq('client_user_id', userId);
    revalidatePath('/client/panier');
}
