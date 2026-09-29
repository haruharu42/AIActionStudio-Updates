begin;

alter table public.app_releases
  add column if not exists update_notes text not null default '',
  add column if not exists fix_notes text not null default '';

alter table public.app_releases
  drop constraint if exists app_releases_update_notes_length_check;
alter table public.app_releases
  add constraint app_releases_update_notes_length_check
  check (char_length(update_notes) <= 6000);

alter table public.app_releases
  drop constraint if exists app_releases_fix_notes_length_check;
alter table public.app_releases
  add constraint app_releases_fix_notes_length_check
  check (char_length(fix_notes) <= 6000);

create or replace function public.admin_list_app_releases()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_channel public.app_release_channels%rowtype;
begin
  if not private.is_active_admin() then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  select * into v_channel
  from public.app_release_channels c
  where c.channel = 'pwa';

  return jsonb_build_object(
    'channel', jsonb_build_object(
      'current_release_id', v_channel.current_release_id,
      'candidate_release_id', v_channel.candidate_release_id,
      'candidate_stage', v_channel.candidate_stage,
      'updated_at', v_channel.updated_at
    ),
    'releases', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'version', r.version,
          'title', r.title,
          'notes', r.notes,
          'update_notes', r.update_notes,
          'fix_notes', r.fix_notes,
          'status', r.status,
          'update_kind', r.update_kind,
          'build_key', r.build_key,
          'created_at', r.created_at,
          'published_at', r.published_at,
          'retired_at', r.retired_at,
          'adopted_users', (
            select count(*)
            from public.user_release_state s
            where s.current_release_id = r.id
          )
        )
        order by r.created_at desc
      )
      from public.app_releases r
      where r.channel = 'pwa'
    ), '[]'::jsonb),
    'testers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'aas_user_id', p.aas_user_id,
          'enabled', t.enabled,
          'created_at', t.created_at,
          'updated_at', t.updated_at
        )
        order by p.aas_user_id
      )
      from public.app_release_testers t
      join public.profiles p on p.id = t.user_id
      where p.role = 'user'
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.admin_create_app_release_v2(
  p_version text,
  p_title text,
  p_notes text,
  p_update_notes text,
  p_fix_notes text,
  p_update_kind text,
  p_build_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_existing_candidate uuid;
  v_release public.app_releases%rowtype;
begin
  if not private.is_active_admin() then
    raise exception 'active admin required' using errcode = '42501';
  end if;

  p_version := btrim(coalesce(p_version, ''));
  p_title := btrim(coalesce(p_title, ''));
  p_notes := btrim(coalesce(p_notes, ''));
  p_update_notes := btrim(coalesce(p_update_notes, ''));
  p_fix_notes := btrim(coalesce(p_fix_notes, ''));
  p_build_key := btrim(coalesce(p_build_key, ''));
  p_update_kind := lower(btrim(coalesce(p_update_kind, 'optional')));

  if p_version !~ '^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$' then
    raise exception 'invalid release version' using errcode = '22023';
  end if;
  if char_length(p_title) < 1 or char_length(p_title) > 120 then
    raise exception 'invalid release title' using errcode = '22023';
  end if;
  if char_length(p_notes) > 4000 then
    raise exception 'release notes too long' using errcode = '22023';
  end if;
  if char_length(p_update_notes) > 6000 then
    raise exception 'update notes too long' using errcode = '22023';
  end if;
  if char_length(p_fix_notes) > 6000 then
    raise exception 'fix notes too long' using errcode = '22023';
  end if;
  if p_update_kind not in ('optional','required') then
    raise exception 'invalid update kind' using errcode = '22023';
  end if;
  if p_build_key !~ '^[0-9A-Za-z._-]{3,120}$' then
    raise exception 'invalid build key' using errcode = '22023';
  end if;

  select c.candidate_release_id into v_existing_candidate
  from public.app_release_channels c
  where c.channel = 'pwa'
  for update;

  if v_existing_candidate is not null then
    update public.app_releases
    set status = 'retired', retired_at = now()
    where id = v_existing_candidate
      and status = 'candidate';
  end if;

  insert into public.app_releases (
    channel, version, title, notes, update_notes, fix_notes,
    status, update_kind, build_key, created_by
  )
  values (
    'pwa', p_version, p_title, p_notes, p_update_notes, p_fix_notes,
    'candidate', p_update_kind, p_build_key, v_admin
  )
  returning * into v_release;

  update public.app_release_channels
  set candidate_release_id = v_release.id,
      candidate_stage = 'admin',
      updated_by = v_admin,
      updated_at = now()
  where channel = 'pwa';

  insert into public.app_release_audit (
    actor_user_id, action, release_id, metadata
  )
  values (
    v_admin,
    'candidate_created',
    v_release.id,
    jsonb_build_object(
      'candidate_stage', 'admin',
      'has_update_notes', p_update_notes <> '',
      'has_fix_notes', p_fix_notes <> ''
    )
  );

  return public.admin_list_app_releases();
end;
$function$;

revoke all on function public.admin_create_app_release_v2(text,text,text,text,text,text,text) from public, anon;
grant execute on function public.admin_create_app_release_v2(text,text,text,text,text,text,text) to authenticated;

comment on column public.app_releases.update_notes is
'Administrator-facing summary of features, improvements, and update content included in this release.';
comment on column public.app_releases.fix_notes is
'Administrator-facing summary of bug fixes and corrections included in this release.';

commit;
