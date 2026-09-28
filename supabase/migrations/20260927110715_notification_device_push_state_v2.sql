-- Keep Web Push enablement device-scoped while preserving a user-level aggregate.
-- push_enabled is derived from whether at least one enabled subscription remains.

create or replace function public.update_my_notification_preferences(
  p_in_app_enabled boolean,
  p_push_enabled boolean,
  p_updates_enabled boolean,
  p_maintenance_enabled boolean,
  p_knowledge_enabled boolean,
  p_admin_messages_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_push_enabled boolean;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.status='active') then
    raise exception 'active user required' using errcode='42501';
  end if;

  select exists(
    select 1
    from public.user_push_subscriptions s
    where s.user_id=v_user and s.enabled=true
  ) into v_push_enabled;

  insert into public.user_notification_preferences(
    user_id,in_app_enabled,push_enabled,updates_enabled,maintenance_enabled,knowledge_enabled,admin_messages_enabled,updated_at
  )
  values(
    v_user,coalesce(p_in_app_enabled,true),v_push_enabled,
    coalesce(p_updates_enabled,true),coalesce(p_maintenance_enabled,true),
    coalesce(p_knowledge_enabled,true),coalesce(p_admin_messages_enabled,true),now()
  )
  on conflict(user_id) do update set
    in_app_enabled=excluded.in_app_enabled,
    push_enabled=v_push_enabled,
    updates_enabled=excluded.updates_enabled,
    maintenance_enabled=excluded.maintenance_enabled,
    knowledge_enabled=excluded.knowledge_enabled,
    admin_messages_enabled=excluded.admin_messages_enabled,
    updated_at=now();

  return public.get_my_notification_preferences();
end;
$function$;

create or replace function public.unregister_my_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_push_enabled boolean;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;

  update public.user_push_subscriptions
  set enabled=false,updated_at=now()
  where user_id=v_user and endpoint=p_endpoint;

  select exists(
    select 1
    from public.user_push_subscriptions s
    where s.user_id=v_user and s.enabled=true
  ) into v_push_enabled;

  update public.user_notification_preferences pref
  set push_enabled=v_push_enabled,updated_at=now()
  where pref.user_id=v_user;
end;
$function$;

update public.user_notification_preferences pref
set push_enabled = exists(
  select 1
  from public.user_push_subscriptions s
  where s.user_id=pref.user_id and s.enabled=true
),
updated_at=now()
where pref.push_enabled is distinct from exists(
  select 1
  from public.user_push_subscriptions s
  where s.user_id=pref.user_id and s.enabled=true
);
