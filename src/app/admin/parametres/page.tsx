import { createSupabaseServerClient } from '@/lib/supabase/server';

import { PlatformCommissionForm } from './PlatformCommissionForm';

export const dynamic = 'force-dynamic';

export default async function ParametresPage() {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'platform_commission_bps')
        .maybeSingle<{ value: number }>();

    const bps = typeof data?.value === 'number' ? data.value : 3500;
    const currentPercent = (bps / 100).toString();

    return (
        <div className="max-w-xl space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-gray-900">Paramètres</h1>
                <p className="mt-1 text-sm text-gray-600">
                    Configuration globale de la plateforme.
                </p>
            </header>
            <section className="rounded-lg border border-gray-200 bg-white p-6">
                <PlatformCommissionForm currentPercent={currentPercent} />
            </section>
        </div>
    );
}
