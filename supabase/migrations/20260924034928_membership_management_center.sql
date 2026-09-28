-- Dedicated Creator Club membership management center.
-- Adds admin-editable note membership URL and plan feature matrix.
-- Existing PWA access and Creator Club entitlement assignment functions remain unchanged.

begin;

create table if not exists public.creator_membership_settings (
    id smallint primary key default 1 check (id = 1),
    display_name text not null default 'noteメンバーシップ'
        check (length(trim(display_name)) between 1 and 100),
    note_membership_url text,
    guidance text not null default ''
        check (length(guidance) <= 1000),
    updated_by uuid references public.profiles(id) on delete set null,
    updated_at timestamptz not null default now(),
    constraint creator_membership_settings_note_url_check
        check (
            note_membership_url is null
            or (
                length(note_membership_url) <= 500
                and note_membership_url ~ '^https://note\.com/'
            )
        )
);

insert into public.creator_membership_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.creator_membership_features (
    feature_key text primary key,
    display_name text not null,
    description text not null default '',
    status text not null default 'active'
        check (status in ('active', 'inactive')),
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint creator_membership_features_key_check
        check (feature_key ~ '^[a-z][a-z0-9_]{2,63}$'),
    constraint creator_membership_features_name_check
        check (length(trim(display_name)) between 1 and 100),
    constraint creator_membership_features_description_check
        check (length(description) <= 500)
);

create table if not exists public.creator_membership_plan_features (
    plan_code text not null
        references public.creator_membership_plans(plan_code) on delete cascade,
    feature_key text not null
        references public.creator_membership_features(feature_key) on delete cascade,
    enabled boolean not null default false,
    updated_by uuid references public.profiles(id) on delete set null,
    updated_at timestamptz not null default now(),
    primary key (plan_code, feature_key)
);

alter table public.creator_membership_settings enable row level security;
alter table public.creator_membership_settings force row level security;
alter table public.creator_membership_features enable row level security;
alter table public.creator_membership_features force row level security;
alter table public.creator_membership_plan_features enable row level security;
alter table public.creator_membership_plan_features force row level security;

revoke all on table public.creator_membership_settings from public, anon, authenticated;
revoke all on table public.creator_membership_features from public, anon, authenticated;
revoke all on table public.creator_membership_plan_features from public, anon, authenticated;

insert into public.creator_membership_features (
    feature_key, display_name, description, status, sort_order
)
values
    ('cloud_image_storage', 'クラウド画像保存', 'アイキャッチ・挿絵をSupabase Storageへ保存し、端末内保存に加えてクラウドでも保持できます。', 'active', 10),
    ('cross_device_image_sync', '画像の端末間同期', 'クラウド保存した記事画像をiPhone・PC・タブレット間で利用できます。', 'active', 20),
    ('fresh_knowledge', 'Freshナレッジ', 'メンバー向けの更新頻度が高いナレッジを利用できます。', 'active', 30),
    ('priority_templates', '優先テンプレート', 'メンバー向けテンプレートや制作支援を利用できます。', 'active', 40),
    ('member_missions', 'メンバー限定ミッション', 'Creator Club以上の限定ミッションを利用できます。', 'active', 50),
    ('plus_missions', 'Plus限定ミッション', 'Creator Club Plus以上の追加ミッションを利用できます。', 'active', 60),
    ('pro_missions', 'Pro限定ミッション', 'Creator Club Pro限定の追加ミッションを利用できます。', 'active', 70),
    ('article_quota_bonus', '記事作成ボーナス枠', 'メンバーシッププランに応じた記事作成ボーナス枠を利用できます。', 'active', 80)
on conflict (feature_key) do update set
    display_name = excluded.display_name,
    description = excluded.description,
    status = excluded.status,
    sort_order = excluded.sort_order,
    updated_at = now();

