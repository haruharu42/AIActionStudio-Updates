begin;

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
  v_release public.app_releases%rowtype;
  v_source_branch text := btrim(coalesce(p_source_branch, ''));
  v_source_sha text := lower(btrim(coalesce(p_source_sha, '')));
  v_build_suffix text;
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

  v_build_suffix := right(v_source_sha, 40);
  v_build_suffix := substr(v_build_suffix, 1, 12);

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

  select * into v_release
  from public.app_releases r
  where r.id = p_release_id
    and r.channel = 'pwa'
    and r.status = 'candidate';

  if v_release.id is null then
    raise exception 'candidate release not found' using errcode = '22023';
  end if;
  if right(v_release.build_key, 12) <> v_build_suffix then
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

revoke all on function public.admin_request_app_release_deploy(uuid,text,text) from public, anon;
grant execute on function public.admin_request_app_release_deploy(uuid,text,text) to authenticated;

comment on function public.admin_request_app_release_deploy(uuid,text,text) is
'Creates a public deployment request only when the tester-stage candidate build key is bound to the exact approved Preview SHA prefix.';

commit;
