create index if not exists knowledge_automation_runs_requested_by_idx
  on public.knowledge_automation_runs (requested_by)
  where requested_by is not null;

create index if not exists knowledge_automation_candidates_run_idx
  on public.knowledge_automation_candidates (run_id)
  where run_id is not null;

create index if not exists knowledge_automation_candidates_source_idx
  on public.knowledge_automation_candidates (source_id)
  where source_id is not null;

create index if not exists knowledge_automation_candidates_reviewed_by_idx
  on public.knowledge_automation_candidates (reviewed_by)
  where reviewed_by is not null;
