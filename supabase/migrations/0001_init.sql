-- Hublo.be — MVP v0.1 initial schema
-- See CLAUDE.md for the full specification.
-- Money stored in integer cents. Commissions in basis points (3500 = 35%).

set check_function_bodies = off;

-- =====================================================================
-- USERS (1:1 with auth.users)
-- =====================================================================

create table public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    first_name text,
    last_name text,
    phone text,
    role text not null check (role in ('admin', 'client')),
    status text not null default 'active' check (status in ('active', 'suspended', 'disabled')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index users_role_idx on public.users (role);

-- Automatically create a public.users row with role='client' for new auth signups.
-- Admins must be promoted manually via the admin dashboard (or SQL for the first one).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.users (id, email, role)
    values (new.id, new.email, 'client')
    on conflict (id) do nothing;
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_auth_user();

-- =====================================================================
-- SETTINGS (key/value)
-- =====================================================================

create table public.settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz not null default now()
);

-- =====================================================================
-- PRODUCERS
-- =====================================================================

create table public.producers (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    description text,
    vat_number text,
    status text not null default 'active' check (status in ('active', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- =====================================================================
-- COLLECTION POINTS
-- =====================================================================

create table public.collection_points (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    address text not null,
    schedule jsonb,
    coordinator_user_id uuid references public.users(id),
    coordinator_commission_bps int not null default 0 check (coordinator_commission_bps >= 0 and coordinator_commission_bps <= 10000),
    status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- =====================================================================
-- PRODUCTS
-- =====================================================================

create table public.products (
    id uuid primary key default gen_random_uuid(),
    producer_id uuid not null references public.producers(id),
    collection_point_id uuid references public.collection_points(id),
    name text not null,
    slug text not null unique,
    description text not null,
    photo_url text,
    photo_alt text,
    price_ht_cents int not null check (price_ht_cents between 10 and 999900),
    vat_rate int not null check (vat_rate in (0, 6, 21)),
    stock_unlimited boolean not null default true,
    stock_qty int,
    status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint stock_coherence check (
        (stock_unlimited = true and stock_qty is null)
        or (stock_unlimited = false and stock_qty is not null and stock_qty >= 0)
    )
);

create index products_producer_id_idx on public.products (producer_id);
create index products_collection_point_id_idx on public.products (collection_point_id);
create index products_status_idx on public.products (status);

-- =====================================================================
-- SALES
-- =====================================================================

create table public.sales (
    id uuid primary key default gen_random_uuid(),
    collection_point_id uuid not null references public.collection_points(id),
    distribution_date date not null,
    distribution_start_at timestamptz,
    distribution_end_at timestamptz,
    closes_at timestamptz not null,
    status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'distributed', 'cancelled')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index sales_status_idx on public.sales (status);
create index sales_collection_point_idx on public.sales (collection_point_id);
create index sales_closes_at_idx on public.sales (closes_at) where status = 'open';

-- =====================================================================
-- ORDERS
-- =====================================================================

create table public.orders (
    id uuid primary key default gen_random_uuid(),
    client_user_id uuid not null references public.users(id),
    sale_id uuid not null references public.sales(id),
    status text not null default 'draft' check (status in ('draft', 'pending_payment', 'confirmed', 'cancelled', 'payment_failed')),
    total_ht_cents int not null default 0,
    total_tva_cents int not null default 0,
    total_ttc_cents int not null default 0,
    locked_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (client_user_id, sale_id)
);

create index orders_client_user_id_idx on public.orders (client_user_id);
create index orders_sale_id_idx on public.orders (sale_id);
create index orders_status_idx on public.orders (status);

-- =====================================================================
-- ORDER LINES (snapshots)
-- =====================================================================

create table public.order_lines (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id),
    product_id uuid not null references public.products(id),
    producer_id uuid not null references public.producers(id),
    qty int not null check (qty > 0),
    unit_price_ht_cents int not null,
    vat_rate int not null,
    platform_commission_bps int not null,
    coordinator_commission_bps int not null default 0,
    status text not null default 'active' check (status in ('active', 'cancelled')),
    created_at timestamptz not null default now()
);

create index order_lines_order_id_idx on public.order_lines (order_id);
create index order_lines_product_id_idx on public.order_lines (product_id);
create index order_lines_producer_id_idx on public.order_lines (producer_id);

-- =====================================================================
-- CART ITEMS (persistent DB cart)
-- =====================================================================

create table public.cart_items (
    id uuid primary key default gen_random_uuid(),
    client_user_id uuid not null references public.users(id) on delete cascade,
    sale_id uuid not null references public.sales(id),
    product_id uuid not null references public.products(id),
    qty int not null check (qty > 0),
    updated_at timestamptz not null default now(),
    unique (client_user_id, product_id)
);

create index cart_items_client_user_id_idx on public.cart_items (client_user_id);

-- =====================================================================
-- PAYMENTS
-- =====================================================================

create table public.payments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id),
    provider text not null default 'mollie',
    provider_payment_id text not null,
    amount_cents int not null,
    status text not null check (status in ('created', 'pending', 'paid', 'failed', 'cancelled', 'refunded')),
    payload jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (provider, provider_payment_id)
);

create index payments_order_id_idx on public.payments (order_id);

-- =====================================================================
-- PAYMENT WEBHOOK EVENTS (idempotency)
-- =====================================================================

create table public.payment_webhook_events (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    provider_event_id text,
    provider_payment_id text not null,
    payload jsonb not null,
    processed boolean not null default false,
    processed_at timestamptz,
    created_at timestamptz not null default now(),
    unique (provider, provider_payment_id, provider_event_id)
);

-- =====================================================================
-- updated_at triggers
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger users_set_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger settings_set_updated_at before update on public.settings for each row execute function public.set_updated_at();
create trigger producers_set_updated_at before update on public.producers for each row execute function public.set_updated_at();
create trigger collection_points_set_updated_at before update on public.collection_points for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger sales_set_updated_at before update on public.sales for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger cart_items_set_updated_at before update on public.cart_items for each row execute function public.set_updated_at();

-- =====================================================================
-- RLS helpers
-- =====================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
    select exists (
        select 1 from public.users
        where id = auth.uid() and role = 'admin' and status = 'active'
    );
$$;

-- =====================================================================
-- RLS policies
-- =====================================================================

alter table public.users enable row level security;
alter table public.settings enable row level security;
alter table public.producers enable row level security;
alter table public.collection_points enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.cart_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;

-- USERS : admin sees all, each user sees own row
create policy users_admin_all on public.users for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
create policy users_select_self on public.users for select to authenticated
    using (id = auth.uid());
create policy users_update_self on public.users for update to authenticated
    using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.users where id = auth.uid()));

