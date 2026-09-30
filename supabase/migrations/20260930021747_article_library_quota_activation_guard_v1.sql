create or replace function public.admin_get_article_library_quota_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_free_limit integer := 5;
  v_enabled boolean := false;
  v_active_expected_plans integer := 0;
  v_plan_config_ready boolean := false;
  v_active_general_users integer := 0;
  v_users_over_future_limit integer := 0;
  v_max_current_articles integer := 0;
  v_max_overage integer := 0;
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  select s.free_limit, s.plan_limits_enabled
    into v_free_limit, v_enabled
  from public.article_library_quota_settings s
  where s.id = 1;

  if not found then
    raise exception 'article library quota settings missing' using errcode = '55000';
  end if;

  select count(*)::integer
    into v_active_expected_plans
  from public.creator_membership_plans p
  where p.plan_code in ('CREATOR_CLUB','CREATOR_CLUB_PLUS','CREATOR_CLUB_PRO')
    and p.status = 'active';

  v_plan_config_ready :=
    exists (
      select 1 from public.creator_membership_plans p
      where p.plan_code='CREATOR_CLUB'
        and p.status='active'
        and not p.article_library_unlimited
        and p.article_library_limit between 1 and 100000
    )
    and exists (
      select 1 from public.creator_membership_plans p
      where p.plan_code='CREATOR_CLUB_PLUS'
        and p.status='active'
        and not p.article_library_unlimited
        and p.article_library_limit between 1 and 100000
    )
    and exists (
      select 1 from public.creator_membership_plans p
      where p.plan_code='CREATOR_CLUB_PRO'
        and p.status='active'
        and p.article_library_unlimited
    );

  with general_users as (
    select p.id
    from public.profiles p
    where p.status='active' and p.role='user'
  ),
  article_counts as (
    select u.id, count(a.id)::integer as article_count
    from general_users u
    left join public.articles a on a.user_id=u.id
    group by u.id
  ),
  future_limits as (
    select
      u.id,
      case
        when coalesce(mp.article_library_unlimited,false) then null
        else coalesce(mp.article_library_limit,v_free_limit)
      end as future_limit
    from general_users u
    left join lateral private.get_creator_membership_plan(u.id) membership on true
    left join public.creator_membership_plans mp
      on mp.plan_code=membership.plan_code and mp.status='active'
  )
  select
    count(*)::integer,
    count(*) filter (
      where f.future_limit is not null and a.article_count > f.future_limit
    )::integer,
    coalesce(max(a.article_count),0)::integer,
    coalesce(max(
      case
        when f.future_limit is null then 0
        else greatest(a.article_count-f.future_limit,0)
      end
    ),0)::integer
  into
    v_active_general_users,
    v_users_over_future_limit,
    v_max_current_articles,
    v_max_overage
  from article_counts a
  join future_limits f on f.id=a.id;

  return jsonb_build_object(
    'plan_limits_enabled', v_enabled,
    'free_limit', v_free_limit,
    'active_expected_plans', v_active_expected_plans,
    'plan_config_ready', v_plan_config_ready,
    'active_general_users', v_active_general_users,
    'users_over_future_limit', v_users_over_future_limit,
    'max_current_articles', v_max_current_articles,
    'max_overage', v_max_overage,
    'automated_checks_pass',
      v_free_limit between 1 and 100000
      and v_active_expected_plans = 3
      and v_plan_config_ready
      and v_users_over_future_limit = 0
  );
end;
$function$;

create or replace function public.admin_set_article_library_plan_limits_enabled(
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_aal text := coalesce((select auth.jwt()->>'aal'),'aal1');
  v_readiness jsonb;
begin
  if v_admin is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  if p_enabled is null then
    raise exception 'enabled value is required' using errcode = '22023';
  end if;

  perform 1
  from public.article_library_quota_settings s
  where s.id=1
  for update;

  if not found then
    raise exception 'article library quota settings missing' using errcode = '55000';
  end if;

  if p_enabled then
    if v_aal <> 'aal2' then
      raise exception 'aal2 required for article library quota activation' using errcode = '42501';
    end if;

    lock table public.articles in share mode;
    lock table public.creator_membership_plans in share mode;
    lock table public.user_entitlements in share mode;

    v_readiness := public.admin_get_article_library_quota_readiness();
    if coalesce((v_readiness->>'automated_checks_pass')::boolean,false) is not true then
      raise exception 'article library quota readiness requirements not met' using errcode = '55000';
    end if;
  end if;

  update public.article_library_quota_settings
  set plan_limits_enabled=p_enabled,
      updated_by=v_admin,
      updated_at=now()
  where id=1;

  return public.admin_get_article_library_quota_readiness();
end;
$function$;

revoke all on function public.admin_get_article_library_quota_readiness() from public, anon, authenticated;
revoke all on function public.admin_set_article_library_plan_limits_enabled(boolean) from public, anon, authenticated;
grant execute on function public.admin_get_article_library_quota_readiness() to authenticated;
grant execute on function public.admin_set_article_library_plan_limits_enabled(boolean) to authenticated;

comment on function public.admin_get_article_library_quota_readiness() is
'Admin-only aggregate readiness check for activating plan-based article-library storage quotas. Returns no per-user identifiers.';

comment on function public.admin_set_article_library_plan_limits_enabled(boolean) is
'Active admins may always disable plan-based article-library quotas. Enabling requires AAL2 and a passing aggregate readiness check with no active general user above the future limit.';
