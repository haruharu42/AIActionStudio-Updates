begin;

create table if not exists public.article_library_quota_settings (
    id smallint primary key default 1,
    free_limit integer not null default 5,
    plan_limits_enabled boolean not null default false,
    updated_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint article_library_quota_settings_singleton_check check (id = 1),
    constraint article_library_quota_settings_free_limit_check check (free_limit between 1 and 100000)
);

insert into public.article_library_quota_settings (id, free_limit, plan_limits_enabled)
values (1, 5, false)
on conflict (id) do nothing;

alter table public.article_library_quota_settings enable row level security;
alter table public.article_library_quota_settings force row level security;
revoke all on table public.article_library_quota_settings from public, anon, authenticated;

alter table public.creator_membership_plans
    add column if not exists article_library_limit integer;

alter table public.creator_membership_plans
    drop constraint if exists creator_membership_plans_article_library_limit_check;
alter table public.creator_membership_plans
    add constraint creator_membership_plans_article_library_limit_check
    check (article_library_limit is null or article_library_limit between 1 and 100000);

update public.creator_membership_plans
set article_library_limit = case plan_code
    when 'CREATOR_CLUB' then 15
    when 'CREATOR_CLUB_PLUS' then 30
    when 'CREATOR_CLUB_PRO' then null
    else article_library_limit
end,
updated_at = now()
where plan_code in ('CREATOR_CLUB', 'CREATOR_CLUB_PLUS', 'CREATOR_CLUB_PRO');

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
    v_legacy_limit integer;
    v_legacy_bonus integer := 0;
begin
    select settings.plan_limits_enabled, settings.free_limit
    into v_enabled, v_free_limit
    from public.article_library_quota_settings as settings
    where settings.id = 1;

    if coalesce(v_enabled, false) then
        select plan.article_library_limit
        into v_plan_limit
        from private.get_creator_membership_plan(p_user_id) as membership
        join public.creator_membership_plans as plan
          on plan.plan_code = membership.plan_code
        where plan.status = 'active'
        limit 1;

        if found then
            return v_plan_limit;
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

