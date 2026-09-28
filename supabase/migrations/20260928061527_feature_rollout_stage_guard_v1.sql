-- Enforce the staged feature rollout contract at the database boundary.
-- Promotion order: admin -> tester -> public.
-- Emergency rollback remains allowed from public/tester back to a narrower stage.

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

revoke all on function public.admin_update_app_feature_control(text,text,boolean,text) from public, anon;
grant execute on function public.admin_update_app_feature_control(text,text,boolean,text) to authenticated;
