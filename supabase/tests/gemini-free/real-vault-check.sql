-- Run after smoke.sql against an EPHEMERAL real Supabase PostgreSQL image only.
-- Do not print or fetch decrypted secret values in logs.
\set ON_ERROR_STOP on
do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets
    where name='aas_knowledge_gemini_api_key'
      and decrypted_secret='TEST_FAKE_KEY'
  ) then raise exception 'Vault failed to round-trip the disposable fake key'; end if;
  if exists (
    select 1 from vault.secrets
    where name='aas_knowledge_gemini_api_key' and secret='TEST_FAKE_KEY'
  ) then raise exception 'Vault secret not encrypted at rest'; end if;
  if exists (
    select 1 from public.knowledge_automation_settings
    where ai_gemini_daily_count <> 1 or ai_provider <> 'gemini'
  ) then raise exception 'Gemini quota rollover or provider state changed'; end if;
end; $$;

-- An unauthenticated SQL role and a non-admin role cannot inspect capability.
set role anon;
do $$
begin
  begin
    perform public.admin_get_knowledge_gemini_free_agent_status();
    raise exception 'anon accessed Gemini status';
  exception when insufficient_privilege then null;
  end;
end; $$;
reset role;
set role authenticated;
set test.mock_uid='11111111-1111-4111-8111-111111111111';
set test.mock_admin='false';
do $$
begin
  begin
    perform public.admin_set_knowledge_automation_ai_config(true,'gemini','gemini-3.5-flash-lite',1,'INVALID');
    raise exception 'non-admin changed Gemini API configuration';
  exception when insufficient_privilege then null;
  end;
end; $$;
reset role;
select 'PASS disposable real Supabase Vault encryption, admin gating, daily rollover' as result;
