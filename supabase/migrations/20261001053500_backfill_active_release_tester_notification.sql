-- Backfill one in-app notification for the currently active tester-stage PWA candidate.
-- This covers candidates promoted before 20261001051000_notify_release_testers_on_promotion.sql
-- was applied. The unique source_key keeps the backfill idempotent.

insert into public.app_notifications (
  category,
  title,
  body,
  href,
  audience,
  source_key,
  created_by
)
select
  'update',
  left('v' || r.version || ' テスター確認を開始しました', 160),
  left(
    '候補版 v' || r.version || '「' || r.title ||
    '」が指定テスター向けに公開されています。Preview PWAで主要導線と通知センターを確認してください。',
    2000
  ),
  '/',
  'tester',
  'release-tester-backfill:' || r.id::text,
  c.updated_by
from public.app_release_channels c
join public.app_releases r
  on r.id = c.candidate_release_id
where c.channel = 'pwa'
  and c.candidate_stage = 'tester'
  and r.status = 'candidate'
on conflict (source_key) do nothing;
