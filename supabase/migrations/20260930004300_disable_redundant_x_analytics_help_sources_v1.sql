-- Stop repeatedly blocked X Help analytics sources only when the healthy X Business
-- Post/Video Activity Dashboard fallback is enabled and covers the same tasks.
-- Rows are retained for audit history and can be re-enabled from the admin UI.

update public.knowledge_automation_sources source
set
  enabled=false,
  updated_at=now()
where source.source_url in (
  'https://help.x.com/ja/using-x/media-studio-analytics',
  'https://help.x.com/ja/using-x/view-counts'
)
  and source.last_http_status=403
  and source.consecutive_failures>=3
  and exists (
    select 1
    from public.knowledge_automation_sources fallback
    where fallback.source_url='https://business.x.com/en/help/campaign-measurement-and-analytics/tweet-activity-dashboard'
      and fallback.enabled=true
      and fallback.last_http_status between 200 and 399
      and fallback.consecutive_failures=0
      and fallback.tasks @> source.tasks
  );
