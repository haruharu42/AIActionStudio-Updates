-- Notification Center public rollout must use a dedicated approval path.
-- Generic feature control can still stage, maintain, or roll back notifications,
-- but tester -> public requires automated readiness, three explicit manual checks,
-- and the current admin session at AAL2.

create or replace function public.admin_update_app_feature_control(
  p_feature_key text,
  p_rollout_stage text,
  p_maintenance_mode boolean,
  p_maintenance_message text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_feature public.app_feature_controls%rowtype;
  v_old jsonb;
  v_new jsonb;
  v_active_tester_count integer := 0;
begin
  if not private.is_active_admin() then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  p_feature_key := lower(btrim(coalesce(p_feature_key, '')));
  p_rollout_stage := lower(btrim(coalesce(p_rollout_stage, '')));
  p_maintenance_message := btrim(coalesce(p_maintenance_message, ''));

  if p_rollout_stage not in ('admin','tester','public') then
    raise exception 'invalid rollout stage' using errcode = '22023';
  end if;
  if char_length(p_maintenance_message) > 500 then
    raise exception 'maintenance message too long' using errcode = '22023';
  end if;

  select * into v_feature
  from public.app_feature_controls f
  where f.feature_key = p_feature_key
  for update;

  if v_feature.feature_key is null then
    raise exception 'feature not found' using errcode = '22023';
  end if;

  if v_feature.admin_only and p_rollout_stage <> 'admin' then
    raise exception 'admin-only feature cannot be released to users' using errcode = '22023';
  end if;

  if v_feature.rollout_stage = 'admin' and p_rollout_stage = 'public' then
    raise exception 'tester rollout stage required before public release' using errcode = '22023';
  end if;

  if p_feature_key = 'notifications'
     and v_feature.rollout_stage = 'tester'
     and p_rollout_stage = 'public' then
    raise exception 'notification public promotion must use dedicated approval' using errcode = '55000';
  end if;

  if (v_feature.rollout_stage = 'admin' and p_rollout_stage = 'tester')
     or (v_feature.rollout_stage = 'tester' and p_rollout_stage = 'public') then
    select count(*)::integer into v_active_tester_count
    from public.app_release_testers t
    join public.profiles p on p.id = t.user_id
    where t.enabled = true
      and p.role = 'user'
      and p.status = 'active';

    if v_active_tester_count < 1 then
      raise exception 'active release tester required for staged rollout' using errcode = '22023';
    end if;
  end if;

  v_old := jsonb_build_object(
    'rollout_stage', v_feature.rollout_stage,
    'maintenance_mode', v_feature.maintenance_mode,
    'maintenance_message', v_feature.maintenance_message
  );

  update public.app_feature_controls
  set rollout_stage = p_rollout_stage,
      maintenance_mode = coalesce(p_maintenance_mode, false),
      maintenance_message = p_maintenance_message,
      updated_by = v_admin,
      updated_at = now()
  where feature_key = p_feature_key
  returning * into v_feature;

  v_new := jsonb_build_object(
    'rollout_stage', v_feature.rollout_stage,
    'maintenance_mode', v_feature.maintenance_mode,
    'maintenance_message', v_feature.maintenance_message
  );

  if v_new is distinct from v_old then
    insert into public.app_feature_control_audit(feature_key, actor_user_id, old_state, new_state)
    values (p_feature_key, v_admin, v_old, v_new);
  end if;

  return public.admin_list_app_feature_controls();
end;
$function$;

create or replace function public.admin_promote_notification_feature_public(
  p_tester_device_push_receive boolean,
  p_tester_device_notification_tap boolean,
  p_pc_mobile_major_flow boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_aal text := coalesce((select auth.jwt()->>'aal'), 'aal1');
  v_feature public.app_feature_controls%rowtype;
  v_readiness jsonb;
  v_old jsonb;
  v_new jsonb;
begin
  if v_admin is null or not private.is_active_admin() then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  if v_aal <> 'aal2' then
    raise exception 'aal2 required for notification public promotion' using errcode = '42501';
  end if;

  if p_tester_device_push_receive is distinct from true
     or p_tester_device_notification_tap is distinct from true
     or p_pc_mobile_major_flow is distinct from true then
    raise exception 'all notification manual checks are required' using errcode = '22023';
  end if;

  select * into v_feature
  from public.app_feature_controls f
  where f.feature_key = 'notifications'
  for update;

  if v_feature.feature_key is null then
    raise exception 'notification feature not found' using errcode = '22023';
  end if;

  if v_feature.rollout_stage <> 'tester' then
    raise exception 'notification tester rollout stage required' using errcode = '22023';
  end if;

  if v_feature.maintenance_mode then
    raise exception 'notification maintenance must be disabled before public promotion' using errcode = '55000';
  end if;

  v_readiness := public.admin_get_notification_readiness();
  if not coalesce((v_readiness->>'automated_checks_pass')::boolean, false) then
    raise exception 'notification rollout readiness requirements not met' using errcode = '55000';
  end if;

  v_old := jsonb_build_object(
    'rollout_stage', v_feature.rollout_stage,
    'maintenance_mode', v_feature.maintenance_mode,
    'maintenance_message', v_feature.maintenance_message
  );

  update public.app_feature_controls
  set rollout_stage = 'public',
      updated_by = v_admin,
      updated_at = now()
  where feature_key = 'notifications'
  returning * into v_feature;

  v_new := jsonb_build_object(
    'rollout_stage', v_feature.rollout_stage,
    'maintenance_mode', v_feature.maintenance_mode,
    'maintenance_message', v_feature.maintenance_message,
    'manual_checks_confirmed', jsonb_build_array(
      'tester_device_push_receive',
      'tester_device_notification_tap',
      'pc_mobile_major_flow'
    ),
    'approval_aal', v_aal
  );

  insert into public.app_feature_control_audit(feature_key, actor_user_id, old_state, new_state)
  values ('notifications', v_admin, v_old, v_new);

  return public.admin_list_app_feature_controls();
end;
$function$;

revoke all on function public.admin_update_app_feature_control(text,text,boolean,text)
  from public, anon;
grant execute on function public.admin_update_app_feature_control(text,text,boolean,text)
  to authenticated;

revoke all on function public.admin_promote_notification_feature_public(boolean,boolean,boolean)
  from public, anon, authenticated;
grant execute on function public.admin_promote_notification_feature_public(boolean,boolean,boolean)
  to authenticated;

comment on function public.admin_update_app_feature_control(text,text,boolean,text) is
'Admin staged feature rollout. Notification Center tester->public must use admin_promote_notification_feature_public; emergency rollback remains available.';

comment on function public.admin_promote_notification_feature_public(boolean,boolean,boolean) is
'Notification Center tester->public approval. Requires active admin, current AAL2, automated readiness, and all three explicit manual device/flow checks.';
