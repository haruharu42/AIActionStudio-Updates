-- Upgrade the existing public-release notification hook instead of adding
-- a second trigger. This keeps one notification per release and deep-links
-- users into the explicit update-confirmation flow.

drop trigger if exists app_release_public_update_notification
  on public.app_releases;

drop function if exists private.notify_published_app_release();

create or replace function private.notify_app_release_published()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status = 'published'
     and old.status is distinct from 'published' then
    insert into public.app_notifications (
      category,
      title,
      body,
      href,
      audience,
      source_key
    )
    values (
      'update',
      left('AAS v' || new.version || ' を公開しました', 160),
      left(coalesce(nullif(new.notes, ''), new.title), 2000),
      '/?update=' || new.id::text,
      'all',
      'app-release-published:' || new.id::text
    )
    on conflict (source_key) do nothing;
  end if;

  return new;
end;
$function$;
