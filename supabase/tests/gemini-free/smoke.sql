-- Run ONLY after fixture.sql and the staged migration on disposable PostgreSQL 17.
\set ON_ERROR_STOP on
do $$
begin
  if not exists (
    select 1 from information_schema.columns where table_schema='public'
      and table_name='knowledge_automation_settings' and column_name='ai_gemini_daily_count'
  ) then raise exception 'Gemini daily quota column missing'; end if;
  if has_function_privilege('anon','public.admin_get_knowledge_gemini_free_agent_status()','EXECUTE')
     or has_function_privilege('anon','public.reserve_knowledge_gemini_free_call()','EXECUTE')
     or has_function_privilege('authenticated','public.reserve_knowledge_gemini_free_call()','EXECUTE')
     or not has_function_privilege('service_role','public.reserve_knowledge_gemini_free_call()','EXECUTE')
  then raise exception 'Unexpected Gemini RPC execution privileges'; end if;
end;
$$;

set role authenticated;
set test.mock_uid='11111111-1111-4111-8111-111111111111';
-- Compatible with actual Supabase auth.uid(), while the mock fixture reads test.mock_uid.
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
set test.mock_admin='false';
do $$
begin
  begin
    perform public.admin_get_knowledge_gemini_free_agent_status();
    raise exception 'normal authenticated user accessed admin-only Gemini status';
  exception when insufficient_privilege then null;
  end;
end;
$$;
set test.mock_admin='true';
select public.admin_set_knowledge_automation_ai_config(false,'gemini','gemini-3.5-flash-lite',20,null);
do $$
declare status jsonb;
begin
  status := public.admin_get_knowledge_gemini_free_agent_status();
  if (status->>'supported') <> 'true'
    or (status->>'daily_limit') <> '10'
    or (status->>'enabled') <> 'false'
  then raise exception 'Wrong staged Gemini status: %', status; end if;
end;
$$;
select public.admin_set_knowledge_automation_ai_config(true,'gemini','gemini-3.5-flash-lite',20,'TEST_FAKE_KEY');
do $$
declare status jsonb;
begin
  status:=public.admin_get_knowledge_gemini_free_agent_status();
  if (status->>'enabled') <> 'true' or (status->>'key_configured') <> 'true'
     or status::text like '%TEST_FAKE_KEY%'
  then raise exception 'Gemini key storage or status privacy broken'; end if;
end;
$$;
reset role;

do $$
begin
  if (select ai_max_candidates_per_run from public.knowledge_automation_settings where id=1)<>3
  then raise exception 'Gemini max run count was not clamped to 3'; end if;
  if (select count(*) from vault.secrets where name='aas_knowledge_gemini_api_key')<>1
  then raise exception 'Gemini key not stored separately'; end if;
end;
$$;

set role service_role;
do $$
declare i integer; permitted boolean;
begin
  for i in 1..10 loop
    select public.reserve_knowledge_gemini_free_call() into permitted;
    if not permitted then raise exception 'quota rejected call % prematurely',i; end if;
  end loop;
  select public.reserve_knowledge_gemini_free_call() into permitted;
  if permitted then raise exception 'quota allowed call 11'; end if;
end;
$$;
reset role;
do $$
begin
  if (select ai_gemini_daily_count from public.knowledge_automation_settings where id=1)<>10
  then raise exception 'daily counter did not stop at ten'; end if;
end;
$$;

-- Simulate a UTC date transition without waiting or using the real production DB.
update public.knowledge_automation_settings
  set ai_gemini_daily_date=(now() at time zone 'utc')::date-1,
      ai_gemini_daily_count=10 where id=1;
set role service_role;
do $$
declare permitted boolean;
begin
  select public.reserve_knowledge_gemini_free_call() into permitted;
  if not permitted then raise exception 'quota did not reset next UTC day'; end if;
end;
$$;
reset role;
do $$
begin
  if (select ai_gemini_daily_count from public.knowledge_automation_settings where id=1)<>1
  then raise exception 'quota reset should start at one'; end if;
end;
$$;
select 'PASS disposable Gemini migration, admin guard, separate Vault stub and atomic quota' as result;
