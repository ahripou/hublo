'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export type SettingsFormState = { error: string | null; success: string | null };

const schema = z.object({
    platform_commission_percent: z
        .string()
        .regex(/^\d{1,2}(\.\d{1,2})?$/, 'Pourcentage invalide (ex : 35 ou 35.5).')
        .transform((v) => Math.round(parseFloat(v) * 100))
        .refine((bps) => bps >= 0 && bps <= 10_000, 'Entre 0 et 100%.'),
});

export async function updatePlatformCommissionAction(
    _prev: SettingsFormState,
    formData: FormData,
): Promise<SettingsFormState> {
    const parsed = schema.safeParse({
        platform_commission_percent: String(formData.get('platform_commission_percent') ?? ''),
    });
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? 'Entrée invalide.', success: null };
    }

    const bps = parsed.data.platform_commission_percent;
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
        .from('settings')
        .upsert({ key: 'platform_commission_bps', value: bps }, { onConflict: 'key' });
    if (error) {
        return { error: error.message, success: null };
    }

    revalidatePath('/admin/parametres');
    return { error: null, success: `Commission enregistrée à ${bps / 100}%.` };
}
