-- Production Canary release pipeline.
-- Stage 1: Preview/admin candidate
-- Stage 2: production-like Canary deployment for enabled release testers
-- Stage 3: admin confirms Canary verification
-- Stage 4: promote the exact Canary artifact to the general-public Worker

alter table public.app_release_deployments
  add column if not exists deployment_kind text not null default 'public',
  add column if not exists source_canary_deployment_id uuid null,
  add column if not exists verified_at timestamptz null,
  add column if not exists verified_by uuid null;

alter table public.app_release_deployments
  drop constraint if exists app_release_deployments_deployment_kind_check,
  add constraint app_release_deployments_deployment_kind_check
    check (deployment_kind in ('canary','public'));

alter table public.app_release_deployments
  drop constraint if exists app_release_deployments_source_canary_deployment_id_fkey,
  add constraint app_release_deployments_source_canary_deployment_id_fkey
    foreign key (source_canary_deployment_id)
    references public.app_release_deployments(id)
    on delete restrict;

alter table public.app_release_deployments
  drop constraint if exists app_release_deployments_verified_by_fkey,
  add constraint app_release_deployments_verified_by_fkey
    foreign key (verified_by)
    references public.profiles(id)
    on delete set null;

alter table public.app_release_deployments
  drop constraint if exists app_release_deployments_deployment_url_check,
  add constraint app_release_deployments_deployment_url_check
    check (
      deployment_url is null
      or deployment_url in (
        'https://ai-article-studio-pwa-canary.ai-article-studio.workers.dev/',
        'https://ai-article-studio-pwa.ai-article-studio.workers.dev/'
      )
    );

create index if not exists app_release_deployments_release_kind_requested_idx
  on public.app_release_deployments(release_id, deployment_kind, requested_at desc);

create unique index if not exists app_release_deployments_one_active_kind_idx
  on public.app_release_deployments(release_id, deployment_kind)
  where status in ('requested','dispatched','running');

create or replace function public.admin_list_app_release_deployments()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.is_active_admin() then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'release_id', d.release_id,
        'deployment_kind', d.deployment_kind,
        'source_canary_deployment_id', d.source_canary_deployment_id,
        'source_branch', d.source_branch,
        'source_sha', d.source_sha,
        'status', d.status,
        'github_run_id', d.github_run_id,
        'github_run_url', d.github_run_url,
        'target_sha', d.target_sha,
        'deployment_url', d.deployment_url,
        'verified_at', d.verified_at,
        'verified_by', d.verified_by,
        'error_message', d.error_message,
        'requested_at', d.requested_at,
        'dispatched_at', d.dispatched_at,
        'started_at', d.started_at,
        'finished_at', d.finished_at,
        'updated_at', d.updated_at
      )
      order by d.requested_at desc
    )
    from (
      select *
      from public.app_release_deployments
      order by requested_at desc
      limit 40
    ) d
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.admin_request_app_release_canary_deploy(
  p_release_id uuid,
  p_source_branch text,
  p_source_sha text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_aal text := coalesce((select auth.jwt()->>'aal'), 'aal1');
  v_channel public.app_release_channels%rowtype;
  v_request public.app_release_deployments%rowtype;
  v_release public.app_releases%rowtype;
  v_source_branch text := btrim(coalesce(p_source_branch, ''));
  v_source_sha text := lower(btrim(coalesce(p_source_sha, '')));
begin
  if not private.is_active_admin() then
    raise exception 'active admin required' using errcode = '42501';
  end if;
  if v_aal <> 'aal2' then
    raise exception 'aal2 required for production canary deploy' using errcode = '42501';
  end if;
  if v_source_branch not in ('main', 'preview/current') then
    raise exception 'invalid preview source branch' using errcode = '22023';
  end if;
  if v_source_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'invalid preview source sha' using errcode = '22023';
  end if;

  select * into v_channel
  from public.app_release_channels c
  where c.channel = 'pwa'
  for update;

  if v_channel.candidate_release_id is null
     or v_channel.candidate_release_id <> p_release_id then
    raise exception 'release is not the active candidate' using errcode = '22023';
  end if;
  if v_channel.candidate_stage is distinct from 'admin' then
    raise exception 'candidate must be in admin stage before canary deploy' using errcode = '22023';
  end if;

  select * into v_release
  from public.app_releases r
  where r.id = p_release_id
    and r.channel = 'pwa'
    and r.status = 'candidate';

  if v_release.id is null then
    raise exception 'candidate release not found' using errcode = '22023';
  end if;
  if right(v_release.build_key, 12) <> substr(v_source_sha, 1, 12) then
    raise exception 'candidate build does not match approved preview sha' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.app_release_testers t
    join public.profiles p on p.id = t.user_id
    where t.enabled = true
      and p.role = 'user'
      and p.status = 'active'
  ) then
    raise exception 'active release tester required before canary deploy' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.app_release_deployments d
    where d.release_id = p_release_id
      and d.status in ('requested','dispatched','running')
  ) then
    raise exception 'release deployment already in progress' using errcode = '55000';
  end if;

  insert into public.app_release_deployments (
    release_id, requested_by, deployment_kind, source_branch, source_sha, status
  )
  values (
    p_release_id, v_admin, 'canary', v_source_branch, v_source_sha, 'requested'
  )
  returning * into v_request;

  insert into public.app_release_audit (
    actor_user_id, action, release_id, metadata
  )
  values (
    v_admin,
    'canary_deployment_requested',
    p_release_id,
    jsonb_build_object(
      'deployment_request_id', v_request.id,
      'source_branch', v_source_branch,
      'source_sha', v_source_sha
    )
  );

  return to_jsonb(v_request);
