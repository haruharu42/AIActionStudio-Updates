-- Admin-only Notification Center rollout/readiness snapshot.
-- Read-only aggregation: no rollout stage is changed by this migration.

create or replace function public.admin_get_notification_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_stage text := 'admin';
  v_maintenance boolean := false;
  v_push_enabled boolean := false;
  v_push_config_ready boolean := false;
  v_tester_count integer := 0;
  v_tester_push_users integer := 0;
  v_enabled_subscriptions integer := 0;
  v_pending integer := 0;
  v_processing integer := 0;
  v_sent integer := 0;
  v_failed integer := 0;
  v_latest_sent_at timestamptz;
  v_latest_failed_at timestamptz;
  v_automated_checks_pass boolean := false;
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;

  select
    coalesce(f.rollout_stage,'admin'),
    coalesce(f.maintenance_mode,false)
  into v_stage,v_maintenance
  from public.app_feature_controls f
  where f.feature_key='notifications';

  select
    coalesce(s.enabled,false),
    coalesce(s.enabled,false)
      and coalesce(s.project_url,'') ~ '^https://'
      and coalesce(s.worker_token_hash,'') ~ '^[0-9a-f]{64}$'
      and coalesce(s.vapid_public_key,'') <> ''
      and coalesce(s.vapid_subject,'') <> ''
  into v_push_enabled,v_push_config_ready
  from public.notification_push_settings s
  where s.id=1;

  select count(*)::integer
  into v_tester_count
  from public.app_release_testers t
  join public.profiles p on p.id=t.user_id
  where t.enabled=true
    and p.status='active'
    and p.role <> 'admin';

  select count(distinct t.user_id)::integer
  into v_tester_push_users
  from public.app_release_testers t
  join public.profiles p on p.id=t.user_id
  join public.user_notification_preferences pref
    on pref.user_id=t.user_id and pref.push_enabled=true
  where t.enabled=true
    and p.status='active'
    and p.role <> 'admin'
    and exists(
      select 1
      from public.user_push_subscriptions s
      where s.user_id=t.user_id
        and s.enabled=true
        and coalesce(s.last_error,'')=''
    );

  select count(*) filter(where s.enabled=true)::integer
  into v_enabled_subscriptions
  from public.user_push_subscriptions s;

  select
    count(*) filter(where d.status='pending')::integer,
    count(*) filter(where d.status='processing')::integer,
    count(*) filter(where d.status='sent')::integer,
    count(*) filter(where d.status='failed')::integer,
    max(d.sent_at) filter(where d.status='sent'),
    max(d.created_at) filter(where d.status='failed')
  into
    v_pending,v_processing,v_sent,v_failed,v_latest_sent_at,v_latest_failed_at
  from public.app_notification_push_deliveries d;

  v_automated_checks_pass :=
    v_push_config_ready
    and not v_maintenance
    and v_tester_count > 0
    and v_tester_push_users >= v_tester_count
    and v_pending = 0
    and v_processing = 0
    and v_failed = 0;

  return jsonb_build_object(
    'feature_stage',v_stage,
    'maintenance_mode',v_maintenance,
    'push_enabled',v_push_enabled,
    'push_config_ready',v_push_config_ready,
    'tester_count',v_tester_count,
    'tester_push_users',v_tester_push_users,
    'enabled_subscriptions',v_enabled_subscriptions,
    'deliveries',jsonb_build_object(
      'pending',v_pending,
      'processing',v_processing,
      'sent',v_sent,
      'failed',v_failed,
      'latest_sent_at',v_latest_sent_at,
      'latest_failed_at',v_latest_failed_at
    ),
    'automated_checks_pass',v_automated_checks_pass,
    'manual_checks_required',jsonb_build_array(
      'tester_device_push_receive',
      'tester_device_notification_tap',
      'pc_mobile_major_flow'
    )
  );
end;
$function$;

revoke all on function public.admin_get_notification_readiness() from public,anon,authenticated;
grant execute on function public.admin_get_notification_readiness() to authenticated;
