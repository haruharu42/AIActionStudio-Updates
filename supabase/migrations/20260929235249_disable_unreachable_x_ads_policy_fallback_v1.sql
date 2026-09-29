-- Keep the failed X Ads policy fallback as audit history, but stop scheduling it.
-- The X Business analytics fallback remains enabled and reachable.

update public.knowledge_automation_sources
set
  enabled=false,
  updated_at=now()
where source_url='https://business.x.com/en/help/ads-policies'
  and last_http_status=403;
