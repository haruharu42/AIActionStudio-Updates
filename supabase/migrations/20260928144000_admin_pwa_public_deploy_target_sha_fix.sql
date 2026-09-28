begin;

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

revoke all on function public.service_finalize_app_release_deployment(uuid,bigint,text,text,text) from public, anon, authenticated;
grant execute on function public.service_finalize_app_release_deployment(uuid,bigint,text,text,text) to service_role;

comment on function public.service_finalize_app_release_deployment(uuid,bigint,text,text,text) is
'Finalize a public PWA release only after the trusted release orchestrator has verified that the deployed main commit has the exact same source tree as the approved Preview commit.';

commit;
