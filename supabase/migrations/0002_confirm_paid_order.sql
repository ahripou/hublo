-- Hublo.be — confirmation atomique d'une commande payée
--
-- Cette fonction est appelée UNIQUEMENT par le webhook Mollie (via le
-- service_role) après vérification que le paiement est 'paid' chez Mollie.
--
-- Garanties :
--   - `SELECT ... FOR UPDATE` sur la commande → empêche les double-webhooks
--     d'exécuter la logique en parallèle.
--   - `SELECT ... FOR UPDATE OF p` sur chaque produit → évite la race
--     condition sur le dernier stock entre deux commandes concurrentes.
--   - Idempotence : si la commande est déjà 'confirmed', on retourne
--     'already_confirmed' sans toucher au stock.
--   - Si stock insuffisant, on `RAISE EXCEPTION` → la transaction rollback
--     entièrement, la commande reste en 'pending_payment'. Le webhook
--     doit alors remonter l'erreur et l'admin remboursera manuellement.

set check_function_bodies = off;

create or replace function public.confirm_paid_order(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_status text;
    v_line record;
begin
    -- Lock atomique sur la commande
    select status into v_status
    from public.orders
    where id = p_order_id
    for update;

    if v_status is null then
        raise exception 'order_not_found:%', p_order_id;
    end if;

    if v_status = 'confirmed' then
        return 'already_confirmed';
    end if;

    if v_status not in ('pending_payment', 'draft') then
        return 'invalid_state:' || v_status;
    end if;

    -- Lock + vérif stock + décrément pour chaque ligne
    for v_line in
        select ol.product_id, ol.qty, p.stock_unlimited, p.stock_qty, p.name
        from public.order_lines ol
        join public.products p on p.id = ol.product_id
        where ol.order_id = p_order_id
          and ol.status = 'active'
        for update of p
    loop
        if not v_line.stock_unlimited then
            if v_line.stock_qty is null or v_line.stock_qty < v_line.qty then
                raise exception 'insufficient_stock:%:%', v_line.product_id, v_line.name;
            end if;
            update public.products
            set stock_qty = stock_qty - v_line.qty
            where id = v_line.product_id;
        end if;
    end loop;

    update public.orders
    set status = 'confirmed'
    where id = p_order_id;

    return 'ok';
end;
$$;

revoke all on function public.confirm_paid_order(uuid) from public;
grant execute on function public.confirm_paid_order(uuid) to service_role;
