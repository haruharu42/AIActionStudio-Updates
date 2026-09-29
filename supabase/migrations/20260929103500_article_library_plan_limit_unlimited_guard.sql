begin;

alter table public.creator_membership_plans
    add column if not exists article_library_unlimited boolean not null default false;

update public.creator_membership_plans
set
    article_library_unlimited = (plan_code = 'CREATOR_CLUB_PRO'),
    article_library_limit = case
        when article_library_limit is null then
            case
                when plan_code = 'CREATOR_CLUB_PRO' then 100000
                else 5
            end
        else article_library_limit
    end,
    updated_at = now()
where article_library_limit is null
   or plan_code in ('CREATOR_CLUB', 'CREATOR_CLUB_PLUS', 'CREATOR_CLUB_PRO');

alter table public.creator_membership_plans
    alter column article_library_limit set default 5;
alter table public.creator_membership_plans
    alter column article_library_limit set not null;

alter table public.creator_membership_plans
    drop constraint if exists creator_membership_plans_article_library_limit_check;
alter table public.creator_membership_plans
    add constraint creator_membership_plans_article_library_limit_check
    check (article_library_limit between 1 and 100000);

create or replace function private.get_effective_article_library_limit(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
    v_enabled boolean := false;
    v_free_limit integer := 5;
    v_plan_limit integer;
    v_plan_unlimited boolean := false;
    v_legacy_limit integer;
    v_legacy_bonus integer := 0;
begin
    select settings.plan_limits_enabled, settings.free_limit
    into v_enabled, v_free_limit
    from public.article_library_quota_settings as settings
    where settings.id = 1;

    if coalesce(v_enabled, false) then
        select plan.article_library_limit, plan.article_library_unlimited
        into v_plan_limit, v_plan_unlimited
        from private.get_creator_membership_plan(p_user_id) as membership
        join public.creator_membership_plans as plan
          on plan.plan_code = membership.plan_code
        where plan.status = 'active'
        limit 1;

        if found then
            if coalesce(v_plan_unlimited, false) then
                return null;
            end if;
            return greatest(coalesce(v_plan_limit, 5), 1);
        end if;

        return greatest(coalesce(v_free_limit, 5), 1);
    end if;

    select quota.default_max_articles
    into v_legacy_limit
    from public.article_quota_settings as quota
    where quota.setting_key = 'default';

    if v_legacy_limit is null then
        raise exception using
            errcode = 'P0001',
            message = 'article_quota_configuration_missing';
    end if;

    v_legacy_bonus := (select private.creator_article_quota_bonus(p_user_id));
    return v_legacy_limit + greatest(coalesce(v_legacy_bonus, 0), 0);
end;
$function$;

create or replace function public.admin_list_creator_membership_plans_v3()
returns table (
    plan_code text,
    display_name text,
    tier_rank smallint,
    badge_label text,
    status text,
    monthly_price_yen integer,
    description text,
    article_library_limit integer,
    article_library_unlimited boolean
)
language plpgsql
stable
security definer
set search_path = ''
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
        plan.description,
        case when plan.article_library_unlimited then null else plan.article_library_limit end,
        plan.article_library_unlimited
    from public.creator_membership_plans as plan
    order by plan.tier_rank, plan.sort_order, plan.plan_code;
end;
$function$;

create or replace function public.admin_update_creator_membership_plan_v2(
    p_plan_code text,
    p_display_name text,
    p_monthly_price_yen integer default null,
    p_description text default '',
    p_article_library_limit integer default null,
    p_article_library_unlimited boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
    normalized_plan text := upper(nullif(trim(p_plan_code), ''));
    normalized_name text := nullif(trim(p_display_name), '');
    normalized_description text := coalesce(trim(p_description), '');
    normalized_limit integer;
    normalized_unlimited boolean := coalesce(p_article_library_unlimited, false);
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

    if normalized_unlimited then
        normalized_limit := coalesce(p_article_library_limit, 100000);
    else
        if p_article_library_limit is null or p_article_library_limit < 1 or p_article_library_limit > 100000 then
            raise exception 'invalid article library plan limit' using errcode = '22023';
        end if;
        normalized_limit := p_article_library_limit;
    end if;

    update public.creator_membership_plans as plan
    set
        display_name = normalized_name,
        monthly_price_yen = p_monthly_price_yen,
        description = normalized_description,
        article_library_limit = normalized_limit,
        article_library_unlimited = normalized_unlimited,
        updated_at = now()
    where plan.plan_code = normalized_plan;
end;
$function$;

revoke all on function private.get_effective_article_library_limit(uuid) from public, anon, authenticated;
revoke all on function public.admin_list_creator_membership_plans_v3() from public, anon;
revoke all on function public.admin_update_creator_membership_plan_v2(text, text, integer, text, integer, boolean) from public, anon;

grant execute on function public.admin_list_creator_membership_plans_v3() to authenticated;
grant execute on function public.admin_update_creator_membership_plan_v2(text, text, integer, text, integer, boolean) to authenticated;

comment on column public.creator_membership_plans.article_library_unlimited is
'Explicit unlimited-storage flag. Keeps future plans finite by default instead of treating a missing numeric limit as unlimited.';

commit;
