-- AAS in-app notification center + Web Push infrastructure.
-- The VAPID private key is stored separately in Supabase Vault and is never committed.

create table if not exists public.app_notifications (
  id bigint generated always as identity primary key,
  category text not null check (category in ('update','maintenance','knowledge','admin','system')),
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '' check (char_length(body) <= 2000),
  href text not null default '/' check (href ~ '^/'),
  audience text not null default 'all' check (audience in ('all','tester','admin')),
  source_key text unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.app_notification_receipts (
  notification_id bigint not null references public.app_notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id,user_id)
);

create table if not exists public.user_notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default false,
  updates_enabled boolean not null default true,
  maintenance_enabled boolean not null default true,
  knowledge_enabled boolean not null default true,
  admin_messages_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text not null default '',
  enabled boolean not null default true,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_notification_push_deliveries (
  id bigint generated always as identity primary key,
  notification_id bigint not null references public.app_notifications(id) on delete cascade,
  subscription_id bigint not null references public.user_push_subscriptions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0 check (attempts between 0 and 20),
  last_error text not null default '',
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  unique(notification_id,subscription_id)
);

create table if not exists public.notification_push_settings (
  id smallint primary key default 1 check (id=1),
  enabled boolean not null default true,
  project_url text not null,
  worker_token_hash text not null default '',
  vapid_public_key text not null default '',
  vapid_subject text not null default 'https://github.com/haruharu42/AIArticleStudio-Updates',
  updated_at timestamptz not null default now()
);

create index if not exists app_notifications_created_idx on public.app_notifications(created_at desc);
create index if not exists app_notifications_audience_created_idx on public.app_notifications(audience,created_at desc);
create index if not exists app_notification_receipts_user_idx on public.app_notification_receipts(user_id,read_at desc);
create index if not exists user_push_subscriptions_user_idx on public.user_push_subscriptions(user_id,enabled);
create index if not exists app_notification_push_pending_idx on public.app_notification_push_deliveries(status,created_at,id);

alter table public.app_notifications enable row level security;
alter table public.app_notifications force row level security;
alter table public.app_notification_receipts enable row level security;
alter table public.app_notification_receipts force row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.user_notification_preferences force row level security;
alter table public.user_push_subscriptions enable row level security;
alter table public.user_push_subscriptions force row level security;
alter table public.app_notification_push_deliveries enable row level security;
alter table public.app_notification_push_deliveries force row level security;
alter table public.notification_push_settings enable row level security;
alter table public.notification_push_settings force row level security;

revoke all on table public.app_notifications from public,anon,authenticated;
revoke all on table public.app_notification_receipts from public,anon,authenticated;
revoke all on table public.user_notification_preferences from public,anon,authenticated;
revoke all on table public.user_push_subscriptions from public,anon,authenticated;
revoke all on table public.app_notification_push_deliveries from public,anon,authenticated;
revoke all on table public.notification_push_settings from public,anon,authenticated;
revoke all on sequence public.app_notifications_id_seq from public,anon,authenticated;
revoke all on sequence public.user_push_subscriptions_id_seq from public,anon,authenticated;
revoke all on sequence public.app_notification_push_deliveries_id_seq from public,anon,authenticated;

insert into public.notification_push_settings(id,project_url,vapid_public_key)
values (1,'https://nwttfmjsgzpjqqubxbff.supabase.co','BHOt15y0ljQuOpy7Km_u73rOlqZBCRO5sgfMjLMNAj1oiSLvvK77XoDIoSaI_ftuOf83TT7YBoTVT1hHIJtBwdU')
on conflict(id) do update set
  project_url=excluded.project_url,
  vapid_public_key=excluded.vapid_public_key,
  updated_at=now();

do $migration$
declare worker_token text;
begin
  select decrypted_secret into worker_token
  from vault.decrypted_secrets
  where name='aas_notification_push_worker_token'
  limit 1;

  if worker_token is null or worker_token='' then
    worker_token := encode(extensions.gen_random_bytes(32),'hex');
    perform vault.create_secret(
      worker_token,
      'aas_notification_push_worker_token',
      'AAS notification push worker authentication token'
    );
  end if;

  update public.notification_push_settings
  set worker_token_hash=encode(extensions.digest(worker_token,'sha256'),'hex'),
      updated_at=now()
  where id=1;
