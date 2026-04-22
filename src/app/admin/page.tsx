import { createClient } from '@/lib/supabase/server';
import { logout } from '../auth/logout/actions';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold">Admin</h1>
      <p className="mt-2 text-neutral-600">
        Connecté en tant que <code>{user!.email}</code>.
      </p>

      <div className="mt-6 rounded border border-neutral-200 bg-neutral-50 p-4 text-sm">
        <p>
          Le back-office (CRUD producteurs, produits, points de collecte, ventes, reversements,
          export CSV) arrive dans les prochains sprints.
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
