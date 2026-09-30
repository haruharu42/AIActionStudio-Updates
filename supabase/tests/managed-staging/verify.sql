-- Managed Staging fixture smoke assertions.
do $verify$
declare
  snapshot jsonb;
  internal_table text;
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

  foreach internal_table in array array[
    'knowledge_automation_settings',
    'knowledge_catalog',
    'prompt_optimization_catalog',
    'knowledge_automation_sources',
    'knowledge_automation_runs',
    'knowledge_automation_candidates',
    'app_releases',
    'app_release_deployments'
  ] loop
    if has_table_privilege('anon',format('public.%I',internal_table),'SELECT')
       or has_table_privilege('anon',format('public.%I',internal_table),'INSERT')
       or has_table_privilege('anon',format('public.%I',internal_table),'UPDATE')
       or has_table_privilege('anon',format('public.%I',internal_table),'DELETE') then
      raise exception 'anon must not directly access internal table %',internal_table;
    end if;
    if has_table_privilege('authenticated',format('public.%I',internal_table),'SELECT')
       or has_table_privilege('authenticated',format('public.%I',internal_table),'INSERT')
       or has_table_privilege('authenticated',format('public.%I',internal_table),'UPDATE')
       or has_table_privilege('authenticated',format('public.%I',internal_table),'DELETE') then
      raise exception 'authenticated must not directly access internal table %',internal_table;
    end if;
  end loop;

  if has_table_privilege('anon','public.profiles','SELECT')
     or has_table_privilege('anon','public.profiles','UPDATE') then
    raise exception 'anon must not access profiles';
  end if;
  if not has_table_privilege('authenticated','public.profiles','SELECT')
     or not has_table_privilege('authenticated','public.profiles','UPDATE') then
    raise exception 'authenticated profile self-service grants missing';
  end if;

  if has_function_privilege('anon','public.admin_list_app_release_deployments()','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_list_app_release_deployments()','EXECUTE') then
    raise exception 'release admin RPC grant mismatch';
  end if;
  if has_function_privilege('anon','public.admin_get_knowledge_gemini_free_agent_status()','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_get_knowledge_gemini_free_agent_status()','EXECUTE') then
    raise exception 'Gemini status admin RPC grant mismatch';
  end if;
  if has_function_privilege('anon','public.admin_set_knowledge_automation_ai_config(boolean,text,text,integer,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_set_knowledge_automation_ai_config(boolean,text,text,integer,text)','EXECUTE') then
    raise exception 'Gemini config admin RPC grant mismatch';
  end if;

  if has_function_privilege('anon','public.get_knowledge_automation_catalog_snapshot()','EXECUTE')
     or has_function_privilege('authenticated','public.get_knowledge_automation_catalog_snapshot()','EXECUTE')
     or not has_function_privilege('service_role','public.get_knowledge_automation_catalog_snapshot()','EXECUTE') then
    raise exception 'catalog snapshot RPC must remain service-role-only';
  end if;
  if has_function_privilege('anon','public.get_knowledge_automation_worker_ai_config()','EXECUTE')
     or has_function_privilege('authenticated','public.get_knowledge_automation_worker_ai_config()','EXECUTE')
     or not has_function_privilege('service_role','public.get_knowledge_automation_worker_ai_config()','EXECUTE') then
    raise exception 'worker AI config RPC must remain service-role-only';
  end if;
end
$verify$;
