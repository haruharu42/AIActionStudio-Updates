begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'promotion-assets',
  'promotion-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.promotion_content_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null,
  body_markdown text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotion_content_drafts_channel_check
    check (channel in ('note','brain','tips','x','threads','instagram')),
  constraint promotion_content_drafts_body_length_check
    check (char_length(body_markdown) <= 200000),
  constraint promotion_content_drafts_user_channel_key unique (user_id, channel),
  constraint promotion_content_drafts_id_user_key unique (id, user_id)
);

create table if not exists public.promotion_content_assets (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null,
  user_id uuid not null,
  status text not null default 'pending_upload',
  storage_bucket text not null default 'promotion-assets',
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sort_order integer not null default 0,
  caption text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  uploaded_at timestamptz,
  delete_requested_at timestamptz,
  constraint promotion_content_assets_draft_owner_fkey
    foreign key (draft_id, user_id)
    references public.promotion_content_drafts(id, user_id)
    on delete cascade,
  constraint promotion_content_assets_status_check
    check (status in ('pending_upload','ready','delete_pending')),
  constraint promotion_content_assets_storage_bucket_check
    check (storage_bucket = 'promotion-assets'),
  constraint promotion_content_assets_filename_check
    check (char_length(trim(original_filename)) between 1 and 255),
  constraint promotion_content_assets_mime_check
    check (mime_type in ('image/png','image/jpeg','image/webp')),
  constraint promotion_content_assets_size_check
    check (size_bytes between 1 and 10485760),
  constraint promotion_content_assets_sort_check
    check (sort_order between 0 and 1000),
  constraint promotion_content_assets_caption_check
    check (char_length(caption) <= 1000),
  constraint promotion_content_assets_path_check
    check (
      char_length(storage_path) between 1 and 320
      and storage_path = concat(
        user_id::text, '/', draft_id::text, '/', id::text,
        case mime_type
          when 'image/png' then '.png'
          when 'image/jpeg' then '.jpg'
          when 'image/webp' then '.webp'
          else ''
        end
      )
    ),
  constraint promotion_content_assets_state_check
    check (
      (status='pending_upload' and uploaded_at is null and delete_requested_at is null)
      or
      (status='ready' and uploaded_at is not null and delete_requested_at is null)
      or
      (status='delete_pending' and uploaded_at is not null and delete_requested_at is not null)
    )
);

create unique index if not exists promotion_content_assets_storage_path_key
  on public.promotion_content_assets(storage_bucket, storage_path);
create index if not exists promotion_content_assets_user_draft_idx
  on public.promotion_content_assets(user_id, draft_id);
create index if not exists promotion_content_assets_draft_status_idx
  on public.promotion_content_assets(draft_id, status);

alter table public.promotion_content_drafts enable row level security;
alter table public.promotion_content_drafts force row level security;
alter table public.promotion_content_assets enable row level security;
alter table public.promotion_content_assets force row level security;

revoke all on table public.promotion_content_drafts from public, anon, authenticated;
revoke all on table public.promotion_content_assets from public, anon, authenticated;

