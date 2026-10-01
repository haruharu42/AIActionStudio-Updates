-- Create one in-app update notification when a PWA release becomes published.
-- This trigger covers the formal deployment finalizer and the legacy admin publish RPC.
-- source_key makes the notification idempotent per release.

create or replace function private.notify_published_app_release()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.channel <> 'pwa'
     or new.status <> 'published'
     or old.status = 'published' then
    return new;
  end if;

  insert into public.app_notifications (
    category,
    title,
    body,
    href,
    audience,
    source_key,
    created_by
  )
  values (
    'update',
    left('v' || new.version || ' アップデートが利用できます', 160),
    left(
      '「' || new.title || '」を公開しました。内容を確認してアップデートしてください。',
      2000
    ),
    '/?update=' || new.id::text,
    'all',
    'release-public:' || new.id::text,
    new.created_by
  )
  on conflict (source_key) do nothing;

  return new;
end;
$function$;

drop trigger if exists app_release_public_update_notification
  on public.app_releases;

create trigger app_release_public_update_notification
after update of status on public.app_releases
for each row
when (new.status = 'published' and old.status is distinct from new.status)
execute function private.notify_published_app_release();
