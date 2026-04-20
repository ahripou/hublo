-- Hublo.be — seed initial data for local/staging
-- Production should run this only on first deploy.

insert into public.settings (key, value) values
    ('platform_commission_bps', '3500'::jsonb)
on conflict (key) do nothing;
