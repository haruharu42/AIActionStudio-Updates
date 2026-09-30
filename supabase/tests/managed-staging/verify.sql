-- Managed Staging fixture smoke assertions.
do $verify$
declare
  snapshot jsonb;
begin
  if (select count(*) from public.profiles) <> 0 then
    raise exception 'fixture must not contain profiles';
  end if;
  if (select count(*) from public.knowledge_catalog) <> 0
     or (select count(*) from public.prompt_optimization_catalog) <> 0
     or (select count(*) from public.knowledge_automation_sources) <> 0
     or (select count(*) from public.knowledge_automation_runs) <> 0
     or (select count(*) from public.knowledge_automation_candidates) <> 0 then
    raise exception 'fixture must not contain Knowledge data';
  end if;
  if (select count(*) from public.app_releases) <> 0
     or (select count(*) from public.app_release_deployments) <> 0 then
    raise exception 'fixture must not contain release data';
  end if;
  if (select enabled from public.knowledge_automation_settings where id=1) then
    raise exception 'automation must default OFF';
  end if;
  if (select ai_enrichment_enabled from public.knowledge_automation_settings where id=1) then
    raise exception 'AI enrichment must default OFF';
  end if;
  if exists(select 1 from vault.secrets where name in (
    'aas_knowledge_gemini_api_key','aas_knowledge_worker_token'
  )) then
    raise exception 'fixture must not create secrets';
  end if;
  snapshot := public.get_knowledge_automation_catalog_snapshot();
  if snapshot <> '{"knowledge":[],"prompts":[]}'::jsonb then
    raise exception 'empty catalog snapshot mismatch: %',snapshot;
  end if;
  if not exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='admin_get_knowledge_gemini_free_agent_status'
  ) then
    raise exception 'Gemini migration status RPC missing';
  end if;
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid='public.app_release_deployments'::regclass
      and c.conname='app_release_deployments_run_url_check'
      and pg_get_constraintdef(c.oid) like '%AIActionStudio-Updates%'
      and pg_get_constraintdef(c.oid) like '%AIArticleStudio-Updates%'
  ) then
    raise exception 'dual repository run URL constraint missing';
  end if;
  if has_function_privilege(
    'authenticated','public.reserve_knowledge_gemini_free_call()','EXECUTE'
  ) then
    raise exception 'authenticated must not execute Gemini quota reserve';
  end if;
  if not has_function_privilege(
    'service_role','public.reserve_knowledge_gemini_free_call()','EXECUTE'
  ) then
    raise exception 'service_role must execute Gemini quota reserve';
  end if;
end
$verify$;
