import Link from 'next/link';

export default function HomePage() {
    return (
        <main className="min-h-screen flex flex-col">
            <header className="border-b border-gray-200">
                <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
                    <Link href="/" className="text-xl font-semibold text-[var(--accent)]">
                        Hublo.be
                    </Link>
                    <nav className="flex items-center gap-3">
                        <Link href="/auth/login" className="text-sm font-medium text-gray-700 hover:text-gray-900">
                            Connexion
                        </Link>
                        <Link href="/auth/register" className="btn-primary">
                            S&apos;inscrire
                        </Link>
                    </nav>
                </div>
            </header>

            <section className="flex-1 mx-auto max-w-5xl px-4 py-12">
                <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900">
                    Des produits locaux, directement chez votre producteur.
                </h1>
                <p className="mt-4 text-gray-700 max-w-2xl">
                    Hublo met en lien les producteurs belges et les consommateurs via un point de collecte près de
                    chez vous. Commandez en ligne, récupérez sur place.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                    <Link href="/auth/register" className="btn-primary">
                        Créer un compte
                    </Link>
                    <Link href="/auth/login" className="btn-secondary">
                        J&apos;ai déjà un compte
                    </Link>
                </div>

                <div className="mt-12 rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-600">
                    Le catalogue et les ventes en cours s&apos;afficheront ici dès que l&apos;admin aura publié une
                    vente.
                </div>
            </section>

            <footer className="border-t border-gray-200">
                <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-gray-500">
                    © {new Date().getFullYear()} Hublo.be
                </div>
            </footer>
        </main>
    );
}
