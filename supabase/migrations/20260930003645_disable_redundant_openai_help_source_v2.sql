-- Re-apply the retirement now that the source has accumulated repeated 403 failures.
-- Worker v9 preserves enabled=false during catalog/source synchronization.

update public.knowledge_automation_sources
set
  enabled=false,
  updated_at=now()
where source_url='https://help.openai.com/en/articles/10032626-prompt-engineering-best-practices-for-chatgpt'
  and last_http_status=403
  and consecutive_failures>=3;
