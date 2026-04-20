# Hublo.be

Marketplace de produits locaux belges. Source de vérité du scope MVP v0.1 : [`CLAUDE.md`](./CLAUDE.md). Vision long terme archivée dans [`ROADMAP.md`](./ROADMAP.md).

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres, Auth, Storage, Cron) · Mollie (standard) · Resend · Vitest · pnpm.

## Démarrage local

Prérequis : Node 20+, pnpm, Docker (pour Supabase local).

```bash
pnpm install
cp .env.example .env.local

# Supabase local (Postgres + Auth + Studio sur http://127.0.0.1:54323)
pnpm supabase start
# Reporter les clés affichées dans .env.local :
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=…
#   SUPABASE_SERVICE_ROLE_KEY=…

# Appliquer migrations + seed
pnpm supabase db reset

pnpm dev
# → http://localhost:3000
```

## Créer un admin en local

1. Inscrire un compte sur `/auth/register` (rôle `client` par défaut).
2. Depuis le Studio Supabase (`http://127.0.0.1:54323`), SQL Editor :
   ```sql
   update public.users set role = 'admin' where email = 'ton@email';
   ```
3. Se reconnecter → `/admin` accessible, `/client` redirige vers `/admin`.

## Scripts

```bash
pnpm dev        # Next.js en dev
pnpm build      # build prod
pnpm start      # serve build prod
pnpm test       # Vitest (calculs financiers + webhook)
pnpm lint       # ESLint
```

## Structure

```
src/
  app/              # routes (App Router)
    admin/          # protégé (middleware → role=admin)
    client/         # protégé (middleware → authentifié)
    auth/           # login, register, logout
  lib/
    pricing.ts      # fonction centrale de calcul + tests
    supabase/       # clients server / middleware + types
  middleware.ts     # protection des routes + renouvellement session
supabase/
  migrations/       # schéma SQL + RLS
  seed.sql          # platform_commission_bps = 3500
```

## Déploiement

Vercel (EU) + Supabase Cloud (EU). Voir `CLAUDE.md` pour les règles staging/prod (clés Mollie sandbox vs live, DNS SPF/DKIM/DMARC).
