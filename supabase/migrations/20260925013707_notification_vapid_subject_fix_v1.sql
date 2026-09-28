-- Use a stable HTTPS VAPID contact URI for Push service compatibility.
alter table public.notification_push_settings
  alter column vapid_subject set default 'https://github.com/haruharu42/AIArticleStudio-Updates';

update public.notification_push_settings
set vapid_subject='https://github.com/haruharu42/AIArticleStudio-Updates',
    updated_at=now()
where id=1;
