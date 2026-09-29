-- Phase 63.1: one-time Stable baseline bootstrap for legacy production state.
-- Existing production Cloud Knowledge/Prompt was already visible to ordinary users
-- before Stable snapshots existed. Preserve that exact state once, then use the
-- Phase 63 promotion gate for every subsequent Stable change.

do $migration$
declare
  stable_knowledge_count bigint;
  stable_prompt_count bigint;
  fresh_version bigint;
begin
  select count(*) into stable_knowledge_count
  from public.knowledge_stable_catalog;

  select count(*) into stable_prompt_count
  from public.prompt_optimization_stable_catalog;

  select current_version into fresh_version
  from public.knowledge_refresh_channels
  where channel='fresh';

  if stable_knowledge_count = 0 then
    insert into public.knowledge_stable_catalog (
      key,kind,label,parent_label,aliases,guidance,deliverables,cautions,tasks,
      priority,status,catalog_version,source_urls,source_summary,source_checked_at,promoted_at
    )
    select
      key,kind,label,parent_label,aliases,guidance,deliverables,cautions,tasks,
      priority,status,catalog_version,source_urls,source_summary,source_checked_at,now()
    from public.knowledge_catalog
    where status='active'
    on conflict (key) do nothing;
  end if;

  if stable_prompt_count = 0 then
    insert into public.prompt_optimization_stable_catalog (
      key,provider,plan,task,rules,priority,catalog_version,
      source_urls,source_summary,source_checked_at,status,promoted_at
    )
    select
      key,provider,plan,task,rules,priority,catalog_version,
      source_urls,source_summary,source_checked_at,status,now()
    from public.prompt_optimization_catalog
    where status='active'
    on conflict (key) do nothing;
  end if;

  update public.knowledge_refresh_channels
  set
    current_version = greatest(current_version,coalesce(fresh_version,current_version)),
    last_published_at = coalesce(last_published_at,now()),
    updated_at = now()
  where channel='stable';
end
$migration$;