create or replace function public.admin_get_promotion_content_workspace(p_channel text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_channel text := lower(trim(coalesce(p_channel,'')));
  v_draft public.promotion_content_drafts%rowtype;
begin
  if v_user is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;
  if v_channel not in ('note','brain','tips','x','threads','instagram') then
    raise exception 'invalid promotion channel' using errcode='22023';
  end if;

  select *
  into v_draft
  from public.promotion_content_drafts d
  where d.user_id=v_user and d.channel=v_channel;

  return jsonb_build_object(
    'draft',
      case when v_draft.id is null then null else jsonb_build_object(
        'id', v_draft.id,
        'channel', v_draft.channel,
        'body_markdown', v_draft.body_markdown,
        'created_at', v_draft.created_at,
        'updated_at', v_draft.updated_at
      ) end,
    'assets',
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id,
          'draft_id', a.draft_id,
          'status', a.status,
          'storage_bucket', a.storage_bucket,
          'storage_path', a.storage_path,
          'original_filename', a.original_filename,
          'mime_type', a.mime_type,
          'size_bytes', a.size_bytes,
          'sort_order', a.sort_order,
          'caption', a.caption,
          'created_at', a.created_at,
          'updated_at', a.updated_at,
          'uploaded_at', a.uploaded_at
        ) order by a.sort_order, a.created_at)
        from public.promotion_content_assets a
        where a.user_id=v_user
          and a.draft_id=v_draft.id
          and a.status='ready'
      ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.admin_save_promotion_content_draft(
  p_channel text,
  p_body_markdown text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_channel text := lower(trim(coalesce(p_channel,'')));
  v_body text := coalesce(p_body_markdown,'');
  v_id uuid;
begin
  if v_user is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;
  if v_channel not in ('note','brain','tips','x','threads','instagram') then
    raise exception 'invalid promotion channel' using errcode='22023';
  end if;
  if char_length(v_body) > 200000 then
    raise exception 'promotion draft too long' using errcode='22023';
  end if;

  insert into public.promotion_content_drafts(user_id, channel, body_markdown)
  values (v_user, v_channel, v_body)
  on conflict (user_id, channel)
  do update set body_markdown=excluded.body_markdown, updated_at=now()
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.admin_prepare_promotion_content_asset(
  p_channel text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint,
  p_caption text default ''
)
returns table (
  asset_id uuid,
  draft_id uuid,
  storage_bucket text,
  storage_path text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_channel text := lower(trim(coalesce(p_channel,'')));
  v_mime text := lower(trim(coalesce(p_mime_type,'')));
  v_filename text := trim(coalesce(p_original_filename,''));
  v_caption text := trim(coalesce(p_caption,''));
  v_draft_id uuid;
  v_asset_id uuid := gen_random_uuid();
  v_ext text;
  v_path text;
  v_sort integer;
begin
  if v_user is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;
  if v_channel not in ('note','brain','tips','x','threads','instagram') then
    raise exception 'invalid promotion channel' using errcode='22023';
  end if;
  if v_mime not in ('image/png','image/jpeg','image/webp') then
    raise exception 'invalid promotion image type' using errcode='22023';
  end if;
  if char_length(v_filename) < 1 or char_length(v_filename) > 255 then
    raise exception 'invalid promotion image filename' using errcode='22023';
  end if;
  if p_size_bytes is null or p_size_bytes < 1 or p_size_bytes > 10485760 then
    raise exception 'invalid promotion image size' using errcode='22023';
  end if;
  if char_length(v_caption) > 1000 then
    raise exception 'promotion image caption too long' using errcode='22023';
  end if;

  insert into public.promotion_content_drafts(user_id, channel, body_markdown)
  values (v_user, v_channel, '')
  on conflict (user_id, channel)
  do update set updated_at=public.promotion_content_drafts.updated_at
  returning id into v_draft_id;

  select coalesce(max(a.sort_order), -1) + 1
  into v_sort
  from public.promotion_content_assets a
  where a.user_id=v_user and a.draft_id=v_draft_id and a.status <> 'delete_pending';

  v_ext := case v_mime
    when 'image/png' then '.png'
    when 'image/jpeg' then '.jpg'
    when 'image/webp' then '.webp'
  end;
  v_path := concat(v_user::text,'/',v_draft_id::text,'/',v_asset_id::text,v_ext);

  insert into public.promotion_content_assets(
    id,draft_id,user_id,status,storage_bucket,storage_path,original_filename,mime_type,size_bytes,sort_order,caption
  ) values (
    v_asset_id,v_draft_id,v_user,'pending_upload','promotion-assets',v_path,v_filename,v_mime,p_size_bytes,v_sort,v_caption
  );

  return query select v_asset_id,v_draft_id,'promotion-assets'::text,v_path;
end;
$function$;

create or replace function public.admin_finalize_promotion_content_asset(p_asset_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_asset public.promotion_content_assets%rowtype;
  v_meta jsonb;
  v_size bigint;
  v_mime text;
begin
  if v_user is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;

  select * into v_asset
  from public.promotion_content_assets a
  where a.id=p_asset_id and a.user_id=v_user
  for update;
  if not found then raise exception 'promotion asset not found' using errcode='P0002'; end if;
  if v_asset.status <> 'pending_upload' then
    raise exception 'promotion asset is not pending' using errcode='22023';
  end if;

  select o.metadata into v_meta
  from storage.objects o
  where o.bucket_id=v_asset.storage_bucket
    and o.name=v_asset.storage_path
    and coalesce(o.is_delete_marker,false)=false;

  if not found then raise exception using errcode='P0001', message='storage_object_missing'; end if;

  if coalesce(v_meta->>'size','') !~ '^[0-9]+$' then
    raise exception using errcode='P0001', message='storage_object_metadata_invalid';
  end if;
  v_size := (v_meta->>'size')::bigint;
  v_mime := lower(coalesce(v_meta->>'mimetype',''));

  if v_size < 1 or v_size > 10485760 then
    raise exception using errcode='P0001', message='storage_object_size_invalid';
  end if;
  if v_mime <> v_asset.mime_type then
    raise exception using errcode='P0001', message='storage_object_mime_mismatch';
  end if;

  update public.promotion_content_assets a
  set status='ready', size_bytes=v_size, uploaded_at=now(), updated_at=now()
  where a.id=v_asset.id and a.user_id=v_user and a.status='pending_upload'
  returning * into v_asset;

  return jsonb_build_object(
    'id',v_asset.id,'draft_id',v_asset.draft_id,'status',v_asset.status,
    'storage_bucket',v_asset.storage_bucket,'storage_path',v_asset.storage_path,
    'original_filename',v_asset.original_filename,'mime_type',v_asset.mime_type,
    'size_bytes',v_asset.size_bytes,'sort_order',v_asset.sort_order,'caption',v_asset.caption,
    'created_at',v_asset.created_at,'updated_at',v_asset.updated_at,'uploaded_at',v_asset.uploaded_at
  );
end;
$function$;

create or replace function public.admin_update_promotion_content_asset(
  p_asset_id uuid,
  p_caption text,
  p_sort_order integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_caption text := trim(coalesce(p_caption,''));
begin
  if v_user is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;
  if char_length(v_caption) > 1000 then
    raise exception 'promotion image caption too long' using errcode='22023';
  end if;
  if p_sort_order is null or p_sort_order < 0 or p_sort_order > 1000 then
    raise exception 'invalid promotion image sort order' using errcode='22023';
  end if;

  update public.promotion_content_assets a
  set caption=v_caption, sort_order=p_sort_order, updated_at=now()
  where a.id=p_asset_id and a.user_id=v_user and a.status='ready';

  if not found then raise exception 'promotion asset not found' using errcode='P0002'; end if;
end;
$function$;

create or replace function public.admin_begin_delete_promotion_content_asset(p_asset_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_asset public.promotion_content_assets%rowtype;
begin
  if v_user is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;

  update public.promotion_content_assets a
  set status='delete_pending', delete_requested_at=now(), updated_at=now()
  where a.id=p_asset_id and a.user_id=v_user and a.status='ready'
  returning * into v_asset;

  if v_asset.id is null then raise exception 'promotion asset not found' using errcode='P0002'; end if;

  return jsonb_build_object('id',v_asset.id,'storage_bucket',v_asset.storage_bucket,'storage_path',v_asset.storage_path);
end;
$function$;

create or replace function public.admin_finalize_delete_promotion_content_asset(p_asset_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_asset public.promotion_content_assets%rowtype;
  v_id uuid;
begin
  if v_user is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;

  select * into v_asset
  from public.promotion_content_assets a
  where a.id=p_asset_id and a.user_id=v_user and a.status='delete_pending'
  for update;
  if not found then raise exception 'promotion asset not found' using errcode='P0002'; end if;

  if exists (
    select 1 from storage.objects o
    where o.bucket_id=v_asset.storage_bucket and o.name=v_asset.storage_path
      and coalesce(o.is_delete_marker,false)=false
  ) then
    raise exception using errcode='P0001', message='storage_object_still_exists';
  end if;

  delete from public.promotion_content_assets a
  where a.id=v_asset.id and a.user_id=v_user and a.status='delete_pending'
  returning a.id into v_id;

  return v_id;
end;
$function$;

create or replace function public.admin_cancel_pending_promotion_content_asset(p_asset_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;

  delete from public.promotion_content_assets a
  where a.id=p_asset_id and a.user_id=v_user and a.status='pending_upload'
  returning a.id into v_id;

  if v_id is null then raise exception 'promotion asset not found' using errcode='P0002'; end if;
  return v_id;
end;
$function$;

revoke all on function public.admin_get_promotion_content_workspace(text) from public, anon;
revoke all on function public.admin_save_promotion_content_draft(text,text) from public, anon;
revoke all on function public.admin_prepare_promotion_content_asset(text,text,text,bigint,text) from public, anon;
revoke all on function public.admin_finalize_promotion_content_asset(uuid) from public, anon;
revoke all on function public.admin_update_promotion_content_asset(uuid,text,integer) from public, anon;
revoke all on function public.admin_begin_delete_promotion_content_asset(uuid) from public, anon;
revoke all on function public.admin_finalize_delete_promotion_content_asset(uuid) from public, anon;
revoke all on function public.admin_cancel_pending_promotion_content_asset(uuid) from public, anon;

grant execute on function public.admin_get_promotion_content_workspace(text) to authenticated;
grant execute on function public.admin_save_promotion_content_draft(text,text) to authenticated;
grant execute on function public.admin_prepare_promotion_content_asset(text,text,text,bigint,text) to authenticated;
grant execute on function public.admin_finalize_promotion_content_asset(uuid) to authenticated;
grant execute on function public.admin_update_promotion_content_asset(uuid,text,integer) to authenticated;
grant execute on function public.admin_begin_delete_promotion_content_asset(uuid) to authenticated;
grant execute on function public.admin_finalize_delete_promotion_content_asset(uuid) to authenticated;
grant execute on function public.admin_cancel_pending_promotion_content_asset(uuid) to authenticated;

drop policy if exists promotion_assets_storage_insert_prepared on storage.objects;
create policy promotion_assets_storage_insert_prepared
on storage.objects
for insert
to authenticated
with check (
  bucket_id='promotion-assets'
  and (select private.is_active_admin())
  and exists (
    select 1 from public.promotion_content_assets a
    where a.user_id=(select auth.uid())
      and a.status='pending_upload'
      and a.storage_bucket=storage.objects.bucket_id
      and a.storage_path=storage.objects.name
  )
);

drop policy if exists promotion_assets_storage_select_ready on storage.objects;
create policy promotion_assets_storage_select_ready
on storage.objects
for select
to authenticated
using (
  bucket_id='promotion-assets'
  and (select private.is_active_admin())
  and exists (
    select 1 from public.promotion_content_assets a
    where a.user_id=(select auth.uid())
      and a.status in ('ready','delete_pending')
      and a.storage_bucket=storage.objects.bucket_id
      and a.storage_path=storage.objects.name
  )
);

drop policy if exists promotion_assets_storage_delete_pending on storage.objects;
create policy promotion_assets_storage_delete_pending
on storage.objects
for delete
to authenticated
using (
  bucket_id='promotion-assets'
  and (select private.is_active_admin())
  and exists (
    select 1 from public.promotion_content_assets a
    where a.user_id=(select auth.uid())
      and a.status='delete_pending'
      and a.storage_bucket=storage.objects.bucket_id
      and a.storage_path=storage.objects.name
  )
);

comment on table public.promotion_content_drafts is
'Administrator-owned promotion final-copy workspace stored in AAS cloud, separated by destination channel.';
comment on table public.promotion_content_assets is
'Private screenshot assets attached to promotion drafts and stored in Supabase Storage.';

commit;
