'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { parseEurosToCents } from '@/lib/format';
import { slugify } from '@/lib/slug';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type ProductFormState = { error: string | null };

const schema = z
    .object({
        producer_id: z.string().uuid('Producteur requis.'),
        collection_point_id: z
            .string()
            .transform((v) => (v.length > 0 ? v : null))
            .nullable(),
        name: z.string().trim().min(2, 'Nom trop court.').max(120, 'Nom trop long.'),
        slug: z
            .string()
            .trim()
            .transform((v) => (v.length > 0 ? v : undefined))
            .optional(),
        description: z.string().trim().min(1, 'Description requise.'),
        photo_url: z
            .string()
            .trim()
            .transform((v) => (v.length > 0 ? v : null))
            .nullable(),
        photo_alt: z
            .string()
            .trim()
            .transform((v) => (v.length > 0 ? v : null))
            .nullable(),
        price_euros: z.string().min(1, 'Prix HT requis.'),
        vat_rate: z.string().transform((v) => parseInt(v, 10)),
        stock_mode: z.enum(['unlimited', 'limited']),
        stock_qty: z.string().optional(),
    })
    .transform((raw, ctx) => {
        const priceCents = parseEurosToCents(raw.price_euros);
        if (priceCents === null) {
            ctx.addIssue({ code: 'custom', path: ['price_euros'], message: 'Prix HT invalide.' });
            return z.NEVER;
        }
        if (priceCents < 10 || priceCents > 999_900) {
            ctx.addIssue({ code: 'custom', path: ['price_euros'], message: 'Prix entre 0,10 € et 9 999 €.' });
            return z.NEVER;
        }
        if (![0, 6, 21].includes(raw.vat_rate)) {
            ctx.addIssue({ code: 'custom', path: ['vat_rate'], message: 'TVA doit être 0, 6 ou 21.' });
            return z.NEVER;
        }
        let stockQty: number | null = null;
        if (raw.stock_mode === 'limited') {
            const qty = parseInt(String(raw.stock_qty ?? ''), 10);
            if (!Number.isInteger(qty) || qty < 0) {
                ctx.addIssue({ code: 'custom', path: ['stock_qty'], message: 'Quantité stock invalide.' });
                return z.NEVER;
            }
            stockQty = qty;
        }
        return {
            producer_id: raw.producer_id,
            collection_point_id: raw.collection_point_id,
            name: raw.name,
            slug: raw.slug,
            description: raw.description,
            photo_url: raw.photo_url,
            photo_alt: raw.photo_alt,
            price_ht_cents: priceCents,
            vat_rate: raw.vat_rate,
            stock_unlimited: raw.stock_mode === 'unlimited',
            stock_qty: stockQty,
        };
    });

function parseInput(formData: FormData) {
    return schema.safeParse({
        producer_id: String(formData.get('producer_id') ?? ''),
        collection_point_id: String(formData.get('collection_point_id') ?? ''),
        name: String(formData.get('name') ?? ''),
        slug: String(formData.get('slug') ?? ''),
        description: String(formData.get('description') ?? ''),
        photo_url: String(formData.get('photo_url') ?? ''),
        photo_alt: String(formData.get('photo_alt') ?? ''),
        price_euros: String(formData.get('price_euros') ?? ''),
        vat_rate: String(formData.get('vat_rate') ?? '6'),
        stock_mode: String(formData.get('stock_mode') ?? 'unlimited'),
        stock_qty: String(formData.get('stock_qty') ?? ''),
    });
}

export async function createProductAction(
    _prev: ProductFormState,
    formData: FormData,
): Promise<ProductFormState> {
    const parsed = parseInput(formData);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? 'Entrée invalide.' };
    }
    const { slug: slugOverride, ...rest } = parsed.data;
    const payload = { ...rest, slug: slugOverride ?? slugify(rest.name) };
    if (!payload.slug) return { error: 'Slug impossible à générer depuis le nom.' };

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from('products').insert(payload);
    if (error) return { error: friendlyError(error.message) };

    revalidatePath('/admin/produits');
    redirect('/admin/produits');
}

export async function updateProductAction(
    id: string,
    _prev: ProductFormState,
    formData: FormData,
): Promise<ProductFormState> {
    const parsed = parseInput(formData);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? 'Entrée invalide.' };
    }
    const { slug: slugOverride, ...rest } = parsed.data;
    const payload = { ...rest, slug: slugOverride ?? slugify(rest.name) };
    if (!payload.slug) return { error: 'Slug impossible à générer depuis le nom.' };

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from('products').update(payload).eq('id', id);
    if (error) return { error: friendlyError(error.message) };

    revalidatePath('/admin/produits');
    redirect('/admin/produits');
}

export async function archiveProductAction(formData: FormData): Promise<void> {
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    const supabase = createSupabaseServerClient();
    await supabase.from('products').update({ status: 'archived' }).eq('id', id);
    revalidatePath('/admin/produits');
}

export async function restoreProductAction(formData: FormData): Promise<void> {
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    const supabase = createSupabaseServerClient();
    await supabase.from('products').update({ status: 'active' }).eq('id', id);
    revalidatePath('/admin/produits');
}

function friendlyError(raw: string): string {
    if (raw.includes('duplicate key') && raw.includes('slug')) {
        return 'Ce slug existe déjà. Choisis-en un autre.';
    }
    if (raw.includes('stock_coherence')) {
        return 'Cohérence stock : si limité, la quantité doit être un entier ≥ 0.';
    }
    return raw;
}
