-- Real Supabase Vault extension + quota on an EPHEMERAL PostgreSQL image.
-- Bare image lacks hosted auth.uid: do not claim end-to-end Supabase Auth validation.
-- Fake keys only. Never output secrets, never use linked customer DB.
\set ON_ERROR_STOP on

do $$
declare fake_id uuid;
begin
  fake_id := vault.create_secret(
    'TEST_FAKE_KEY', 'aas_knowledge_gemini_api_key', 'Disposable fake test key');
  if not exists(select 1 from vault.decrypted_secrets
                where name='aas_knowledge_gemini_api_key' and decrypted_secret='TEST_FAKE_KEY')
  then raise exception 'Real Vault fake-key round-trip failed'; end if;
  if exists(select 1 from vault.secrets
            where name='aas_knowledge_gemini_api_key' and secret='TEST_FAKE_KEY')
  then raise exception 'Real Vault did not encrypt fake key'; end if;
  perform vault.update_secret(fake_id,'TEST_FAKE_KEY_ROTATED','aas_knowledge_gemini_api_key',
                              'Disposable fake test key rotation');
  if not exists(select 1 from vault.decrypted_secrets
                where name='aas_knowledge_gemini_api_key' and decrypted_secret='TEST_FAKE_KEY_ROTATED')
  then raise exception 'Real Vault fake-key rotation failed'; end if;
end $$;

do $$
begin
  if has_function_privilege('anon','public.admin_get_knowledge_gemini_free_agent_status()','EXECUTE')
    or has_function_privilege('anon','public.admin_set_knowledge_automation_ai_config(boolean,text,text,integer,text)','EXECUTE')
    or has_function_privilege('authenticated','public.reserve_knowledge_gemini_free_call()','EXECUTE')
    or not has_function_privilege('service_role','public.reserve_knowledge_gemini_free_call()','EXECUTE')
  then raise exception 'Unexpected Gemini function privileges'; end if;
end $$;

-- Set settings directly because bare DB image does not ship hosted auth.uid().
-- This does NOT test the admin-setting RPC end-to-end.
update public.knowledge_automation_settings
set ai_provider='gemini', ai_model='gemini-3.5-flash-lite',
    ai_enrichment_enabled=true, ai_max_candidates_per_run=3,
    ai_secret_name='aas_knowledge_gemini_api_key' where id=1;

set role service_role;
do $$
declare i int; allowed boolean;
begin
  for i in 1..10 loop
    select public.reserve_knowledge_gemini_free_call() into allowed;
    if not allowed then raise exception 'Early quota rejection at call %',i; end if;
  end loop;
  select public.reserve_knowledge_gemini_free_call() into allowed;
  if allowed then raise exception 'Quota allowed an eleventh call'; end if;
end $$;
reset role;
do $$
begin
  if (select ai_gemini_daily_count from public.knowledge_automation_settings where id=1)<>10
  then raise exception 'Wrong persisted quota after ten reservations'; end if;
end $$;

update public.knowledge_automation_settings
set ai_gemini_daily_date=(now() at time zone 'utc')::date-1,
    ai_gemini_daily_count=10 where id=1;
set role service_role;
do $$
declare allowed boolean;
begin
  select public.reserve_knowledge_gemini_free_call() into allowed;
  if not allowed then raise exception 'UTC rollover rejected'; end if;
end $$;
reset role;
do $$
begin
  if (select ai_gemini_daily_count from public.knowledge_automation_settings where id=1)<>1
  then raise exception 'UTC rollover must reset counter to one'; end if;
end $$;
select 'PASS disposable real Vault encryption and rotation; server-only quota and UTC rollover' as result;
