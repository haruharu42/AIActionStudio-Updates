begin;

create table if not exists public.app_release_deployments (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.app_releases(id) on delete restrict,
  requested_by uuid references public.profiles(id) on delete set null,
  source_branch text not null,
  source_sha text not null,
  status text not null default 'requested',
  github_run_id bigint,
  github_run_url text,
  target_sha text,
  deployment_url text,
  error_message text,
  requested_at timestamptz not null default now(),
  dispatched_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint app_release_deployments_source_branch_check check (source_branch = 'preview/current'),
  constraint app_release_deployments_source_sha_check check (source_sha ~ '^[0-9a-f]{40}$'),
  constraint app_release_deployments_target_sha_check check (target_sha is null or target_sha ~ '^[0-9a-f]{40}$'),
  constraint app_release_deployments_status_check check (
    status in ('requested','dispatched','running','succeeded','failed','cancelled')
  ),
  constraint app_release_deployments_run_url_check check (
    github_run_url is null or github_run_url ~ '^https://github\\.com/haruharu42/AIArticleStudio-Updates/actions/runs/[0-9]+$'
  ),
  constraint app_release_deployments_deployment_url_check check (
    deployment_url is null or deployment_url = 'https://ai-article-studio-pwa.ai-article-studio.workers.dev/'
  )
);

create index if not exists app_release_deployments_release_requested_idx
  on public.app_release_deployments(release_id, requested_at desc);

create unique index if not exists app_release_deployments_one_active_per_release_idx
  on public.app_release_deployments(release_id)
  where status in ('requested','dispatched','running');

alter table public.app_release_deployments enable row level security;
alter table public.app_release_deployments force row level security;
revoke all on table public.app_release_deployments from public, anon, authenticated;

alter table public.app_release_audit
  drop constraint if exists app_release_audit_action_check;

alter table public.app_release_audit
  add constraint app_release_audit_action_check check (
    action in (
      'candidate_created',
      'candidate_promoted_to_tester',
      'tester_added',
      'tester_removed',
      'published',
      'user_accepted',
      'rolled_back',
      'deployment_requested',
      'deployment_dispatched',
      'deployment_running',
      'deployment_succeeded',
      'deployment_failed'
    )
  );

create or replace function public.admin_request_app_release_deploy(
  p_release_id uuid,
  p_source_branch text,
  p_source_sha text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_aal text := coalesce((select auth.jwt()->>'aal'), 'aal1');
  v_channel public.app_release_channels%rowtype;
  v_request public.app_release_deployments%rowtype;
  v_source_branch text := btrim(coalesce(p_source_branch, ''));
  v_source_sha text := lower(btrim(coalesce(p_source_sha, '')));
begin
  if not private.is_active_admin() then
    raise exception 'active admin required' using errcode = '42501';
  end if;
  if v_aal <> 'aal2' then
    raise exception 'aal2 required for public release deploy' using errcode = '42501';
  end if;
  if v_source_branch <> 'preview/current' then
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
    raise exception 'candidate must pass tester stage before deploy' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.app_releases r
    where r.id = p_release_id
      and r.channel = 'pwa'
      and r.status = 'candidate'
  ) then
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
    raise exception 'active release tester required before deploy' using errcode = '22023';
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
    release_id, requested_by, source_branch, source_sha, status
  )
  values (
    p_release_id, v_admin, v_source_branch, v_source_sha, 'requested'
  )
  returning * into v_request;

  insert into public.app_release_audit (
    actor_user_id, action, release_id, metadata
  )
  values (
    v_admin,
    'deployment_requested',
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

create or replace function public.admin_list_app_release_deployments()
returns jsonb
language plpgsql
security definer
set search_path = ''
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
        'source_branch', d.source_branch,
        'source_sha', d.source_sha,
        'status', d.status,
        'github_run_id', d.github_run_id,
        'github_run_url', d.github_run_url,
        'target_sha', d.target_sha,
        'deployment_url', d.deployment_url,
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
      limit 20
    ) d
  ), '[]'::jsonb);
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
set search_path = ''
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
      when v_status = 'dispatched' then 'deployment_dispatched'
      when v_status = 'running' then 'deployment_running'
      else 'deployment_failed'
    end,
    v_request.release_id,
    jsonb_build_object(
      'deployment_request_id', p_request_id,
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
set search_path = ''
as $function$
declare
  v_request public.app_release_deployments%rowtype;
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
  if v_request.status = 'succeeded' then
    return;
  end if;
  if v_request.status not in ('requested','dispatched','running') then
    raise exception 'deployment request is not active' using errcode = '55000';
  end if;
  if v_target_sha <> v_request.source_sha then
    raise exception 'deployed sha does not match approved preview sha' using errcode = '22023';
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
    'deployment_succeeded',
    v_request.release_id,
    v_channel.current_release_id,
    jsonb_build_object(
      'deployment_request_id', p_request_id,
      'source_sha', v_request.source_sha,
      'target_sha', v_target_sha,
      'github_run_id', p_github_run_id,
      'github_run_url', p_github_run_url,
      'deployment_url', v_deployment_url
    )
  );
end;
$function$;

revoke all on function public.admin_request_app_release_deploy(uuid,text,text) from public, anon;
revoke all on function public.admin_list_app_release_deployments() from public, anon;
revoke all on function public.service_mark_app_release_deployment(uuid,text,bigint,text,text) from public, anon, authenticated;
revoke all on function public.service_finalize_app_release_deployment(uuid,bigint,text,text,text) from public, anon, authenticated;

grant execute on function public.admin_request_app_release_deploy(uuid,text,text) to authenticated;
grant execute on function public.admin_list_app_release_deployments() to authenticated;
grant execute on function public.service_mark_app_release_deployment(uuid,text,bigint,text,text) to service_role;
grant execute on function public.service_finalize_app_release_deployment(uuid,bigint,text,text,text) to service_role;

comment on table public.app_release_deployments is
'Admin-approved Preview-to-public deployment requests. Public release state is finalized only after the guarded GitHub deployment workflow succeeds.';

commit;
