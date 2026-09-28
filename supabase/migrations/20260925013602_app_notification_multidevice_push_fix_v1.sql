-- Preserve device-specific Push subscriptions when account Push is toggled off.
-- Live migration version: 20260925013602

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
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.status='active') then
    raise exception 'active user required' using errcode='42501';
  end if;

  insert into public.user_notification_preferences(
    user_id,in_app_enabled,push_enabled,updates_enabled,maintenance_enabled,knowledge_enabled,admin_messages_enabled,updated_at
  )
  values(
    v_user,coalesce(p_in_app_enabled,true),coalesce(p_push_enabled,false),
    coalesce(p_updates_enabled,true),coalesce(p_maintenance_enabled,true),
    coalesce(p_knowledge_enabled,true),coalesce(p_admin_messages_enabled,true),now()
  )
  on conflict(user_id) do update set
    in_app_enabled=excluded.in_app_enabled,
    push_enabled=excluded.push_enabled,
    updates_enabled=excluded.updates_enabled,
    maintenance_enabled=excluded.maintenance_enabled,
    knowledge_enabled=excluded.knowledge_enabled,
    admin_messages_enabled=excluded.admin_messages_enabled,
    updated_at=now();

  return public.get_my_notification_preferences();
end;
$function$;
