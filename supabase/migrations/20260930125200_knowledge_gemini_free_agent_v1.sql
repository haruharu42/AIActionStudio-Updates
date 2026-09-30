-- Staged, opt-in Gemini Free Knowledge agent. Existing OpenAI provider and OFF state preserved.
-- Apply to a test project first, deploy the matching Edge Worker, THEN allow administrator opt-in.
-- Rate cap is an application safeguard, not a guarantee of Google free-tier billing.
alter table public.knowledge_automation_settings
  add column if not exists ai_gemini_daily_date date,
  add column if not exists ai_gemini_daily_count integer not null default 0;

alter table public.knowledge_automation_settings
  drop constraint if exists knowledge_automation_settings_ai_provider_check,
  add constraint knowledge_automation_settings_ai_provider_check
    check (ai_provider in ('openai','gemini')),
  drop constraint if exists knowledge_automation_settings_gemini_count_check,
  add constraint knowledge_automation_settings_gemini_count_check
    check (ai_gemini_daily_count between 0 and 10);

create or replace function public.admin_set_knowledge_automation_ai_config(
  p_enabled boolean,
  p_provider text,
  p_model text,
  p_max_candidates_per_run integer,
  p_api_key text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  provider_value text := lower(trim(coalesce(p_provider,'')));
  model_value text := left(trim(coalesce(p_model,'')),120);
  api_key_value text := trim(coalesce(p_api_key,''));
  max_value integer;
  secret_name_value text;
  secret_id uuid;
  key_exists boolean;
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;
  if provider_value not in ('openai','gemini') then
    raise exception 'unsupported AI provider' using errcode='22023';
  end if;
  if model_value = '' or model_value !~ '^[A-Za-z0-9._:-]{1,120}$' then
    raise exception 'invalid AI model id' using errcode='22023';
  end if;
  if provider_value = 'gemini' and model_value <> 'gemini-3.5-flash-lite' then
    raise exception 'only the allowlisted free-model adapter is supported' using errcode='22023';
  end if;
  max_value := greatest(1, least(coalesce(p_max_candidates_per_run,6),
    case when provider_value='gemini' then 3 else 20 end));
  secret_name_value := case when provider_value='gemini'
    then 'aas_knowledge_gemini_api_key'
    else 'aas_knowledge_openai_api_key' end;

  if api_key_value <> '' then
    select secret.id into secret_id
      from vault.secrets secret where secret.name=secret_name_value limit 1;
    if secret_id is null then
      perform vault.create_secret(api_key_value,secret_name_value,
        'AAS Knowledge provider API key (admin-only; never return in UI)');
    else
      perform vault.update_secret(secret_id,api_key_value,secret_name_value,
        'AAS Knowledge provider API key (admin-only; never return in UI)');
    end if;
  end if;
  select exists(select 1 from vault.secrets secret where secret.name=secret_name_value)
    into key_exists;
  if coalesce(p_enabled,false) and not key_exists then
    raise exception 'selected provider API key required' using errcode='22023';
  end if;
  update public.knowledge_automation_settings
    set ai_enrichment_enabled=coalesce(p_enabled,false),
        ai_provider=provider_value,ai_model=model_value,
        ai_max_candidates_per_run=max_value,
        ai_secret_name=secret_name_value,
        updated_at=now()
    where id=1;
end;
$function$;

-- Separate read-only capability check: an unmigrated backend returns RPC 404.
-- The UI must not make this an all-or-nothing dependency for existing OpenAI screens.
create or replace function public.admin_get_knowledge_gemini_free_agent_status()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  settings record;
  today_utc date := (now() at time zone 'utc')::date;
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;
  select s.ai_gemini_daily_date,s.ai_gemini_daily_count,s.ai_provider,s.ai_enrichment_enabled
    into settings from public.knowledge_automation_settings s where s.id=1;
  return jsonb_build_object(
    'supported',true,
    'model','gemini-3.5-flash-lite',
    'daily_limit',10,
    'daily_used',case when settings.ai_gemini_daily_date=today_utc then settings.ai_gemini_daily_count else 0 end,
    'key_configured',exists(select 1 from vault.secrets where name='aas_knowledge_gemini_api_key'),
    'selected',settings.ai_provider='gemini',
    'enabled',settings.ai_provider='gemini' and settings.ai_enrichment_enabled
  );
end;
$function$;

-- Atomic reserve BEFORE a Gemini network call. Only service_role can execute.
-- Security invoker, no direct admin/browser access and no new service-role secret exposure.
create or replace function public.reserve_knowledge_gemini_free_call()
returns boolean
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  today_utc date := (now() at time zone 'utc')::date;
begin
  update public.knowledge_automation_settings s
     set ai_gemini_daily_date=today_utc,
         ai_gemini_daily_count=case
           when s.ai_gemini_daily_date=today_utc then s.ai_gemini_daily_count+1
           else 1 end,
         updated_at=now()
   where s.id=1 and s.ai_provider='gemini' and s.ai_enrichment_enabled
     and (s.ai_gemini_daily_date is distinct from today_utc or s.ai_gemini_daily_count < 10);
  return found;
end;
$function$;

revoke all on function public.admin_get_knowledge_gemini_free_agent_status() from public,anon,authenticated;
revoke all on function public.admin_set_knowledge_automation_ai_config(boolean,text,text,integer,text) from public,anon,authenticated;
revoke all on function public.reserve_knowledge_gemini_free_call() from public,anon,authenticated;
grant execute on function public.admin_get_knowledge_gemini_free_agent_status() to authenticated;
grant execute on function public.admin_set_knowledge_automation_ai_config(boolean,text,text,integer,text) to authenticated;
grant execute on function public.reserve_knowledge_gemini_free_call() to service_role;