create or replace function public.admin_get_article_library_quota_settings()
returns table (
    free_limit integer,
    plan_limits_enabled boolean,
    updated_at timestamptz
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
    select settings.free_limit, settings.plan_limits_enabled, settings.updated_at
    from public.article_library_quota_settings as settings
    where settings.id = 1;
end;
$function$;

create or replace function public.admin_update_article_library_quota_settings(
    p_free_limit integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_admin uuid := (select auth.uid());
begin
    if v_admin is null or not (select private.is_active_admin()) then
        raise exception 'active admin required' using errcode = '42501';
    end if;
    if p_free_limit is null or p_free_limit < 1 or p_free_limit > 100000 then
        raise exception 'invalid article library free limit' using errcode = '22023';
    end if;

    update public.article_library_quota_settings
    set free_limit = p_free_limit,
        updated_by = v_admin,
        updated_at = now()
    where id = 1;
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
        plan.article_library_limit,
        plan.article_library_limit is null
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

    if coalesce(p_article_library_unlimited, false) then
        normalized_limit := null;
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
        updated_at = now()
    where plan.plan_code = normalized_plan;
end;
$function$;

create or replace function public.create_article(p_article jsonb default '{}'::jsonb)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $function$
declare
    current_user_id uuid := (select auth.uid());
    current_profile_role text;
    current_profile_status text;
    article_payload jsonb := coalesce(p_article, '{}'::jsonb);
    publication_value text;
    article_type_value text;
    article_status_value text;
    article_price_value bigint;
    article_tags_value text[];
    max_articles_value integer;
    current_articles_value bigint;
    created_article public.articles%rowtype;
begin
    if current_user_id is null then
        raise exception 'active profile required' using errcode = '42501';
    end if;

    if jsonb_typeof(article_payload) <> 'object' then
        raise exception 'article payload must be an object' using errcode = '22023';
    end if;

    if exists (
        select 1
        from jsonb_object_keys(article_payload) as supplied(key)
        where not supplied.key = any (array[
            'title', 'publication_target', 'article_type', 'genre', 'subgenre',
            'body', 'status', 'price', 'tags', 'scheduled_at', 'published_at',
            'published_url'
        ])
    ) then
        raise exception 'article payload contains unsupported fields' using errcode = '22023';
    end if;

    publication_value := case lower(trim(coalesce(article_payload ->> 'publication_target', 'note')))
        when 'ブログ' then 'blog'
        else lower(trim(coalesce(article_payload ->> 'publication_target', 'note')))
    end;

    article_type_value := case lower(trim(coalesce(article_payload ->> 'article_type', 'free')))
        when '無料' then 'free'
        when '有料' then 'paid'
        else lower(trim(coalesce(article_payload ->> 'article_type', 'free')))
    end;

    article_status_value := lower(trim(coalesce(article_payload ->> 'status', 'draft')));
    article_tags_value := private.normalize_article_tags(article_payload -> 'tags');

    article_price_value := case
        when not (article_payload ? 'price')
          or article_payload -> 'price' = 'null'::jsonb
          or nullif(trim(article_payload ->> 'price'), '') is null
        then null
        else (article_payload ->> 'price')::bigint
    end;

    select profile.role, profile.status
    into current_profile_role, current_profile_status
    from public.profiles as profile
    where profile.id = current_user_id
    for update;

    if not found or current_profile_status <> 'active' then
        raise exception 'active profile required' using errcode = '42501';
    end if;

    if current_profile_role = 'user' then
        max_articles_value := (select private.get_effective_article_library_limit(current_user_id));

        if max_articles_value is not null then
            select count(*)
            into current_articles_value
            from public.articles as article
            where article.user_id = current_user_id;

            if current_articles_value >= max_articles_value then
                raise exception using
                    errcode = 'P0001',
                    message = 'article_quota_exceeded',
                    detail = format(
                        'current_articles=%s,max_articles=%s',
                        current_articles_value,
                        max_articles_value
                    );
            end if;
        end if;
    elsif current_profile_role <> 'admin' then
        raise exception 'unsupported profile role' using errcode = '42501';
    end if;

    insert into public.articles (
        user_id, title, publication_target, article_type, genre, subgenre, body,
        status, price, tags, scheduled_at, published_at, published_url
    ) values (
        current_user_id,
        coalesce(article_payload ->> 'title', ''),
        publication_value,
        article_type_value,
        nullif(trim(article_payload ->> 'genre'), ''),
        nullif(trim(article_payload ->> 'subgenre'), ''),
        coalesce(article_payload ->> 'body', ''),
        article_status_value,
        article_price_value,
        article_tags_value,
        case
            when article_payload -> 'scheduled_at' is null
              or article_payload -> 'scheduled_at' = 'null'::jsonb
              or nullif(trim(article_payload ->> 'scheduled_at'), '') is null
            then null
            else (article_payload ->> 'scheduled_at')::timestamptz
        end,
        case
            when article_payload -> 'published_at' is null
              or article_payload -> 'published_at' = 'null'::jsonb
              or nullif(trim(article_payload ->> 'published_at'), '') is null
            then null
            else (article_payload ->> 'published_at')::timestamptz
        end,
        nullif(trim(article_payload ->> 'published_url'), '')
    )
    returning * into created_article;

    return created_article;
end;
$function$;

create or replace function public.get_my_article_stock_summary()
returns table (
    current_articles bigint,
    max_articles integer,
    remaining_articles bigint,
    is_unlimited boolean,
    publication_counts jsonb,
    status_counts jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
    current_user_id uuid := (select auth.uid());
    current_profile_role text;
    current_profile_status text;
    current_count bigint;
    max_count integer;
    publication_totals jsonb;
    status_totals jsonb;
begin
    if current_user_id is null or not (
        (select public.can_access_product('AAS-WIN-BETA'))
        or (select public.can_access_product('AAS-PWA-BETA'))
    ) then
        raise exception 'cloud article entitlement required' using errcode = '42501';
    end if;

    select profile.role, profile.status
    into current_profile_role, current_profile_status
    from public.profiles as profile
    where profile.id = current_user_id;

    if not found or current_profile_status <> 'active' then
        raise exception 'active profile required' using errcode = '42501';
    end if;

    if current_profile_role not in ('user', 'admin') then
        raise exception 'unsupported profile role' using errcode = '42501';
    end if;

    select count(*)
    into current_count
    from public.articles as article
    where article.user_id = current_user_id;

    select
        jsonb_build_object('note', 0, 'tips', 0, 'brain', 0, 'blog', 0)
        || coalesce(jsonb_object_agg(counts.publication_target, counts.article_count), '{}'::jsonb)
    into publication_totals
    from (
        select article.publication_target, count(*) as article_count
        from public.articles as article
        where article.user_id = current_user_id
        group by article.publication_target
    ) as counts;

    select
        jsonb_build_object(
            'draft', 0, 'writing', 0, 'ready', 0, 'waiting_publish', 0,
            'published', 0, 'on_hold', 0, 'archived', 0
        ) || coalesce(jsonb_object_agg(counts.status, counts.article_count), '{}'::jsonb)
    into status_totals
    from (
        select article.status, count(*) as article_count
        from public.articles as article
        where article.user_id = current_user_id
        group by article.status
    ) as counts;

    if current_profile_role = 'admin' then
        return query select
            current_count, null::integer, null::bigint, true,
            publication_totals, status_totals;
        return;
    end if;

    max_count := (select private.get_effective_article_library_limit(current_user_id));

    if max_count is null then
        return query select
            current_count, null::integer, null::bigint, true,
            publication_totals, status_totals;
        return;
    end if;

    return query select
        current_count,
        max_count,
        greatest(max_count::bigint - current_count, 0::bigint),
        false,
        publication_totals,
        status_totals;
end;
$function$;

revoke all on function private.get_effective_article_library_limit(uuid) from public, anon, authenticated;
revoke all on function public.admin_get_article_library_quota_settings() from public, anon;
revoke all on function public.admin_update_article_library_quota_settings(integer) from public, anon;
revoke all on function public.admin_list_creator_membership_plans_v3() from public, anon;
revoke all on function public.admin_update_creator_membership_plan_v2(text, text, integer, text, integer, boolean) from public, anon;

grant execute on function public.admin_get_article_library_quota_settings() to authenticated;
grant execute on function public.admin_update_article_library_quota_settings(integer) to authenticated;
grant execute on function public.admin_list_creator_membership_plans_v3() to authenticated;
grant execute on function public.admin_update_creator_membership_plan_v2(text, text, integer, text, integer, boolean) to authenticated;

comment on table public.article_library_quota_settings is
'Admin-managed article library storage quotas. plan_limits_enabled remains false until the Preview-tested release is approved for general public rollout.';
comment on column public.creator_membership_plans.article_library_limit is
'Maximum saved articles for this paid plan. NULL means unlimited once plan-based article-library quotas are enabled.';

commit;
