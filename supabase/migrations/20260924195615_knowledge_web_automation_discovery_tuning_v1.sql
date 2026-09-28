-- Keep new-page discovery precise: normal official pages are change monitors.
-- Changelog / release hubs surface a new candidate when their own content changes.

update public.knowledge_automation_settings
set max_discovered_links_per_source=0,
    updated_at=now()
where id=1;

update public.knowledge_automation_sources
set source_kind = case
  when source_url ~* '(changelog|release[-_/ ]?notes|releases)' then 'official_changelog'
  when source_url ~* '(terms|policy|policies|rules|legal|privacy)' then 'official_policy'
  when source_url ~* '(help|support|guide)' then 'official_help'
  when source_url ~* '(docs|developer|developers)' then 'official_docs'
  else source_kind
end,
updated_at=now();

insert into public.knowledge_automation_sources
  (source_url,tasks,source_kind,enabled,next_check_at)
values
  ('https://ai.google.dev/gemini-api/docs/changelog',
   array['sidejob_research','sidejob_efficiency','sidejob_content']::text[],
   'official_changelog',true,now()+interval '24 hours')
on conflict (source_url) do update set
  tasks=excluded.tasks,
  source_kind='official_changelog',
  enabled=true,
  updated_at=now();