-- SETTINGS : admin read/write, public read
create policy settings_admin_all on public.settings for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
create policy settings_public_read on public.settings for select to anon, authenticated
    using (true);

-- PRODUCERS : admin all, public read active
create policy producers_admin_all on public.producers for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
create policy producers_public_read on public.producers for select to anon, authenticated
    using (status = 'active');

-- COLLECTION POINTS : admin all, public read active
create policy collection_points_admin_all on public.collection_points for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
create policy collection_points_public_read on public.collection_points for select to anon, authenticated
    using (status = 'active');

-- PRODUCTS : admin all, public read active
create policy products_admin_all on public.products for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
create policy products_public_read on public.products for select to anon, authenticated
    using (status = 'active');

-- SALES : admin all, public read open/closed/distributed
create policy sales_admin_all on public.sales for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
create policy sales_public_read on public.sales for select to anon, authenticated
    using (status in ('open', 'closed', 'distributed'));

-- ORDERS : admin all, client sees own
create policy orders_admin_all on public.orders for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
create policy orders_client_select_own on public.orders for select to authenticated
    using (client_user_id = auth.uid());
create policy orders_client_insert_own on public.orders for insert to authenticated
    with check (client_user_id = auth.uid());
create policy orders_client_update_own on public.orders for update to authenticated
    using (client_user_id = auth.uid() and locked_at is null)
    with check (client_user_id = auth.uid());

-- ORDER LINES : admin all, client sees lines of own orders
create policy order_lines_admin_all on public.order_lines for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
create policy order_lines_client_select_own on public.order_lines for select to authenticated
    using (order_id in (select id from public.orders where client_user_id = auth.uid()));

-- CART ITEMS : admin all, client own only
create policy cart_items_admin_all on public.cart_items for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
create policy cart_items_client_own on public.cart_items for all to authenticated
    using (client_user_id = auth.uid()) with check (client_user_id = auth.uid());

-- PAYMENTS : admin only (writes go through service_role server-side anyway)
create policy payments_admin_all on public.payments for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
create policy payments_client_select_own on public.payments for select to authenticated
    using (order_id in (select id from public.orders where client_user_id = auth.uid()));

-- PAYMENT WEBHOOK EVENTS : admin read only, service_role writes bypass RLS
create policy payment_webhook_events_admin_read on public.payment_webhook_events for select to authenticated
    using (public.is_admin());
