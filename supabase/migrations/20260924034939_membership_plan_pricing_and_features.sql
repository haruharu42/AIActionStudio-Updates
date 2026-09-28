-- Admin-managed pricing and presentation for the three Creator Club plans.
-- Additive: existing plan codes/products/entitlements remain unchanged.

begin;

alter table public.creator_membership_plans
    add column if not exists monthly_price_yen integer,
    add column if not exists description text not null default '';

alter table public.creator_membership_plans
    drop constraint if exists creator_membership_plans_monthly_price_yen_check;
alter table public.creator_membership_plans
    add constraint creator_membership_plans_monthly_price_yen_check
    check (monthly_price_yen is null or monthly_price_yen between 0 and 1000000);

alter table public.creator_membership_plans
    drop constraint if exists creator_membership_plans_description_check;
alter table public.creator_membership_plans
    add constraint creator_membership_plans_description_check
    check (length(description) <= 500);

create or replace function public.admin_update_creator_membership_plan(
    p_plan_code text,
    p_display_name text,
    p_monthly_price_yen integer default null,
    p_description text default ''
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    normalized_plan text := upper(nullif(trim(p_plan_code), ''));
    normalized_name text := nullif(trim(p_display_name), '');
    normalized_description text := coalesce(trim(p_description), '');
begin
    if (select auth.uid()) is null or not (select private.is_active_admin()) then
        raise exception 'active admin required' using errcode = '42501';
    end if;

    if normalized_plan is null or not exists (
        select 1
        from public.creator_membership_plans as plan
        where plan.plan_code = normalized_plan
          and plan.status <> 'archived'
    ) then
        raise exception 'membership plan not found' using errcode = 'P0002';
    end if;

    if normalized_name is null or length(normalized_name) > 100 then
        raise exception 'invalid membership plan display name' using errcode = '22023';
    end if;

    if p_monthly_price_yen is not null and (p_monthly_price_yen < 0 or p_monthly_price_yen > 1000000) then
        raise exception 'invalid membership plan price' using errcode = '22023';
    end if;

    if length(normalized_description) > 500 then
        raise exception 'membership plan description too long' using errcode = '22023';
    end if;

    update public.creator_membership_plans as plan
    set
        display_name = normalized_name,
        monthly_price_yen = p_monthly_price_yen,
        description = normalized_description,
        updated_at = now()
    where plan.plan_code = normalized_plan;
end;
$function$;

create or replace function public.admin_list_creator_membership_plans_v2()
returns table (
    plan_code text,
    display_name text,
    tier_rank smallint,
    badge_label text,
    status text,
    monthly_price_yen integer,
    description text
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
        plan.plan_code,
        plan.display_name,
        plan.tier_rank,
        plan.badge_label,
        plan.status,
        plan.monthly_price_yen,
        plan.description
    from public.creator_membership_plans as plan
    order by plan.tier_rank, plan.sort_order, plan.plan_code;
end;
$function$;

create or replace function public.list_my_creator_membership_plans_v2()
returns table (
    plan_code text,
    display_name text,
    tier_rank integer,
    badge_label text,
    knowledge_channel text,
    knowledge_refresh_hours integer,
    article_xp_multiplier numeric,
    article_quota_bonus integer,
    template_tier text,
    benefits jsonb,
    is_current boolean,
    monthly_price_yen integer,
    description text
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    current_user_id uuid := (select auth.uid());
    current_plan_code text;
begin
    if current_user_id is null or not (select private.is_active_profile()) then
        raise exception 'active profile required' using errcode = '42501';
    end if;

    select membership.plan_code
    into current_plan_code
    from private.get_creator_membership_plan(current_user_id) as membership
    limit 1;

    return query
    select
        plan.plan_code,
        plan.display_name,
        plan.tier_rank::integer,
        plan.badge_label,
        plan.knowledge_channel,
        channel.refresh_hours,
        plan.article_xp_multiplier,
        plan.article_quota_bonus,
        plan.template_tier,
        plan.benefits,
        plan.plan_code = current_plan_code,
        plan.monthly_price_yen,
        plan.description
    from public.creator_membership_plans as plan
    join public.knowledge_refresh_channels as channel on channel.channel = plan.knowledge_channel
    where plan.status = 'active'
    order by plan.sort_order, plan.tier_rank;
end;
$function$;

revoke all on function public.admin_update_creator_membership_plan(text, text, integer, text) from public, anon;
revoke all on function public.admin_list_creator_membership_plans_v2() from public, anon;
revoke all on function public.list_my_creator_membership_plans_v2() from public, anon;

grant execute on function public.admin_update_creator_membership_plan(text, text, integer, text) to authenticated;
grant execute on function public.admin_list_creator_membership_plans_v2() to authenticated;
grant execute on function public.list_my_creator_membership_plans_v2() to authenticated;

commit;
