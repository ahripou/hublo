export const dynamic = 'force-dynamic';

function thisMonthRange(): { from: string; to: string } {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { from, to };
}

export default function ExportsPage() {
    const { from, to } = thisMonthRange();

    return (
        <div className="space-y-6 max-w-xl">
            <header>
                <h1 className="text-2xl font-semibold text-gray-900">Export CSV — Odoo</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Génère un fichier CSV des ventes confirmées pour import Odoo.
                </p>
            </header>

            <form
                method="get"
                action="/admin/exports/ventes"
                className="space-y-4 bg-white rounded-lg border border-gray-200 p-6"
            >
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label
                            htmlFor="from"
                            className="block text-sm font-medium text-gray-700 mb-1"
                        >
                            Date de distribution — du
                        </label>
                        <input
                            id="from"
                            type="date"
                            name="from"
                            defaultValue={from}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="to"
                            className="block text-sm font-medium text-gray-700 mb-1"
                        >
                            au
                        </label>
                        <input
                            id="to"
                            type="date"
                            name="to"
                            defaultValue={to}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                    Télécharger le CSV
                </button>
            </form>

            <div className="rounded-md bg-gray-50 border border-gray-200 p-4 text-xs text-gray-600">
                <p className="font-medium text-gray-700 mb-1">Colonnes exportées :</p>
                <p>
                    date_distribution · client_email · client_nom · producteur · produit · qty ·
                    prix_ht_producteur_cts · tva_pct · prix_ht_client_cts · prix_ttc_client_cts ·
                    commission_plateforme_cts · commission_coordinateur_cts
                </p>
                <p className="mt-2">
                    Seules les commandes <strong>confirmées</strong> et les lignes{' '}
                    <strong>actives</strong> sont incluses. Filtre sur la date de distribution.
                </p>
            </div>
        </div>
    );
}
