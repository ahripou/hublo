import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function ClientHomePage() {
    const supabase = createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return (
        <div className="space-y-6">
            <section>
                <h1 className="text-2xl font-semibold text-gray-900">Bienvenue sur Hublo</h1>
                <p className="mt-1 text-sm text-gray-600">Connecté en tant que {user?.email}.</p>
            </section>

            <section className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-600">
                Le catalogue et le panier s&apos;afficheront ici dès qu&apos;une vente sera ouverte. (Implémenté en
                Semaine 2/3.)
            </section>
        </div>
    );
}