insert into public.creator_membership_plan_features (plan_code, feature_key, enabled)
select plan_code, feature_key, enabled
from (
    values
        ('CREATOR_CLUB', 'cloud_image_storage', true),
        ('CREATOR_CLUB', 'cross_device_image_sync', true),
        ('CREATOR_CLUB', 'fresh_knowledge', true),
        ('CREATOR_CLUB', 'priority_templates', true),
        ('CREATOR_CLUB', 'member_missions', true),
        ('CREATOR_CLUB', 'plus_missions', false),
        ('CREATOR_CLUB', 'pro_missions', false),
        ('CREATOR_CLUB', 'article_quota_bonus', true),

        ('CREATOR_CLUB_PLUS', 'cloud_image_storage', true),
        ('CREATOR_CLUB_PLUS', 'cross_device_image_sync', true),
        ('CREATOR_CLUB_PLUS', 'fresh_knowledge', true),
        ('CREATOR_CLUB_PLUS', 'priority_templates', true),
        ('CREATOR_CLUB_PLUS', 'member_missions', true),
        ('CREATOR_CLUB_PLUS', 'plus_missions', true),
        ('CREATOR_CLUB_PLUS', 'pro_missions', false),
        ('CREATOR_CLUB_PLUS', 'article_quota_bonus', true),

        ('CREATOR_CLUB_PRO', 'cloud_image_storage', true),
        ('CREATOR_CLUB_PRO', 'cross_device_image_sync', true),
        ('CREATOR_CLUB_PRO', 'fresh_knowledge', true),
        ('CREATOR_CLUB_PRO', 'priority_templates', true),
        ('CREATOR_CLUB_PRO', 'member_missions', true),
        ('CREATOR_CLUB_PRO', 'plus_missions', true),
        ('CREATOR_CLUB_PRO', 'pro_missions', true),
        ('CREATOR_CLUB_PRO', 'article_quota_bonus', true)
) as seed(plan_code, feature_key, enabled)
where exists (
    select 1
    from public.creator_membership_plans as plan
    where plan.plan_code = seed.plan_code
)
on conflict (plan_code, feature_key) do nothing;