end
$migration$;

create or replace function private.notification_category_enabled(
  p_category text,
  p_preferences public.user_notification_preferences
)
returns boolean
language sql
immutable
set search_path=''
as $function$
  select case p_category
    when 'update' then p_preferences.updates_enabled
    when 'maintenance' then p_preferences.maintenance_enabled
    when 'knowledge' then p_preferences.knowledge_enabled
    when 'admin' then p_preferences.admin_messages_enabled
    else true
  end;
$function$;

create or replace function private.user_can_receive_notification(
  p_user_id uuid,
  p_notification public.app_notifications
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_role text;
  v_status text;
  v_tester boolean := false;
begin
  select p.role,p.status into v_role,v_status
  from public.profiles p
  where p.id=p_user_id;

  if v_status is distinct from 'active' then return false; end if;
  if v_role='admin' then return true; end if;
  if p_notification.audience='admin' then return false; end if;

  if p_notification.audience='tester' then
    select exists(
      select 1 from public.app_release_testers t
      where t.user_id=p_user_id and t.enabled=true
    ) into v_tester;
    return v_tester;
  end if;

  return p_notification.audience='all';
end;
$function$;

create or replace function public.get_my_notification_preferences()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_pref public.user_notification_preferences%rowtype;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.status='active') then
    raise exception 'active user required' using errcode='42501';
  end if;

  insert into public.user_notification_preferences(user_id)
  values(v_user)
  on conflict(user_id) do nothing;

  select * into v_pref from public.user_notification_preferences where user_id=v_user;

  return jsonb_build_object(
    'in_app_enabled',v_pref.in_app_enabled,
    'push_enabled',v_pref.push_enabled,
    'updates_enabled',v_pref.updates_enabled,
    'maintenance_enabled',v_pref.maintenance_enabled,
    'knowledge_enabled',v_pref.knowledge_enabled,
    'admin_messages_enabled',v_pref.admin_messages_enabled
  );
end;
$function$;

create or replace function public.update_my_notification_preferences(
  p_in_app_enabled boolean,
  p_push_enabled boolean,
  p_updates_enabled boolean,
  p_maintenance_enabled boolean,
  p_knowledge_enabled boolean,
  p_admin_messages_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.status='active') then
    raise exception 'active user required' using errcode='42501';
  end if;

  insert into public.user_notification_preferences(
    user_id,in_app_enabled,push_enabled,updates_enabled,maintenance_enabled,knowledge_enabled,admin_messages_enabled,updated_at
  )
  values(
    v_user,coalesce(p_in_app_enabled,true),coalesce(p_push_enabled,false),
    coalesce(p_updates_enabled,true),coalesce(p_maintenance_enabled,true),
    coalesce(p_knowledge_enabled,true),coalesce(p_admin_messages_enabled,true),now()
  )
  on conflict(user_id) do update set
    in_app_enabled=excluded.in_app_enabled,
    push_enabled=excluded.push_enabled,
    updates_enabled=excluded.updates_enabled,
    maintenance_enabled=excluded.maintenance_enabled,
    knowledge_enabled=excluded.knowledge_enabled,
    admin_messages_enabled=excluded.admin_messages_enabled,
    updated_at=now();

  -- Push preference is account-wide, while browser subscriptions remain device-specific.
  -- Keeping other device subscriptions intact lets the user re-enable Push later without
  -- re-authorizing every previously approved device.
  return public.get_my_notification_preferences();
end;
$function$;

