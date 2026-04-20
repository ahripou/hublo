import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function AdminHomePage() {
    const supabase = createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return (
        <div className="space-y-6">
            <section>
                <h1 className="text-2xl font-semibold text-gray-900">Tableau de bord</h1>
                <p className="mt-1 text-sm text-gray-600">Connecté en tant que {user?.email}.</p>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                    { title: 'Producteurs', desc: 'Gérer les producteurs' },
                    { title: 'Produits', desc: 'Catalogue et stocks' },
                    { title: 'Points de collecte', desc: 'Adresses et horaires' },
                    { title: 'Ventes', desc: 'Créer / clôturer / annuler' },
                    { title: 'Commandes', desc: 'Par vente, reversements' },
                    { title: 'Paramètres', desc: 'Commission plateforme' },
                ].map((card) => (
                    <div
                        key={card.title}
                        className="rounded-lg border border-gray-200 bg-white p-4"
                    >
                        <h2 className="font-medium text-gray-900">{card.title}</h2>
                        <p className="mt-1 text-sm text-gray-600">{card.desc}</p>
                        <p className="mt-3 text-xs text-gray-400">À implémenter en Semaine 2.</p>
                    </div>
                ))}
            </section>
        </div>
    );
}
