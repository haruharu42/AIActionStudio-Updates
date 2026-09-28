insert into public.knowledge_automation_sources
  (source_url,tasks,source_kind,enabled,next_check_at)
values
  ('https://developers.openai.com/api/docs/changelog',
   array['all']::text[],
   'official_changelog',true,now()),
  ('https://docs.anthropic.com/en/docs/about-claude/model-deprecations',
   array['all']::text[],
   'official_changelog',true,now()),
  ('https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/prompt-templates-and-variables',
   array['all']::text[],
   'official_docs',true,now())
on conflict (source_url) do update set
  tasks=excluded.tasks,
  source_kind=excluded.source_kind,
  enabled=true,
  next_check_at=least(public.knowledge_automation_sources.next_check_at,now()),
  updated_at=now();