create or replace function public.get_my_app_notifications(
  p_limit integer default 30,
  p_unread_only boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_pref public.user_notification_preferences%rowtype;
  v_limit integer := greatest(1,least(coalesce(p_limit,30),100));
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;

  insert into public.user_notification_preferences(user_id)
  values(v_user)
  on conflict(user_id) do nothing;
  select * into v_pref from public.user_notification_preferences where user_id=v_user;

  if coalesce(v_pref.in_app_enabled,true)=false then
    return jsonb_build_object('unread_count',0,'notifications','[]'::jsonb);
  end if;

  return jsonb_build_object(
    'unread_count',(
      select count(*)
      from public.app_notifications n
      where (n.expires_at is null or n.expires_at>now())
        and private.user_can_receive_notification(v_user,n)
        and private.notification_category_enabled(n.category,v_pref)
        and not exists(
          select 1 from public.app_notification_receipts r
          where r.notification_id=n.id and r.user_id=v_user
        )
    ),
    'notifications',coalesce((
      select jsonb_agg(row_data order by created_at desc)
      from (
        select
          n.created_at,
          jsonb_build_object(
            'id',n.id,
            'category',n.category,
            'title',n.title,
            'body',n.body,
            'href',n.href,
            'audience',n.audience,
            'created_at',n.created_at,
            'read',r.notification_id is not null
          ) as row_data
        from public.app_notifications n
        left join public.app_notification_receipts r
          on r.notification_id=n.id and r.user_id=v_user
        where (n.expires_at is null or n.expires_at>now())
          and private.user_can_receive_notification(v_user,n)
          and private.notification_category_enabled(n.category,v_pref)
          and (coalesce(p_unread_only,false)=false or r.notification_id is null)
        order by n.created_at desc
        limit v_limit
      ) rows
    ),'[]'::jsonb)
  );
end;
$function$;

create or replace function public.mark_my_app_notification_read(p_notification_id bigint)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_notification public.app_notifications%rowtype;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into v_notification from public.app_notifications where id=p_notification_id;
  if v_notification.id is null or not private.user_can_receive_notification(v_user,v_notification) then
    raise exception 'notification not found' using errcode='P0002';
  end if;
  insert into public.app_notification_receipts(notification_id,user_id)
  values(p_notification_id,v_user)
  on conflict(notification_id,user_id) do update set read_at=excluded.read_at;
end;
$function$;

create or replace function public.mark_all_my_app_notifications_read()
returns integer
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_count integer;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  insert into public.app_notification_receipts(notification_id,user_id)
  select n.id,v_user
  from public.app_notifications n
  where (n.expires_at is null or n.expires_at>now())
    and private.user_can_receive_notification(v_user,n)
  on conflict(notification_id,user_id) do nothing;
  get diagnostics v_count=row_count;
  return v_count;
end;
$function$;

create or replace function public.get_notification_push_public_config()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode='42501'; end if;
  return (
    select jsonb_build_object('enabled',s.enabled,'vapid_public_key',s.vapid_public_key)
    from public.notification_push_settings s where s.id=1
  );
end;
$function$;

create or replace function public.register_my_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_key text,
  p_user_agent text default ''
)
returns bigint
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_id bigint;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.status='active') then
    raise exception 'active user required' using errcode='42501';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint)>4096 then
    raise exception 'invalid push endpoint' using errcode='22023';
  end if;
  if coalesce(char_length(p_p256dh),0)<16 or coalesce(char_length(p_auth_key),0)<8 then
    raise exception 'invalid push keys' using errcode='22023';
  end if;

  insert into public.user_push_subscriptions(user_id,endpoint,p256dh,auth_key,user_agent,enabled,last_error,updated_at)
  values(v_user,p_endpoint,left(p_p256dh,512),left(p_auth_key,256),left(coalesce(p_user_agent,''),500),true,'',now())
  on conflict(endpoint) do update set
    user_id=excluded.user_id,
    p256dh=excluded.p256dh,
    auth_key=excluded.auth_key,
    user_agent=excluded.user_agent,
    enabled=true,
    last_error='',
    updated_at=now()
  returning id into v_id;

  insert into public.user_notification_preferences(user_id,push_enabled)
  values(v_user,true)
  on conflict(user_id) do update set push_enabled=true,updated_at=now();

  return v_id;
end;
$function$;

create or replace function public.unregister_my_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  update public.user_push_subscriptions
  set enabled=false,updated_at=now()
  where user_id=v_user and endpoint=p_endpoint;
end;
$function$;

create or replace function public.admin_create_app_notification(
  p_category text,
  p_title text,
  p_body text,
  p_href text default '/',
  p_audience text default 'all'
)
returns bigint
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id bigint;
  v_category text := lower(trim(coalesce(p_category,'')));
  v_audience text := lower(trim(coalesce(p_audience,'')));
