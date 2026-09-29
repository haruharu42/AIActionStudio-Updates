-- Add official fallback sources for tasks whose primary provider help pages can block server-side monitoring.
-- Publication remains admin-review gated; these rows only expand monitoring evidence.

insert into public.knowledge_automation_sources
  (source_url,tasks,source_kind,enabled,next_check_at)
values
  ('https://business.x.com/en/help/campaign-measurement-and-analytics/tweet-activity-dashboard',
   array['sidejob_sns','sidejob_video']::text[], 'official_help', true, now()),
  ('https://business.x.com/en/help/ads-policies',
   array['sidejob_sns']::text[], 'official_policy', true, now()),
  ('https://www.post.japanpost.jp/service/send/domestic/delivery/yu-pack/',
   array['sidejob_resale']::text[], 'official_page', true, now())
on conflict (source_url) do update set
  tasks=(
    select array_agg(distinct item order by item)
    from unnest(coalesce(public.knowledge_automation_sources.tasks, array[]::text[]) || excluded.tasks) as item
  ),
  source_kind=excluded.source_kind,
  enabled=true,
  next_check_at=least(public.knowledge_automation_sources.next_check_at, now()),
  updated_at=now();
