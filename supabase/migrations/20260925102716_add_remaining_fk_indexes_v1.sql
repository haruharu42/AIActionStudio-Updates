begin;

create index if not exists idx_creator_membership_plans_knowledge_channel
  on public.creator_membership_plans (knowledge_channel);

create index if not exists idx_creator_mission_progress_mission_code
  on public.creator_mission_progress (mission_code);

create index if not exists idx_creator_ranking_snapshots_user_id
  on public.creator_ranking_snapshots (user_id);

create index if not exists idx_knowledge_source_recheck_receipts_checked_by
  on public.knowledge_source_recheck_receipts (checked_by);

create index if not exists idx_prompt_optimization_catalog_created_by
  on public.prompt_optimization_catalog (created_by);

commit;
