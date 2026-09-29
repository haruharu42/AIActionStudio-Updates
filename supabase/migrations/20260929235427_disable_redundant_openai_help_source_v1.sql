-- The current developers.openai.com prompt-engineering guide is already monitored and healthy.
-- Keep this repeated-403 Help Center row as audit history, but stop scheduling it.

update public.knowledge_automation_sources
set
  enabled=false,
  updated_at=now()
where source_url='https://help.openai.com/en/articles/10032626-prompt-engineering-best-practices-for-chatgpt'
  and last_http_status=403
  and consecutive_failures>=3;
