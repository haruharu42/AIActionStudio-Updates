-- Keep the notification feature behind the same admin -> tester -> public rollout
-- used by the rest of AAS. User notification RPCs use guarded v2 wrappers.

insert into public.app_feature_controls(
  feature_key,category,title,description,route_prefix,exact_match,rollout_stage,maintenance_mode,admin_only,sort_order
)
values(
  'notifications','共通','通知センター','アップデート・メンテナンス・Knowledge更新・管理者通知の確認と端末通知設定。',
  '/notifications',true,'admin',false,false,175
)
on conflict(feature_key) do update set
  category=excluded.category,
  title=excluded.title,
  description=excluded.description,
  route_prefix=excluded.route_prefix,
  exact_match=excluded.exact_match,
  sort_order=excluded.sort_order,
  updated_at=now();

create or replace function private.assert_notification_feature_access()
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not private.can_use_app_feature('notifications',v_user) then
    raise exception 'notification feature is not available for this account' using errcode='42501';
  end if;
  return v_user;
end;
$function$;

create or replace function public.get_my_notification_preferences_v2()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform private.assert_notification_feature_access();
  return public.get_my_notification_preferences();
end;
$function$;

create or replace function public.update_my_notification_preferences_v2(
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
begin
  perform private.assert_notification_feature_access();
  return public.update_my_notification_preferences(
    p_in_app_enabled,p_push_enabled,p_updates_enabled,p_maintenance_enabled,p_knowledge_enabled,p_admin_messages_enabled
  );
end;
$function$;

create or replace function public.get_my_app_notifications_v2(
  p_limit integer default 30,
  p_unread_only boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform private.assert_notification_feature_access();
  return public.get_my_app_notifications(p_limit,p_unread_only);
end;
$function$;

create or replace function public.mark_my_app_notification_read_v2(p_notification_id bigint)
returns void
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform private.assert_notification_feature_access();
  perform public.mark_my_app_notification_read(p_notification_id);
end;
$function$;

create or replace function public.mark_all_my_app_notifications_read_v2()
returns integer
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform private.assert_notification_feature_access();
  return public.mark_all_my_app_notifications_read();
end;
$function$;

create or replace function public.get_notification_push_public_config_v2()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform private.assert_notification_feature_access();
  return public.get_notification_push_public_config();
end;
$function$;

create or replace function public.register_my_push_subscription_v2(
  p_endpoint text,
  p_p256dh text,
  p_auth_key text,
  p_user_agent text default ''
)
returns bigint
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform private.assert_notification_feature_access();
  return public.register_my_push_subscription(p_endpoint,p_p256dh,p_auth_key,p_user_agent);
end;
$function$;

create or replace function public.unregister_my_push_subscription_v2(p_endpoint text)
returns void
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform private.assert_notification_feature_access();
  perform public.unregister_my_push_subscription(p_endpoint);
end;
$function$;

create or replace function private.enqueue_notification_push_deliveries()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare queued integer := 0;
begin
  insert into public.app_notification_push_deliveries(notification_id,subscription_id)
  select NEW.id,s.id
  from public.user_push_subscriptions s
  join public.profiles p on p.id=s.user_id and p.status='active'
  join public.user_notification_preferences pref on pref.user_id=s.user_id
  where s.enabled=true
    and pref.push_enabled=true
    and private.can_use_app_feature('notifications',s.user_id)
    and private.notification_category_enabled(NEW.category,pref)
    and private.user_can_receive_notification(s.user_id,NEW)
  on conflict(notification_id,subscription_id) do nothing;

  get diagnostics queued=row_count;
  if queued>0 then perform private.invoke_notification_push_worker(); end if;
  return NEW;
end;
$function$;

revoke all on function private.assert_notification_feature_access() from public,anon,authenticated;
revoke all on function public.get_my_notification_preferences() from authenticated;
revoke all on function public.update_my_notification_preferences(boolean,boolean,boolean,boolean,boolean,boolean) from authenticated;
revoke all on function public.get_my_app_notifications(integer,boolean) from authenticated;
revoke all on function public.mark_my_app_notification_read(bigint) from authenticated;
revoke all on function public.mark_all_my_app_notifications_read() from authenticated;
revoke all on function public.get_notification_push_public_config() from authenticated;
revoke all on function public.register_my_push_subscription(text,text,text,text) from authenticated;
revoke all on function public.unregister_my_push_subscription(text) from authenticated;

revoke all on function public.get_my_notification_preferences_v2() from public,anon;
revoke all on function public.update_my_notification_preferences_v2(boolean,boolean,boolean,boolean,boolean,boolean) from public,anon;
revoke all on function public.get_my_app_notifications_v2(integer,boolean) from public,anon;
revoke all on function public.mark_my_app_notification_read_v2(bigint) from public,anon;
revoke all on function public.mark_all_my_app_notifications_read_v2() from public,anon;
revoke all on function public.get_notification_push_public_config_v2() from public,anon;
revoke all on function public.register_my_push_subscription_v2(text,text,text,text) from public,anon;
revoke all on function public.unregister_my_push_subscription_v2(text) from public,anon;

grant execute on function public.get_my_notification_preferences_v2() to authenticated;
grant execute on function public.update_my_notification_preferences_v2(boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.get_my_app_notifications_v2(integer,boolean) to authenticated;
grant execute on function public.mark_my_app_notification_read_v2(bigint) to authenticated;
grant execute on function public.mark_all_my_app_notifications_read_v2() to authenticated;
grant execute on function public.get_notification_push_public_config_v2() to authenticated;
grant execute on function public.register_my_push_subscription_v2(text,text,text,text) to authenticated;
grant execute on function public.unregister_my_push_subscription_v2(text) to authenticated;
