import Link from 'next/link';
import { login } from './actions';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; redirect?: string };
}) {
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-3xl font-bold">Connexion</h1>
      <p className="mt-2 text-neutral-600">Accède à ton compte Hublo.be.</p>

      {searchParams.error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </p>
      )}

      <form action={login} className="mt-6 space-y-4">
        <input type="hidden" name="redirect" value={searchParams.redirect ?? ''} />

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
            autoComplete="current-password"
            className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-700"
        >
          Se connecter
        </button>
      </form>

      <p className="mt-6 text-sm text-neutral-600">
        Pas encore de compte ?{' '}
        <Link href="/auth/register" className="text-emerald-700 underline">
          Créer un compte
        </Link>
      </p>
    </main>
  );
}