create or replace function public.admin_get_creator_membership_settings()
returns table (
    display_name text,
    note_membership_url text,
    guidance text,
    updated_at timestamptz
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
    select settings.display_name, settings.note_membership_url, settings.guidance, settings.updated_at
    from public.creator_membership_settings as settings
    where settings.id = 1;
end;
$function$;

create or replace function public.admin_update_creator_membership_settings(
    p_display_name text,
    p_note_membership_url text default null,
    p_guidance text default ''
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    normalized_name text := nullif(trim(p_display_name), '');
    normalized_url text := nullif(trim(p_note_membership_url), '');
    normalized_guidance text := coalesce(trim(p_guidance), '');
begin
    if (select auth.uid()) is null or not (select private.is_active_admin()) then
        raise exception 'active admin required' using errcode = '42501';
    end if;
    if normalized_name is null or length(normalized_name) > 100 then
        raise exception 'invalid membership display name' using errcode = '22023';
    end if;
    if normalized_url is not null
       and (length(normalized_url) > 500 or normalized_url !~ '^https://note\.com/') then
        raise exception 'invalid note membership url' using errcode = '22023';
    end if;
    if length(normalized_guidance) > 1000 then
        raise exception 'membership guidance too long' using errcode = '22023';
    end if;

    insert into public.creator_membership_settings (
        id, display_name, note_membership_url, guidance, updated_by, updated_at
    ) values (
        1, normalized_name, normalized_url, normalized_guidance, (select auth.uid()), now()
    )
    on conflict (id) do update set
        display_name = excluded.display_name,
        note_membership_url = excluded.note_membership_url,
        guidance = excluded.guidance,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;
end;
$function$;

create or replace function public.admin_list_creator_membership_plans()
returns table (
    plan_code text,
    display_name text,
    tier_rank smallint,
    badge_label text,
    status text
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
    select plan.plan_code, plan.display_name, plan.tier_rank, plan.badge_label, plan.status
    from public.creator_membership_plans as plan
    order by plan.tier_rank, plan.plan_code;
end;
$function$;

create or replace function public.admin_list_creator_membership_features()
returns table (
    feature_key text,
    display_name text,
    description text,
    status text,
    sort_order integer
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
    select feature.feature_key, feature.display_name, feature.description, feature.status, feature.sort_order
    from public.creator_membership_features as feature
    order by feature.sort_order, feature.feature_key;
end;
$function$;

create or replace function public.admin_list_creator_membership_plan_features()
returns table (
    plan_code text,
    feature_key text,
    enabled boolean,
    updated_at timestamptz
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
    select mapping.plan_code, mapping.feature_key, mapping.enabled, mapping.updated_at
    from public.creator_membership_plan_features as mapping
    order by mapping.plan_code, mapping.feature_key;
end;
$function$;

create or replace function public.admin_set_creator_membership_plan_feature(
    p_plan_code text,
    p_feature_key text,
    p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    normalized_plan text := upper(nullif(trim(p_plan_code), ''));
    normalized_feature text := lower(nullif(trim(p_feature_key), ''));
begin
    if (select auth.uid()) is null or not (select private.is_active_admin()) then
        raise exception 'active admin required' using errcode = '42501';
    end if;

    if normalized_plan is null or not exists (
        select 1 from public.creator_membership_plans as plan
        where plan.plan_code = normalized_plan and plan.status <> 'archived'
    ) then
        raise exception 'membership plan not found' using errcode = 'P0002';
    end if;
    if normalized_feature is null or not exists (
        select 1 from public.creator_membership_features as feature
        where feature.feature_key = normalized_feature and feature.status = 'active'
    ) then
        raise exception 'membership feature not found' using errcode = 'P0002';
    end if;

    insert into public.creator_membership_plan_features (
        plan_code, feature_key, enabled, updated_by, updated_at
    ) values (
        normalized_plan, normalized_feature, coalesce(p_enabled, false), (select auth.uid()), now()
    )
    on conflict (plan_code, feature_key) do update set
        enabled = excluded.enabled,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;
end;
$function$;

create or replace function public.get_creator_membership_public_settings()
returns table (
    display_name text,
    note_membership_url text,
    guidance text
)
language sql
stable
security definer
set search_path to ''
as $function$
    select settings.display_name, settings.note_membership_url, settings.guidance
    from public.creator_membership_settings as settings
    where settings.id = 1
      and (select auth.uid()) is not null
$function$;

create or replace function public.has_creator_membership_feature(p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
    select coalesce((
        select mapping.enabled
        from private.get_creator_membership_plan((select auth.uid())) as membership
        join public.creator_membership_plan_features as mapping
          on mapping.plan_code = membership.plan_code
        join public.creator_membership_features as feature
          on feature.feature_key = mapping.feature_key
         and feature.status = 'active'
        where mapping.feature_key = lower(nullif(trim(p_feature_key), ''))
        limit 1
    ), false)
$function$;

revoke all on function public.admin_get_creator_membership_settings() from public, anon;
revoke all on function public.admin_update_creator_membership_settings(text, text, text) from public, anon;
revoke all on function public.admin_list_creator_membership_plans() from public, anon;
revoke all on function public.admin_list_creator_membership_features() from public, anon;
revoke all on function public.admin_list_creator_membership_plan_features() from public, anon;
revoke all on function public.admin_set_creator_membership_plan_feature(text, text, boolean) from public, anon;
revoke all on function public.get_creator_membership_public_settings() from public, anon;
revoke all on function public.has_creator_membership_feature(text) from public, anon;

grant execute on function public.admin_get_creator_membership_settings() to authenticated;
grant execute on function public.admin_update_creator_membership_settings(text, text, text) to authenticated;
grant execute on function public.admin_list_creator_membership_plans() to authenticated;
grant execute on function public.admin_list_creator_membership_features() to authenticated;
grant execute on function public.admin_list_creator_membership_plan_features() to authenticated;
grant execute on function public.admin_set_creator_membership_plan_feature(text, text, boolean) to authenticated;
grant execute on function public.get_creator_membership_public_settings() to authenticated;
grant execute on function public.has_creator_membership_feature(text) to authenticated;

commit;
