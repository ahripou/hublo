import { createClient } from '@/lib/supabase/server';
import { logout } from '../auth/logout/actions';

export const dynamic = 'force-dynamic';

export default async function ClientDashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Le middleware garantit user != null ici.
  const { data: profile } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user!.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold">Espace client</h1>
      <p className="mt-2 text-neutral-600">
        Bonjour {profile?.first_name ?? user!.email}. Rôle : <code>{profile?.role}</code>.
      </p>

      <div className="mt-6 rounded border border-neutral-200 bg-neutral-50 p-4 text-sm">
        <p>
          Cet espace affichera bientôt : historique des commandes, panier persistant,
          détails de la prochaine distribution.
        </p>
      </div>

      <form action={logout} className="mt-8">
        <button
          type="submit"
          className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
        >
          Se déconnecter
        </button>
      </form>
    </main>
  );
}
