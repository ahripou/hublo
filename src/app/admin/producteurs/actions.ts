'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { slugify } from '@/lib/slug';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type ProducerFormState = { error: string | null };

const schema = z.object({
    name: z.string().trim().min(2, 'Nom trop court.').max(120, 'Nom trop long.'),
    slug: z
        .string()
        .trim()
        .transform((v) => (v.length > 0 ? v : undefined))
        .optional(),
    description: z
        .string()
        .trim()
        .transform((v) => (v.length > 0 ? v : null))
        .nullable()
        .optional(),
    vat_number: z
        .string()
        .trim()
        .transform((v) => (v.length > 0 ? v : null))
        .nullable()
        .optional(),
});

function parseInput(formData: FormData) {
    return schema.safeParse({
        name: String(formData.get('name') ?? ''),
        slug: String(formData.get('slug') ?? ''),
        description: String(formData.get('description') ?? ''),
        vat_number: String(formData.get('vat_number') ?? ''),
    });
}

export async function createProducerAction(
    _prev: ProducerFormState,
    formData: FormData,
): Promise<ProducerFormState> {
    const parsed = parseInput(formData);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? 'Entrée invalide.' };
    }

    const payload = {
        name: parsed.data.name,
        slug: parsed.data.slug ?? slugify(parsed.data.name),
        description: parsed.data.description ?? null,
        vat_number: parsed.data.vat_number ?? null,
    };
    if (!payload.slug) {
        return { error: 'Slug impossible à générer depuis le nom.' };
    }

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from('producers').insert(payload);
    if (error) {
        return { error: humanisePostgresError(error.message, 'slug') };
    }

    revalidatePath('/admin/producteurs');
    redirect('/admin/producteurs');
}

export async function updateProducerAction(
    id: string,
    _prev: ProducerFormState,
    formData: FormData,
): Promise<ProducerFormState> {
    const parsed = parseInput(formData);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? 'Entrée invalide.' };
    }
    const payload = {
        name: parsed.data.name,
        slug: parsed.data.slug ?? slugify(parsed.data.name),
        description: parsed.data.description ?? null,
        vat_number: parsed.data.vat_number ?? null,
    };
    if (!payload.slug) {
        return { error: 'Slug impossible à générer depuis le nom.' };
    }

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from('producers').update(payload).eq('id', id);
    if (error) {
        return { error: humanisePostgresError(error.message, 'slug') };
    }

    revalidatePath('/admin/producteurs');
    redirect('/admin/producteurs');
}

export async function archiveProducerAction(formData: FormData): Promise<void> {
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    const supabase = createSupabaseServerClient();
    await supabase.from('producers').update({ status: 'archived' }).eq('id', id);
    revalidatePath('/admin/producteurs');
}

export async function restoreProducerAction(formData: FormData): Promise<void> {
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    const supabase = createSupabaseServerClient();
    await supabase.from('producers').update({ status: 'active' }).eq('id', id);
    revalidatePath('/admin/producteurs');
}

function humanisePostgresError(raw: string, slugField: string): string {
    if (raw.includes('duplicate key') && raw.includes(slugField)) {
        return 'Ce slug existe déjà. Choisis-en un autre.';
    }
    return raw;
}
