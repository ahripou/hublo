import Link from 'next/link';
import { register } from './actions';

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { error?: string; pending?: string };
}) {
  if (searchParams.pending) {
    return (
      <main className="mx-auto max-w-sm px-4 py-12">
        <h1 className="text-3xl font-bold">Vérifie ton email</h1>
        <p className="mt-4 text-neutral-700">
          Un lien de confirmation vient de t&apos;être envoyé. Clique dessus pour activer
          ton compte, puis reviens te connecter.
        </p>
        <Link href="/auth/login" className="mt-6 inline-block text-emerald-700 underline">
          Aller à la connexion
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-3xl font-bold">Créer un compte</h1>
      <p className="mt-2 text-neutral-600">Rejoins Hublo.be.</p>

      {searchParams.error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </p>
      )}

      <form action={register} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="first_name" className="block text-sm font-medium">
              Prénom
            </label>
            <input
              id="first_name"
              name="first_name"
              required
              autoComplete="given-name"
              className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="last_name" className="block text-sm font-medium">
              Nom
            </label>
            <input
              id="last_name"
              name="last_name"
              required
              autoComplete="family-name"
              className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-neutral-500">8 caractères minimum.</p>
        </div>

        <button
          type="submit"
          className="w-full rounded bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-700"
        >
          Créer le compte
        </button>
      </form>

      <p className="mt-6 text-sm text-neutral-600">
        Déjà un compte ?{' '}
        <Link href="/auth/login" className="text-emerald-700 underline">
          Se connecter
        </Link>
      </p>
    </main>
  );
}
