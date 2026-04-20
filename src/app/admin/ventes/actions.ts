'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export type SaleFormState = { error: string | null };

const schema = z
    .object({
        collection_point_id: z.string().uuid('Point de collecte requis.'),
        distribution_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de distribution requise.'),
        distribution_start_at: z
            .string()
            .transform((v) => (v.length > 0 ? v : null))
            .nullable(),
        distribution_end_at: z
            .string()
            .transform((v) => (v.length > 0 ? v : null))
            .nullable(),
        closes_at: z.string().min(1, 'Date de clôture requise.'),
    })
    .transform((raw, ctx) => {
        const closesAt = new Date(raw.closes_at);
        if (Number.isNaN(closesAt.getTime())) {
            ctx.addIssue({ code: 'custom', path: ['closes_at'], message: 'Date de clôture invalide.' });
            return z.NEVER;
        }
        const start = raw.distribution_start_at ? new Date(raw.distribution_start_at) : null;
        const end = raw.distribution_end_at ? new Date(raw.distribution_end_at) : null;
        if (start && end && end.getTime() < start.getTime()) {
            ctx.addIssue({
                code: 'custom',
                path: ['distribution_end_at'],
                message: 'La fin doit être après le début.',
            });
            return z.NEVER;
        }
        return {
            collection_point_id: raw.collection_point_id,
            distribution_date: raw.distribution_date,
            distribution_start_at: start?.toISOString() ?? null,
            distribution_end_at: end?.toISOString() ?? null,
            closes_at: closesAt.toISOString(),
        };
    });

function parseInput(formData: FormData) {
    return schema.safeParse({
        collection_point_id: String(formData.get('collection_point_id') ?? ''),
        distribution_date: String(formData.get('distribution_date') ?? ''),
        distribution_start_at: String(formData.get('distribution_start_at') ?? ''),
        distribution_end_at: String(formData.get('distribution_end_at') ?? ''),
        closes_at: String(formData.get('closes_at') ?? ''),
    });
}

export async function createSaleAction(
    _prev: SaleFormState,
    formData: FormData,
): Promise<SaleFormState> {
    const parsed = parseInput(formData);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? 'Entrée invalide.' };
    }
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from('sales').insert(parsed.data);
    if (error) return { error: error.message };

    revalidatePath('/admin/ventes');
    redirect('/admin/ventes');
}

export async function updateSaleAction(
    id: string,
    _prev: SaleFormState,
    formData: FormData,
): Promise<SaleFormState> {
    const parsed = parseInput(formData);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? 'Entrée invalide.' };
    }
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from('sales').update(parsed.data).eq('id', id);
    if (error) return { error: error.message };

    revalidatePath('/admin/ventes');
    redirect('/admin/ventes');
}

async function transition(id: string, status: 'open' | 'closed' | 'cancelled') {
    if (!id) return;
    const supabase = createSupabaseServerClient();
    await supabase.from('sales').update({ status }).eq('id', id);
    revalidatePath('/admin/ventes');
}

export async function openSaleAction(formData: FormData): Promise<void> {
    await transition(String(formData.get('id') ?? ''), 'open');
}

export async function closeSaleAction(formData: FormData): Promise<void> {
    await transition(String(formData.get('id') ?? ''), 'closed');
}

export async function cancelSaleAction(formData: FormData): Promise<void> {
    await transition(String(formData.get('id') ?? ''), 'cancelled');
}
