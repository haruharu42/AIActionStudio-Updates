-- Admin-only per-tester Notification Center readiness.
-- Returns only non-secret account labels and aggregate device state.
-- Push endpoints, P-256 keys and auth keys are intentionally never exposed.

create or replace function public.admin_list_notification_tester_readiness()
returns table (
  aas_user_id text,
  display_name text,
  push_enabled boolean,
  enabled_device_count integer,
  healthy_device_count integer,
  error_device_count integer,
  latest_device_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $function$
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;

  return query
  select
    p.aas_user_id,
    p.display_name,
    coalesce(pref.push_enabled,false),
    count(s.id) filter(where s.enabled=true)::integer,
    count(s.id) filter(
      where s.enabled=true
        and coalesce(s.last_error,'')=''
    )::integer,
    count(s.id) filter(
      where s.enabled=true
        and coalesce(s.last_error,'')<>''
    )::integer,
    max(s.updated_at)
  from public.app_release_testers t
  join public.profiles p
    on p.id=t.user_id
  left join public.user_notification_preferences pref
    on pref.user_id=t.user_id
  left join public.user_push_subscriptions s
    on s.user_id=t.user_id
  where t.enabled=true
    and p.status='active'
    and p.role <> 'admin'
  group by
    p.aas_user_id,
    p.display_name,
    pref.push_enabled
  order by p.aas_user_id;
end;
$function$;

revoke all on function public.admin_list_notification_tester_readiness()
  from public,anon,authenticated;
grant execute on function public.admin_list_notification_tester_readiness()
  to authenticated;

comment on function public.admin_list_notification_tester_readiness() is
'Admin-only tester Push readiness. Exposes account labels and aggregate device counts only; never exposes Push endpoints or key material.';
