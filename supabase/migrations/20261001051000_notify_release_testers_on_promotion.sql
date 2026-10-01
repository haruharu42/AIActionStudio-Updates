-- Ensure a newly promoted PWA candidate creates an in-app notification for
-- designated release testers. Repeated calls while already in tester stage
-- remain idempotent because they return before inserting another notification.

create or replace function public.admin_promote_app_release_to_testers(p_release_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_channel public.app_release_channels%rowtype;
  v_release public.app_releases%rowtype;
begin
  if not private.is_active_admin() then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  select * into v_channel
  from public.app_release_channels c
  where c.channel = 'pwa'
  for update;

  if v_channel.candidate_release_id is null
     or v_channel.candidate_release_id <> p_release_id then
    raise exception 'release is not the active candidate' using errcode = '22023';
  end if;

  select * into v_release
  from public.app_releases r
  where r.id = p_release_id
    and r.channel = 'pwa'
    and r.status = 'candidate';

  if v_release.id is null then
    raise exception 'candidate release not found' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.app_release_testers t
    join public.profiles p on p.id = t.user_id
    where t.enabled = true
      and p.role = 'user'
      and p.status = 'active'
  ) then
    raise exception 'at least one active release tester is required' using errcode = '22023';
  end if;

  if v_channel.candidate_stage = 'tester' then
    return public.admin_list_app_releases();
  end if;

  if v_channel.candidate_stage is distinct from 'admin' then
    raise exception 'candidate is not in admin test stage' using errcode = '22023';
  end if;

  update public.app_release_channels
  set candidate_stage = 'tester',
      updated_by = v_admin,
      updated_at = now()
  where channel = 'pwa';

  insert into public.app_release_audit (
    actor_user_id, action, release_id, metadata
  )
  values (
    v_admin,
    'candidate_promoted_to_tester',
    p_release_id,
    jsonb_build_object('candidate_stage', 'tester')
  );

  insert into public.app_notifications (
    category, title, body, href, audience, created_by
  )
  values (
    'update',
    'v' || v_release.version || ' テスター確認を開始しました',
    '候補版 v' || v_release.version || '「' || v_release.title || '」が指定テスター向けに公開されました。Preview PWAで主要導線と通知センターを確認してください。',
    '/',
    'tester',
    v_admin
  );

  return public.admin_list_app_releases();
end;
$function$;
