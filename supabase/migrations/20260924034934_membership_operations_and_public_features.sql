-- Membership management operations and user-facing feature catalog.
-- Additive follow-up to 20260923072000_membership_management_center.sql.

begin;

create table if not exists public.creator_membership_admin_actions (
    id bigint generated always as identity primary key,
    actor_user_id uuid references public.profiles(id) on delete set null,
    target_user_id uuid not null references public.profiles(id) on delete cascade,
    product_code text not null,
    action text not null check (action in ('grant', 'update', 'revoke')),
    old_status text,
    new_status text,
    expires_at timestamptz,
    created_at timestamptz not null default now()
);

alter table public.creator_membership_admin_actions enable row level security;
alter table public.creator_membership_admin_actions force row level security;

revoke all on table public.creator_membership_admin_actions from public, anon, authenticated;
revoke all on sequence public.creator_membership_admin_actions_id_seq from public, anon, authenticated;

create index if not exists creator_membership_admin_actions_created_idx
    on public.creator_membership_admin_actions (created_at desc);
create index if not exists creator_membership_admin_actions_target_idx
    on public.creator_membership_admin_actions (target_user_id, created_at desc);

create or replace function private.audit_creator_membership_entitlement_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    resolved_product_code text;
    action_name text;
begin
    select product.product_code
    into resolved_product_code
    from public.products as product
    join public.creator_membership_plans as plan
      on plan.product_code = product.product_code
    where product.id = new.product_id
    limit 1;

    if resolved_product_code is null then
        return new;
    end if;

    if tg_op = 'INSERT' then
        action_name := 'grant';
    elsif old.status is distinct from new.status
       or old.expires_at is distinct from new.expires_at
       or old.sales_channel is distinct from new.sales_channel
       or old.external_reference is distinct from new.external_reference then
        action_name := case
            when new.status = 'revoked' then 'revoke'
            else 'update'
        end;
    else
        return new;
    end if;

    insert into public.creator_membership_admin_actions (
        actor_user_id,
        target_user_id,
        product_code,
        action,
        old_status,
        new_status,
        expires_at
    ) values (
        (select auth.uid()),
        new.user_id,
        resolved_product_code,
        action_name,
        case when tg_op = 'UPDATE' then old.status else null end,
        new.status,
        new.expires_at
    );

    return new;
end;
$function$;

revoke all on function private.audit_creator_membership_entitlement_change() from public, anon, authenticated;

drop trigger if exists audit_creator_membership_entitlement_change on public.user_entitlements;
create trigger audit_creator_membership_entitlement_change
after insert or update on public.user_entitlements
for each row execute function private.audit_creator_membership_entitlement_change();

create or replace function public.admin_list_creator_membership_assignments()
returns table (
    user_id uuid,
    aas_user_id text,
    display_name text,
    plan_code text,
    plan_name text,
    product_code text,
    granted_at timestamptz,
    expires_at timestamptz,
    sales_channel text,
    external_reference text
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
    if (select auth.uid()) is null or not (select private.is_active_admin()) then
        raise exception 'active admin required' using errcode = '42501';
    end if;

    return query
    select
        profile.id,
        profile.aas_user_id,
        profile.display_name,
        plan.plan_code,
        plan.display_name,
        product.product_code,
        entitlement.granted_at,
        entitlement.expires_at,
        entitlement.sales_channel,
        entitlement.external_reference
    from public.user_entitlements as entitlement
    join public.products as product on product.id = entitlement.product_id
    join public.creator_membership_plans as plan on plan.product_code = product.product_code
    join public.profiles as profile on profile.id = entitlement.user_id
    where entitlement.status = 'active'
      and (entitlement.expires_at is null or entitlement.expires_at > now())
      and profile.role = 'user'
    order by
        case when entitlement.expires_at is null then 1 else 0 end,
        entitlement.expires_at asc nulls last,
        entitlement.granted_at desc;
end;
$function$;

create or replace function public.admin_list_creator_membership_actions(p_limit integer default 50)
returns table (
    id bigint,
    actor_user_id uuid,
    target_user_id uuid,
    target_aas_user_id text,
    target_display_name text,
    product_code text,
    action text,
    old_status text,
    new_status text,
    expires_at timestamptz,
    created_at timestamptz
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    safe_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
begin
    if (select auth.uid()) is null or not (select private.is_active_admin()) then
        raise exception 'active admin required' using errcode = '42501';
    end if;

    return query
    select
        log.id,
        log.actor_user_id,
        log.target_user_id,
        profile.aas_user_id,
        profile.display_name,
        log.product_code,
        log.action,
        log.old_status,
        log.new_status,
        log.expires_at,
        log.created_at
    from public.creator_membership_admin_actions as log
    join public.profiles as profile on profile.id = log.target_user_id
    order by log.created_at desc, log.id desc
    limit safe_limit;
end;
$function$;

create or replace function public.list_creator_membership_feature_matrix()
returns table (
    plan_code text,
    plan_name text,
    tier_rank smallint,
    feature_key text,
    feature_name text,
    feature_description text,
    enabled boolean
)
language sql
stable
security definer
set search_path to ''
as $function$
    select
        plan.plan_code,
        plan.display_name,
        plan.tier_rank,
        feature.feature_key,
        feature.display_name,
        feature.description,
        mapping.enabled
    from public.creator_membership_plans as plan
    join public.creator_membership_plan_features as mapping
      on mapping.plan_code = plan.plan_code
    join public.creator_membership_features as feature
      on feature.feature_key = mapping.feature_key
    where (select auth.uid()) is not null
      and plan.status = 'active'
      and feature.status = 'active'
    order by plan.tier_rank, feature.sort_order, feature.feature_key
$function$;

revoke all on function public.admin_list_creator_membership_assignments() from public, anon;
revoke all on function public.admin_list_creator_membership_actions(integer) from public, anon;
revoke all on function public.list_creator_membership_feature_matrix() from public, anon;

grant execute on function public.admin_list_creator_membership_assignments() to authenticated;
grant execute on function public.admin_list_creator_membership_actions(integer) to authenticated;
grant execute on function public.list_creator_membership_feature_matrix() to authenticated;

commit;
