-- Migration 0003 : cron auto-clôture des ventes
-- pg_cron est disponible sur Supabase Cloud (extension activable depuis le dashboard).
-- Activer manuellement depuis Supabase Dashboard → Database → Extensions → pg_cron.
-- Cette migration crée le job une fois l'extension activée.

-- Active l'extension si pas déjà fait (no-op si déjà active)
create extension if not exists pg_cron with schema extensions;

-- Accorder l'usage au service_role pour pouvoir appeler depuis des Edge Functions si besoin
grant usage on schema cron to service_role;

-- Job : toutes les 5 minutes, fermer les ventes dont closes_at est passé
select cron.schedule(
    'close-open-sales',        -- nom du job (unique)
    '*/5 * * * *',             -- cron expression : toutes les 5 min
    $$
        update public.sales
        set
            status = 'closed',
            updated_at = now()
        where
            status = 'open'
            and closes_at < now();
    $$
);