begin
  if not private.is_active_admin() then raise exception 'active admin required' using errcode='42501'; end if;
  if v_category not in ('update','maintenance','knowledge','admin','system') then raise exception 'invalid notification category' using errcode='22023'; end if;
  if v_audience not in ('all','tester','admin') then raise exception 'invalid notification audience' using errcode='22023'; end if;
  if trim(coalesce(p_title,''))='' then raise exception 'notification title required' using errcode='22023'; end if;
  if coalesce(p_href,'/') !~ '^/' then raise exception 'notification href must be an app path' using errcode='22023'; end if;

  insert into public.app_notifications(category,title,body,href,audience,created_by)
  values(v_category,left(trim(p_title),160),left(coalesce(p_body,''),2000),left(coalesce(p_href,'/'),500),v_audience,(select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.admin_list_app_notifications(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare v_limit integer := greatest(1,least(coalesce(p_limit,50),200));
begin
  if not private.is_active_admin() then raise exception 'active admin required' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id',n.id,'category',n.category,'title',n.title,'body',n.body,'href',n.href,
        'audience',n.audience,'created_at',n.created_at,'created_by_aas_id',p.aas_user_id
      ) order by n.created_at desc
    )
    from (select * from public.app_notifications order by created_at desc limit v_limit) n
    left join public.profiles p on p.id=n.created_by
  ),'[]'::jsonb);
end;
$function$;

create or replace function public.get_notification_push_worker_config()
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  select jsonb_build_object(
    'enabled',s.enabled,
    'worker_token_hash',s.worker_token_hash,
    'vapid_public_key',s.vapid_public_key,
    'vapid_private_key',coalesce((
      select d.decrypted_secret from vault.decrypted_secrets d
      where d.name='aas_notification_vapid_private_key' limit 1
    ),''),
    'vapid_subject',s.vapid_subject
  )
  from public.notification_push_settings s
  where s.id=1;
$function$;

create or replace function public.claim_notification_push_deliveries(p_limit integer default 100)
returns table(
  delivery_id bigint,subscription_id bigint,endpoint text,p256dh text,auth_key text,
  notification_id bigint,title text,body text,href text
)
language plpgsql
security definer
set search_path=''
as $function$
declare v_limit integer := greatest(1,least(coalesce(p_limit,100),500));
begin
  return query
  with picked as (
    select d.id
    from public.app_notification_push_deliveries d
    join public.user_push_subscriptions s on s.id=d.subscription_id and s.enabled=true
    where d.status='pending'
       or (d.status='processing' and d.claimed_at<now()-interval '10 minutes')
    order by d.id
    for update skip locked
    limit v_limit
  ),
  updated as (
    update public.app_notification_push_deliveries d
    set status='processing',attempts=d.attempts+1,claimed_at=now()
    from picked
    where d.id=picked.id
    returning d.*
  )
  select d.id,s.id,s.endpoint,s.p256dh,s.auth_key,n.id,n.title,n.body,n.href
  from updated d
  join public.user_push_subscriptions s on s.id=d.subscription_id
  join public.app_notifications n on n.id=d.notification_id
  order by d.id;
end;
$function$;

