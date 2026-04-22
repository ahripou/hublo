import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type OpenSale = {
  id: string;
  distribution_date: string;
  closes_at: string;
  collection_point: { name: string; address: string; slug: string };
};

export default async function HomePage() {
  const supabase = createClient();

  const { data: openSale } = (await supabase
    .from('sales')
    .select(
      'id, distribution_date, closes_at, collection_point:collection_points!inner(name, address, slug)',
    )
    .eq('status', 'open')
    .order('distribution_date', { ascending: true })
    .limit(1)
    .maybeSingle()) as { data: OpenSale | null };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Hublo.be</h1>
          <p className="mt-3 text-lg text-neutral-600">
            Marketplace de produits locaux belges.
          </p>
        </div>
        <nav className="mt-2 flex gap-3 text-sm">
          {user ? (
            <Link
              href="/client"
              className="rounded border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100"
            >
              Mon espace
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="rounded border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100"
              >
                Connexion
              </Link>
              <Link
                href="/auth/register"
                className="rounded bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
              >
                Créer un compte
              </Link>
            </>
          )}
        </nav>
      </header>

      {openSale ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
            Vente en cours
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{openSale.collection_point.name}</h2>
          <p className="mt-1 text-neutral-700">{openSale.collection_point.address}</p>
          <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-neutral-500">Distribution</dt>
              <dd className="font-medium">
                {new Intl.DateTimeFormat('fr-BE', { dateStyle: 'full' }).format(
                  new Date(openSale.distribution_date),
                )}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Fermeture des commandes</dt>
              <dd className="font-medium">
                {new Intl.DateTimeFormat('fr-BE', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(openSale.closes_at))}
              </dd>
            </div>
          </dl>
        </section>
      ) : (
        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-6">
          <h2 className="text-xl font-semibold">Aucune vente en cours</h2>
          <p className="mt-2 text-neutral-600">
            La prochaine vente sera annoncée prochainement.
          </p>
        </section>
      )}
    </main>
  );
}
