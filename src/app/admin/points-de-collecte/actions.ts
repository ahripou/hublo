'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { slugify } from '@/lib/slug';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type CollectionPointFormState = { error: string | null };

const schema = z.object({
    name: z.string().trim().min(2, 'Nom trop court.').max(120, 'Nom trop long.'),
    slug: z
        .string()
        .trim()
        .transform((v) => (v.length > 0 ? v : undefined))
        .optional(),
    address: z.string().trim().min(5, 'Adresse trop courte.'),
    schedule_day: z
        .string()
        .trim()
        .transform((v) => (v.length > 0 ? v : null))
        .nullable(),
    schedule_start: z
        .string()
        .trim()
        .transform((v) => (v.length > 0 ? v : null))
        .nullable(),
    schedule_end: z
        .string()
        .trim()
        .transform((v) => (v.length > 0 ? v : null))
        .nullable(),
    coordinator_commission_percent: z
        .string()
        .transform((v) => (v.trim().length === 0 ? '0' : v.trim()))
        .pipe(z.string().regex(/^\d{1,2}(\.\d{1,2})?$/, 'Pourcentage invalide.'))
        .transform((v) => Math.round(parseFloat(v) * 100))
        .refine((bps) => bps >= 0 && bps <= 10_000, 'Entre 0 et 100%.'),
});

function parseInput(formData: FormData) {
    return schema.safeParse({
        name: String(formData.get('name') ?? ''),
        slug: String(formData.get('slug') ?? ''),
        address: String(formData.get('address') ?? ''),
        schedule_day: String(formData.get('schedule_day') ?? ''),
        schedule_start: String(formData.get('schedule_start') ?? ''),
        schedule_end: String(formData.get('schedule_end') ?? ''),
        coordinator_commission_percent: String(formData.get('coordinator_commission_percent') ?? ''),
    });
}

function buildPayload(data: z.infer<typeof schema>) {
    const schedule =
        data.schedule_day || data.schedule_start || data.schedule_end
            ? {
                  day: data.schedule_day,
                  start: data.schedule_start,
                  end: data.schedule_end,
              }
            : null;
    return {
        name: data.name,
        slug: data.slug ?? slugify(data.name),
        address: data.address,
        schedule,
        coordinator_commission_bps: data.coordinator_commission_percent,
    };
}

export async function createCollectionPointAction(
    _prev: CollectionPointFormState,
    formData: FormData,
): Promise<CollectionPointFormState> {
    const parsed = parseInput(formData);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? 'Entrée invalide.' };
    }
    const payload = buildPayload(parsed.data);
    if (!payload.slug) return { error: 'Slug impossible à générer depuis le nom.' };

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from('collection_points').insert(payload);
    if (error) return { error: friendlyError(error.message) };

    revalidatePath('/admin/points-de-collecte');
    redirect('/admin/points-de-collecte');
}

export async function updateCollectionPointAction(
    id: string,
    _prev: CollectionPointFormState,
    formData: FormData,
): Promise<CollectionPointFormState> {
    const parsed = parseInput(formData);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? 'Entrée invalide.' };
    }
    const payload = buildPayload(parsed.data);
    if (!payload.slug) return { error: 'Slug impossible à générer depuis le nom.' };

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from('collection_points').update(payload).eq('id', id);
    if (error) return { error: friendlyError(error.message) };

    revalidatePath('/admin/points-de-collecte');
    redirect('/admin/points-de-collecte');
}

export async function archiveCollectionPointAction(formData: FormData): Promise<void> {
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    const supabase = createSupabaseServerClient();
    await supabase.from('collection_points').update({ status: 'archived' }).eq('id', id);
    revalidatePath('/admin/points-de-collecte');
}

export async function restoreCollectionPointAction(formData: FormData): Promise<void> {
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    const supabase = createSupabaseServerClient();
    await supabase.from('collection_points').update({ status: 'active' }).eq('id', id);
    revalidatePath('/admin/points-de-collecte');
}

function friendlyError(raw: string): string {
    if (raw.includes('duplicate key') && raw.includes('slug')) {
        return 'Ce slug existe déjà. Choisis-en un autre.';
    }
    return raw;
}