create or replace function public.complete_notification_push_delivery(
  p_delivery_id bigint,
  p_success boolean,
  p_error text default '',
  p_disable_subscription boolean default false
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare v_subscription_id bigint;
begin
  update public.app_notification_push_deliveries
  set status=case when coalesce(p_success,false) then 'sent' else 'failed' end,
      last_error=left(coalesce(p_error,''),1000),
      sent_at=case when coalesce(p_success,false) then now() else sent_at end
  where id=p_delivery_id
  returning subscription_id into v_subscription_id;

  if coalesce(p_disable_subscription,false) and v_subscription_id is not null then
    update public.user_push_subscriptions
    set enabled=false,last_error=left(coalesce(p_error,''),1000),updated_at=now()
    where id=v_subscription_id;
  end if;
end;
$function$;

create or replace function private.invoke_notification_push_worker()
returns bigint
language plpgsql
security definer
set search_path=''
as $function$
declare
  project_url text;
  worker_token text;
  request_id bigint;
begin
  select s.project_url into project_url
  from public.notification_push_settings s where s.id=1 and s.enabled=true;
  if project_url is null then return null; end if;

  select d.decrypted_secret into worker_token
  from vault.decrypted_secrets d
  where d.name='aas_notification_push_worker_token'
  limit 1;
  if worker_token is null or worker_token='' then raise exception 'notification push worker token unavailable'; end if;

  select net.http_post(
    url:=rtrim(project_url,'/') || '/functions/v1/notification-push-worker',
    body:=jsonb_build_object('requested_at',now()),
    headers:=jsonb_build_object('Content-Type','application/json','x-aas-worker-token',worker_token),
    timeout_milliseconds:=60000
  ) into request_id;
  return request_id;
end;
$function$;

create or replace function private.enqueue_notification_push_deliveries()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare queued integer := 0;
begin
  insert into public.app_notification_push_deliveries(notification_id,subscription_id)
  select NEW.id,s.id
  from public.user_push_subscriptions s
  join public.profiles p on p.id=s.user_id and p.status='active'
  join public.user_notification_preferences pref on pref.user_id=s.user_id
  where s.enabled=true
    and pref.push_enabled=true
    and private.notification_category_enabled(NEW.category,pref)
    and private.user_can_receive_notification(s.user_id,NEW)
  on conflict(notification_id,subscription_id) do nothing;

  get diagnostics queued=row_count;
  if queued>0 then perform private.invoke_notification_push_worker(); end if;
  return NEW;
end;
$function$;

drop trigger if exists app_notification_push_enqueue on public.app_notifications;
create trigger app_notification_push_enqueue
after insert on public.app_notifications
for each row execute function private.enqueue_notification_push_deliveries();

create or replace function private.notify_feature_control_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  audience_value text;
  body_value text;
begin
  audience_value := case NEW.rollout_stage when 'public' then 'all' when 'tester' then 'tester' else 'admin' end;

  if NEW.maintenance_mode is distinct from OLD.maintenance_mode then
    if NEW.maintenance_mode then
      body_value := coalesce(nullif(NEW.maintenance_message,''),NEW.title || ' は現在修正・点検のため一時停止しています。');
      insert into public.app_notifications(category,title,body,href,audience,source_key,created_by)
      values('maintenance',NEW.title || '：メンテナンス中',body_value,coalesce(NEW.route_prefix,'/'),audience_value,'feature-maintenance-start:'||NEW.feature_key||':'||txid_current(),NEW.updated_by);
    else
      insert into public.app_notifications(category,title,body,href,audience,source_key,created_by)
      values('maintenance',NEW.title || '：メンテナンス終了','メンテナンスが終了し、設定された公開範囲で利用を再開しました。',coalesce(NEW.route_prefix,'/'),audience_value,'feature-maintenance-end:'||NEW.feature_key||':'||txid_current(),NEW.updated_by);
    end if;
  elsif NEW.rollout_stage is distinct from OLD.rollout_stage then
    insert into public.app_notifications(category,title,body,href,audience,source_key,created_by)
    values(
      'update',
      NEW.title || case NEW.rollout_stage when 'public' then ' を公開しました' when 'tester' then ' をテスト公開しました' else ' を管理者確認へ戻しました' end,
      case NEW.rollout_stage
        when 'public' then '動作確認済みの機能を全一般ユーザーへ公開しました。'
        when 'tester' then '指定した一般ユーザーテスターで動作確認できる状態になりました。'
        else '一般ユーザーへの公開を停止し、管理者確認段階へ戻しました。'
      end,
      coalesce(NEW.route_prefix,'/'),
      audience_value,
      'feature-stage:'||NEW.feature_key||':'||NEW.rollout_stage||':'||txid_current(),
      NEW.updated_by
    );
  end if;
  return NEW;
end;
$function$;

drop trigger if exists app_feature_control_notification on public.app_feature_controls;
create trigger app_feature_control_notification
after update of rollout_stage,maintenance_mode on public.app_feature_controls
for each row execute function private.notify_feature_control_change();

create or replace function private.notify_app_release_published()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if NEW.status='published' and OLD.status is distinct from 'published' then
    insert into public.app_notifications(category,title,body,href,audience,source_key)
    values('update','AAS v'||NEW.version||' を公開しました',coalesce(nullif(NEW.notes,''),NEW.title),'/', 'all','app-release-published:'||NEW.id::text)
    on conflict(source_key) do nothing;
  end if;
  return NEW;
end;
$function$;

drop trigger if exists app_release_published_notification on public.app_releases;
create trigger app_release_published_notification
after update of status on public.app_releases
for each row execute function private.notify_app_release_published();

create or replace function private.notify_knowledge_refresh_completed()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if NEW.status='completed' and OLD.status is distinct from 'completed' then
    insert into public.app_notifications(category,title,body,href,audience,source_key)
    values(
      'knowledge',
      'AAS Knowledge が更新されました',
      case NEW.channel when 'stable' then '検証済みKnowledgeの安定版が更新されました。' else '新しいKnowledge / Prompt更新がAASへ反映されました。' end,
      '/notifications',
      'all',
      'knowledge-refresh-completed:'||NEW.id::text
    )
    on conflict(source_key) do nothing;
  end if;
  return NEW;
end;
$function$;

drop trigger if exists knowledge_refresh_completed_notification on public.knowledge_refresh_requests;
create trigger knowledge_refresh_completed_notification
after update of status on public.knowledge_refresh_requests
for each row execute function private.notify_knowledge_refresh_completed();

insert into public.app_feature_controls(
  feature_key,category,title,description,route_prefix,exact_match,rollout_stage,maintenance_mode,admin_only,sort_order
)
values(
  'admin-notifications','管理者機能','通知管理','全体・テスター・管理者向け通知の送信と履歴確認。',
  '/admin/notifications',true,'admin',false,true,1150
)
on conflict(feature_key) do update set
  category=excluded.category,
  title=excluded.title,
  description=excluded.description,
  route_prefix=excluded.route_prefix,
  exact_match=excluded.exact_match,
  rollout_stage='admin',
  admin_only=true,
  sort_order=excluded.sort_order,
  updated_at=now();

revoke all on function private.notification_category_enabled(text,public.user_notification_preferences) from public,anon,authenticated;
revoke all on function private.user_can_receive_notification(uuid,public.app_notifications) from public,anon,authenticated;
revoke all on function private.invoke_notification_push_worker() from public,anon,authenticated;
revoke all on function private.enqueue_notification_push_deliveries() from public,anon,authenticated;
revoke all on function private.notify_feature_control_change() from public,anon,authenticated;
revoke all on function private.notify_app_release_published() from public,anon,authenticated;
revoke all on function private.notify_knowledge_refresh_completed() from public,anon,authenticated;

revoke all on function public.get_my_notification_preferences() from public,anon;
revoke all on function public.update_my_notification_preferences(boolean,boolean,boolean,boolean,boolean,boolean) from public,anon;
revoke all on function public.get_my_app_notifications(integer,boolean) from public,anon;
revoke all on function public.mark_my_app_notification_read(bigint) from public,anon;
revoke all on function public.mark_all_my_app_notifications_read() from public,anon;
revoke all on function public.get_notification_push_public_config() from public,anon;
revoke all on function public.register_my_push_subscription(text,text,text,text) from public,anon;
revoke all on function public.unregister_my_push_subscription(text) from public,anon;
revoke all on function public.admin_create_app_notification(text,text,text,text,text) from public,anon;
revoke all on function public.admin_list_app_notifications(integer) from public,anon;
revoke all on function public.get_notification_push_worker_config() from public,anon,authenticated;
revoke all on function public.claim_notification_push_deliveries(integer) from public,anon,authenticated;
revoke all on function public.complete_notification_push_delivery(bigint,boolean,text,boolean) from public,anon,authenticated;

grant execute on function public.get_my_notification_preferences() to authenticated;
grant execute on function public.update_my_notification_preferences(boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.get_my_app_notifications(integer,boolean) to authenticated;
grant execute on function public.mark_my_app_notification_read(bigint) to authenticated;
grant execute on function public.mark_all_my_app_notifications_read() to authenticated;
grant execute on function public.get_notification_push_public_config() to authenticated;
grant execute on function public.register_my_push_subscription(text,text,text,text) to authenticated;
grant execute on function public.unregister_my_push_subscription(text) to authenticated;
grant execute on function public.admin_create_app_notification(text,text,text,text,text) to authenticated;
grant execute on function public.admin_list_app_notifications(integer) to authenticated;
grant execute on function public.get_notification_push_worker_config() to service_role;
grant execute on function public.claim_notification_push_deliveries(integer) to service_role;
grant execute on function public.complete_notification_push_delivery(bigint,boolean,text,boolean) to service_role;

do $cron$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    begin perform cron.unschedule('aas-notification-push-worker-5m'); exception when others then null; end;
    perform cron.schedule('aas-notification-push-worker-5m','*/5 * * * *','select private.invoke_notification_push_worker();');
  end if;
end
$cron$;