end;
$function$;

create or replace function public.service_finalize_app_release_canary_deployment(
  p_request_id uuid,
  p_github_run_id bigint,
  p_github_run_url text,
  p_target_sha text,
  p_deployment_url text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_request public.app_release_deployments%rowtype;
  v_channel public.app_release_channels%rowtype;
  v_release public.app_releases%rowtype;
  v_target_sha text := lower(btrim(coalesce(p_target_sha, '')));
  v_deployment_url text := btrim(coalesce(p_deployment_url, ''));
begin
  if v_target_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'invalid target sha' using errcode = '22023';
  end if;
  if v_deployment_url <> 'https://ai-article-studio-pwa-canary.ai-article-studio.workers.dev/' then
    raise exception 'invalid canary deployment url' using errcode = '22023';
  end if;

  select * into v_request
  from public.app_release_deployments d
  where d.id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'deployment request not found' using errcode = 'P0002';
  end if;
  if v_request.deployment_kind <> 'canary' then
    raise exception 'deployment request is not a canary request' using errcode = '22023';
  end if;
  if v_request.status = 'succeeded' then
    return;
  end if;
  if v_request.status not in ('requested','dispatched','running') then
    raise exception 'deployment request is not active' using errcode = '55000';
  end if;
  if v_target_sha <> v_request.source_sha then
    raise exception 'canary target sha must equal approved source sha' using errcode = '22023';
  end if;

  select * into v_channel
  from public.app_release_channels c
  where c.channel = 'pwa'
  for update;

  if v_channel.candidate_release_id is null
     or v_channel.candidate_release_id <> v_request.release_id
     or v_channel.candidate_stage is distinct from 'admin' then
    raise exception 'candidate changed before canary completion' using errcode = '55000';
  end if;

  select * into v_release
  from public.app_releases r
  where r.id = v_request.release_id
    and r.channel = 'pwa'
    and r.status = 'candidate';

  if v_release.id is null then
    raise exception 'candidate release not found at canary finalize' using errcode = '55000';
  end if;
  if right(v_release.build_key, 12) <> substr(v_request.source_sha, 1, 12) then
    raise exception 'candidate build changed before canary completion' using errcode = '55000';
  end if;

  update public.app_release_deployments
  set status = 'succeeded',
      github_run_id = p_github_run_id,
      github_run_url = p_github_run_url,
      target_sha = v_target_sha,
      deployment_url = v_deployment_url,
      error_message = null,
      dispatched_at = coalesce(dispatched_at, now()),
      started_at = coalesce(started_at, now()),
      finished_at = now(),
      updated_at = now()
  where id = p_request_id;

  update public.app_release_channels
  set candidate_stage = 'tester',
      updated_by = v_request.requested_by,
      updated_at = now()
  where channel = 'pwa';

  insert into public.app_release_audit (
    actor_user_id, action, release_id, metadata
  )
  values (
    v_request.requested_by,
    'canary_deployment_succeeded',
    v_request.release_id,
    jsonb_build_object(
      'deployment_request_id', p_request_id,
      'source_sha', v_request.source_sha,
      'github_run_id', p_github_run_id,
      'github_run_url', p_github_run_url,
      'deployment_url', v_deployment_url
    )
  );

  insert into public.app_notifications (
    category, title, body, href, audience, source_key, created_by
  )
  values (
    'update',
    left('v' || v_release.version || ' Production Canary確認を開始しました', 160),
    left('公開環境相当のCanaryへ候補版 v' || v_release.version || '「' || v_release.title || '」を反映しました。指定テスターで確認してください。', 2000),
    '/',
    'tester',
    'release-canary:' || v_release.id::text || ':' || substr(v_request.source_sha, 1, 12),
    v_request.requested_by
  )
  on conflict (source_key) do nothing;
end;
$function$;

create or replace function public.admin_confirm_app_release_canary(
  p_deployment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_aal text := coalesce((select auth.jwt()->>'aal'), 'aal1');
  v_channel public.app_release_channels%rowtype;
  v_deployment public.app_release_deployments%rowtype;
  v_release public.app_releases%rowtype;
begin
  if not private.is_active_admin() then
    raise exception 'active admin required' using errcode = '42501';
  end if;
  if v_aal <> 'aal2' then
    raise exception 'aal2 required to confirm production canary' using errcode = '42501';
  end if;

  select * into v_deployment
  from public.app_release_deployments d
  where d.id = p_deployment_id
  for update;

  if v_deployment.id is null
     or v_deployment.deployment_kind <> 'canary'
     or v_deployment.status <> 'succeeded' then
    raise exception 'successful canary deployment required' using errcode = '22023';
  end if;

  select * into v_channel
  from public.app_release_channels c
  where c.channel = 'pwa'
  for update;

  if v_channel.candidate_release_id is null
     or v_channel.candidate_release_id <> v_deployment.release_id
     or v_channel.candidate_stage is distinct from 'tester' then
    raise exception 'active tester-stage candidate required' using errcode = '22023';
  end if;

  select * into v_release
  from public.app_releases r
  where r.id = v_deployment.release_id
    and r.status = 'candidate'
    and r.channel = 'pwa';

  if v_release.id is null
     or right(v_release.build_key, 12) <> substr(v_deployment.source_sha, 1, 12) then
    raise exception 'canary does not match active candidate build' using errcode = '22023';
  end if;

  update public.app_release_deployments
  set verified_at = coalesce(verified_at, now()),
      verified_by = coalesce(verified_by, v_admin),
      updated_at = now()
  where id = p_deployment_id;

  insert into public.app_release_audit (
    actor_user_id, action, release_id, metadata
  )
  values (
    v_admin,
    'canary_verified',
    v_deployment.release_id,
    jsonb_build_object(
      'deployment_request_id', v_deployment.id,
      'source_sha', v_deployment.source_sha,
      'deployment_url', v_deployment.deployment_url
    )
  );

  return (
    select to_jsonb(d)
    from public.app_release_deployments d
    where d.id = p_deployment_id
  );
end;
$function$;

create or replace function public.admin_request_app_release_deploy(
  p_release_id uuid,
  p_source_branch text,
  p_source_sha text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_aal text := coalesce((select auth.jwt()->>'aal'), 'aal1');
  v_channel public.app_release_channels%rowtype;
  v_request public.app_release_deployments%rowtype;
  v_release public.app_releases%rowtype;
  v_canary public.app_release_deployments%rowtype;
  v_source_branch text := btrim(coalesce(p_source_branch, ''));
  v_source_sha text := lower(btrim(coalesce(p_source_sha, '')));
begin
  if not private.is_active_admin() then
    raise exception 'active admin required' using errcode = '42501';
  end if;
  if v_aal <> 'aal2' then
    raise exception 'aal2 required for public release deploy' using errcode = '42501';
  end if;
  if v_source_branch not in ('main', 'preview/current') then
    raise exception 'invalid preview source branch' using errcode = '22023';
  end if;
  if v_source_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'invalid preview source sha' using errcode = '22023';
  end if;

  select * into v_channel
  from public.app_release_channels c
  where c.channel = 'pwa'
  for update;

  if v_channel.candidate_release_id is null
     or v_channel.candidate_release_id <> p_release_id then
    raise exception 'release is not the active candidate' using errcode = '22023';
  end if;
  if v_channel.candidate_stage is distinct from 'tester' then
    raise exception 'candidate must pass production canary before public deploy' using errcode = '22023';
  end if;

  select * into v_release
  from public.app_releases r
  where r.id = p_release_id
    and r.channel = 'pwa'
    and r.status = 'candidate';

  if v_release.id is null then
    raise exception 'candidate release not found' using errcode = '22023';
  end if;
  if right(v_release.build_key, 12) <> substr(v_source_sha, 1, 12) then
    raise exception 'candidate build does not match approved canary sha' using errcode = '22023';
  end if;

  select * into v_canary
  from public.app_release_deployments d
  where d.release_id = p_release_id
    and d.deployment_kind = 'canary'
    and d.source_sha = v_source_sha
    and d.status = 'succeeded'
    and d.verified_at is not null
    and d.github_run_id is not null
  order by d.finished_at desc nulls last, d.requested_at desc
  limit 1;

  if v_canary.id is null then
    raise exception 'verified production canary required before public deploy' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.app_release_deployments d
    where d.release_id = p_release_id
      and d.deployment_kind = 'public'
      and d.status in ('requested','dispatched','running')
  ) then
    raise exception 'release deployment already in progress' using errcode = '55000';
  end if;

  insert into public.app_release_deployments (
    release_id, requested_by, deployment_kind, source_canary_deployment_id,
    source_branch, source_sha, status
  )
  values (
    p_release_id, v_admin, 'public', v_canary.id,
    v_source_branch, v_source_sha, 'requested'
  )
  returning * into v_request;

  insert into public.app_release_audit (
    actor_user_id, action, release_id, metadata
  )
  values (
    v_admin,
    'public_deployment_requested',
    p_release_id,
    jsonb_build_object(
      'deployment_request_id', v_request.id,
      'canary_deployment_id', v_canary.id,
      'canary_github_run_id', v_canary.github_run_id,
      'source_branch', v_source_branch,
      'source_sha', v_source_sha
    )
  );

  return to_jsonb(v_request) || jsonb_build_object(
    'canary_run_id', v_canary.github_run_id
  );
end;
$function$;

create or replace function public.service_mark_app_release_deployment(
  p_request_id uuid,
  p_status text,
  p_github_run_id bigint default null,
  p_github_run_url text default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_request public.app_release_deployments%rowtype;
begin
  if v_status not in ('dispatched','running','failed') then
    raise exception 'invalid deployment status transition' using errcode = '22023';
  end if;

  select * into v_request
  from public.app_release_deployments d
  where d.id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'deployment request not found' using errcode = 'P0002';
  end if;
  if v_request.status in ('succeeded','cancelled') then
    return;
  end if;

  update public.app_release_deployments
  set status = v_status,
      github_run_id = coalesce(p_github_run_id, github_run_id),
      github_run_url = coalesce(nullif(btrim(coalesce(p_github_run_url, '')), ''), github_run_url),
      error_message = case when v_status = 'failed' then left(coalesce(p_error_message, 'deployment failed'), 1000) else null end,
      dispatched_at = case when v_status = 'dispatched' then coalesce(dispatched_at, now()) else dispatched_at end,
      started_at = case when v_status = 'running' then coalesce(started_at, now()) else started_at end,
      finished_at = case when v_status = 'failed' then now() else finished_at end,
      updated_at = now()
  where id = p_request_id;

  insert into public.app_release_audit (
    actor_user_id, action, release_id, metadata
  )
  values (
    v_request.requested_by,
    case
      when v_status = 'dispatched' then v_request.deployment_kind || '_deployment_dispatched'
      when v_status = 'running' then v_request.deployment_kind || '_deployment_running'
      else v_request.deployment_kind || '_deployment_failed'
    end,
    v_request.release_id,
    jsonb_build_object(
      'deployment_request_id', p_request_id,
      'deployment_kind', v_request.deployment_kind,
      'github_run_id', p_github_run_id,
      'github_run_url', p_github_run_url,
      'error_message', case when v_status = 'failed' then left(coalesce(p_error_message, ''), 500) else null end
    )
  );
end;
$function$;

create or replace function public.service_finalize_app_release_deployment(
  p_request_id uuid,
  p_github_run_id bigint,
  p_github_run_url text,
  p_target_sha text,
  p_deployment_url text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_request public.app_release_deployments%rowtype;
  v_canary public.app_release_deployments%rowtype;
  v_channel public.app_release_channels%rowtype;
  v_target_sha text := lower(btrim(coalesce(p_target_sha, '')));
  v_deployment_url text := btrim(coalesce(p_deployment_url, ''));
begin
  if v_target_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'invalid target sha' using errcode = '22023';
  end if;
  if v_deployment_url <> 'https://ai-article-studio-pwa.ai-article-studio.workers.dev/' then
    raise exception 'invalid production deployment url' using errcode = '22023';
  end if;

  select * into v_request
  from public.app_release_deployments d
  where d.id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'deployment request not found' using errcode = 'P0002';
  end if;
  if v_request.deployment_kind <> 'public' then
    raise exception 'deployment request is not a public request' using errcode = '22023';
  end if;
  if v_request.status = 'succeeded' then
    return;
  end if;
  if v_request.status not in ('requested','dispatched','running') then
    raise exception 'deployment request is not active' using errcode = '55000';
  end if;
  if v_target_sha <> v_request.source_sha then
    raise exception 'public target sha must equal verified canary source sha' using errcode = '22023';
  end if;

  select * into v_canary
  from public.app_release_deployments d
  where d.id = v_request.source_canary_deployment_id;

  if v_canary.id is null
     or v_canary.deployment_kind <> 'canary'
     or v_canary.release_id <> v_request.release_id
     or v_canary.source_sha <> v_request.source_sha
     or v_canary.status <> 'succeeded'
     or v_canary.verified_at is null then
    raise exception 'verified source canary no longer valid' using errcode = '55000';
  end if;

  select * into v_channel
  from public.app_release_channels c
  where c.channel = 'pwa'
  for update;

  if v_channel.candidate_release_id is null
     or v_channel.candidate_release_id <> v_request.release_id
     or v_channel.candidate_stage is distinct from 'tester' then
    raise exception 'candidate changed before deployment completion' using errcode = '55000';
  end if;

  update public.app_releases
  set status = 'published',
      published_at = now(),
      retired_at = null
  where id = v_request.release_id
    and channel = 'pwa'
    and status = 'candidate';

  if not found then
    raise exception 'candidate release not found at finalize' using errcode = '55000';
  end if;

  update public.app_release_channels
  set current_release_id = v_request.release_id,
      candidate_release_id = null,
      candidate_stage = null,
      updated_by = v_request.requested_by,
      updated_at = now()
  where channel = 'pwa';

  update public.app_release_deployments
  set status = 'succeeded',
      github_run_id = p_github_run_id,
      github_run_url = p_github_run_url,
      target_sha = v_target_sha,
      deployment_url = v_deployment_url,
      error_message = null,
      dispatched_at = coalesce(dispatched_at, now()),
      started_at = coalesce(started_at, now()),
      finished_at = now(),
      updated_at = now()
  where id = p_request_id;

  insert into public.app_release_audit (
    actor_user_id, action, release_id, target_release_id, metadata
  )
  values (
    v_request.requested_by,
    'public_deployment_succeeded',
    v_request.release_id,
    v_channel.current_release_id,
    jsonb_build_object(
      'deployment_request_id', p_request_id,
      'canary_deployment_id', v_canary.id,
      'source_sha', v_request.source_sha,
      'target_sha', v_target_sha,
      'github_run_id', p_github_run_id,
      'github_run_url', p_github_run_url,
      'deployment_url', v_deployment_url
    )
  );
end;
$function$;

create or replace function public.admin_promote_app_release_to_testers(p_release_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
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
    from public.app_release_deployments d
    where d.release_id = p_release_id
      and d.deployment_kind = 'canary'
      and d.status = 'succeeded'
      and substr(d.source_sha, 1, 12) = right(v_release.build_key, 12)
  ) then
    raise exception 'production canary deployment required before tester stage' using errcode = '22023';
  end if;

  return public.admin_list_app_releases();
end;
$function$;

create or replace function public.admin_publish_app_release(p_release_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.is_active_admin() then
    raise exception 'active admin required' using errcode = '42501';
  end if;
  raise exception 'direct publish disabled; use verified production canary deployment pipeline'
    using errcode = '55000';
end;
$function$;


revoke all on function public.admin_request_app_release_canary_deploy(uuid, text, text) from public, anon;
grant execute on function public.admin_request_app_release_canary_deploy(uuid, text, text) to authenticated;

revoke all on function public.admin_confirm_app_release_canary(uuid) from public, anon;
grant execute on function public.admin_confirm_app_release_canary(uuid) to authenticated;

revoke all on function public.service_finalize_app_release_canary_deployment(uuid, bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function public.service_finalize_app_release_canary_deployment(uuid, bigint, text, text, text)
  to service_role;
