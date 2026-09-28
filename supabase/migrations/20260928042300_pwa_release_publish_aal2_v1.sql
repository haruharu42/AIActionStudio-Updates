begin;

create or replace function public.admin_publish_app_release(
  p_release_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_channel public.app_release_channels%rowtype;
  v_aal text := coalesce((select auth.jwt()->>'aal'), 'aal1');
begin
  if not private.is_active_admin() then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  if v_aal <> 'aal2' then
    raise exception 'aal2 required for public release publish' using errcode = '42501';
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
    raise exception 'candidate must pass tester stage before publish' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.app_release_testers t
    join public.profiles p on p.id = t.user_id
    where t.enabled = true
      and p.role = 'user'
      and p.status = 'active'
  ) then
    raise exception 'active release tester required before publish' using errcode = '22023';
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

  update public.app_releases
  set status = 'published',
      published_at = now(),
      retired_at = null
  where id = p_release_id;

  update public.app_release_channels
  set current_release_id = p_release_id,
      candidate_release_id = null,
      candidate_stage = null,
      updated_by = v_admin,
      updated_at = now()
  where channel = 'pwa';

  insert into public.app_release_audit (
    actor_user_id, action, release_id, target_release_id
  )
  values (
    v_admin, 'published', p_release_id, v_channel.current_release_id
  );

  return public.admin_list_app_releases();
end;
$function$;

revoke all on function public.admin_publish_app_release(uuid) from public, anon;
grant execute on function public.admin_publish_app_release(uuid) to authenticated;

comment on function public.admin_publish_app_release(uuid) is
'Publishing a PWA candidate to all users requires an active admin session at AAL2. Emergency rollback remains a separate active-admin operation.';

commit;
