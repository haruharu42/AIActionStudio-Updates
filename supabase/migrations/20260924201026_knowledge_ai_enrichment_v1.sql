-- AI-assisted Knowledge automation enrichment.
-- Official-source monitoring and candidate generation remain automatic;
-- final publication remains admin review gated.

alter table public.knowledge_automation_settings
  add column if not exists ai_enrichment_enabled boolean not null default false,
  add column if not exists ai_provider text not null default 'openai',
  add column if not exists ai_model text not null default 'gpt-5.6',
  add column if not exists ai_max_candidates_per_run integer not null default 6,
  add column if not exists ai_secret_name text not null default 'aas_knowledge_openai_api_key';

alter table public.knowledge_automation_settings
  drop constraint if exists knowledge_automation_settings_ai_provider_check,
  add constraint knowledge_automation_settings_ai_provider_check
    check (ai_provider in ('openai')),
  drop constraint if exists knowledge_automation_settings_ai_max_candidates_check,
  add constraint knowledge_automation_settings_ai_max_candidates_check
    check (ai_max_candidates_per_run between 1 and 20);

alter table public.knowledge_automation_candidates
  add column if not exists analysis_status text not null default 'pending',
  add column if not exists analysis_decision text not null default '',
  add column if not exists proposal_item_type text,
  add column if not exists analysis_provider text not null default '',
  add column if not exists analysis_model text not null default '',
  add column if not exists analysis_reason text not null default '',
  add column if not exists analysis_error text not null default '',
  add column if not exists verified_source_urls text[] not null default '{}',
  add column if not exists analyzed_at timestamptz;

alter table public.knowledge_automation_candidates
  drop constraint if exists knowledge_automation_candidates_analysis_status_check,
  add constraint knowledge_automation_candidates_analysis_status_check
    check (analysis_status in ('pending','completed','failed')),
  drop constraint if exists knowledge_automation_candidates_analysis_decision_check,
  add constraint knowledge_automation_candidates_analysis_decision_check
    check (analysis_decision in ('','no_change','new','update','recheck','retire')),
  drop constraint if exists knowledge_automation_candidates_proposal_item_type_check,
  add constraint knowledge_automation_candidates_proposal_item_type_check
    check (proposal_item_type is null or proposal_item_type in ('knowledge','prompt'));

alter table public.knowledge_automation_runs
  add column if not exists candidates_analyzed integer not null default 0
    check (candidates_analyzed >= 0),
  add column if not exists analysis_failures integer not null default 0
    check (analysis_failures >= 0);

create or replace function public.admin_get_knowledge_automation_ai_config()
returns table (
  enabled boolean,
  provider text,
  model text,
  max_candidates_per_run integer,
  api_key_configured boolean
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;

  return query
  select
    settings.ai_enrichment_enabled,
    settings.ai_provider,
    settings.ai_model,
    settings.ai_max_candidates_per_run,
    exists (
      select 1
      from vault.secrets secret
      where secret.name=settings.ai_secret_name
    )
  from public.knowledge_automation_settings settings
  where settings.id=1;
end;
$function$;

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
  max_value integer := greatest(1,least(coalesce(p_max_candidates_per_run,6),20));
  secret_name_value text := 'aas_knowledge_openai_api_key';
  secret_id uuid;
  key_exists boolean;
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;
  if provider_value <> 'openai' then
    raise exception 'unsupported AI provider' using errcode='22023';
  end if;
  if model_value = '' or model_value !~ '^[A-Za-z0-9._:-]{1,120}$' then
    raise exception 'invalid AI model id' using errcode='22023';
  end if;

  if api_key_value <> '' then
    select secret.id into secret_id
    from vault.secrets secret
    where secret.name=secret_name_value
    limit 1;

    if secret_id is null then
      perform vault.create_secret(
        api_key_value,
        secret_name_value,
        'AAS Knowledge automation OpenAI API key'
      );
    else
      perform vault.update_secret(
        secret_id,
        api_key_value,
        secret_name_value,
        'AAS Knowledge automation OpenAI API key'
      );
    end if;
  end if;

  select exists(
    select 1 from vault.secrets secret where secret.name=secret_name_value
  ) into key_exists;

  if coalesce(p_enabled,false) and not key_exists then
    raise exception 'AI API key is required before enabling enrichment' using errcode='22023';
  end if;

  update public.knowledge_automation_settings
  set ai_enrichment_enabled=coalesce(p_enabled,false),
      ai_provider=provider_value,
      ai_model=model_value,
      ai_max_candidates_per_run=max_value,
      ai_secret_name=secret_name_value,
      updated_at=now()
  where id=1;
end;
$function$;

create or replace function public.get_knowledge_automation_worker_ai_config()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'enabled',settings.ai_enrichment_enabled,
    'provider',settings.ai_provider,
    'model',settings.ai_model,
    'max_candidates_per_run',settings.ai_max_candidates_per_run,
    'api_key',coalesce((
      select secret.decrypted_secret
      from vault.decrypted_secrets secret
      where secret.name=settings.ai_secret_name
      limit 1
    ),'')
  )
  from public.knowledge_automation_settings settings
  where settings.id=1;
$function$;

create or replace function public.admin_list_knowledge_automation_candidates_v2(
  p_status text default 'pending',
  p_limit integer default 50
)
returns table (
  id bigint,
  candidate_action text,
  existing_item_type text,
  existing_item_key text,
  matched_tasks text[],
  source_url text,
  source_title text,
  source_excerpt text,
  source_http_status integer,
  current_payload jsonb,
  proposed_payload jsonb,
  research_prompt text,
  confidence smallint,
  reason text,
  status text,
  review_notes text,
  detected_at timestamptz,
  reviewed_at timestamptz,
  analysis_status text,
  analysis_decision text,
  proposal_item_type text,
  analysis_provider text,
  analysis_model text,
  analysis_reason text,
  analysis_error text,
  verified_source_urls text[],
  analyzed_at timestamptz
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  status_value text := nullif(lower(trim(coalesce(p_status,''))),'');
  limit_value integer := greatest(1,least(coalesce(p_limit,50),200));
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;
  if status_value is not null and status_value not in ('pending','approved','rejected','converted') then
    raise exception 'invalid automation candidate status' using errcode='22023';
  end if;

  return query
  select
    candidate.id,candidate.candidate_action,candidate.existing_item_type,candidate.existing_item_key,
    candidate.matched_tasks,candidate.source_url,candidate.source_title,candidate.source_excerpt,
    candidate.source_http_status,candidate.current_payload,candidate.proposed_payload,candidate.research_prompt,
    candidate.confidence,candidate.reason,candidate.status,candidate.review_notes,candidate.detected_at,candidate.reviewed_at,
    candidate.analysis_status,candidate.analysis_decision,candidate.proposal_item_type,candidate.analysis_provider,
    candidate.analysis_model,candidate.analysis_reason,candidate.analysis_error,candidate.verified_source_urls,candidate.analyzed_at
  from public.knowledge_automation_candidates candidate
  where status_value is null or candidate.status=status_value
  order by
    case candidate.status when 'pending' then 0 when 'approved' then 1 when 'rejected' then 2 else 3 end,
    case candidate.analysis_status when 'completed' then 0 when 'pending' then 1 else 2 end,
    candidate.confidence desc,
    candidate.detected_at desc
  limit limit_value;
end;
$function$;

create or replace function public.admin_retry_knowledge_automation_candidate_ai(
  p_candidate_id bigint
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null or not (select private.is_active_admin()) then
    raise exception 'active admin required' using errcode='42501';
  end if;

  update public.knowledge_automation_candidates
  set analysis_status='pending',
      analysis_decision='',
      proposal_item_type=null,
      proposed_payload=null,
      analysis_provider='',
      analysis_model='',
      analysis_reason='',
      analysis_error='',
      verified_source_urls='{}'::text[],
      analyzed_at=null
  where id=p_candidate_id
    and status in ('pending','approved');

  if not found then
    raise exception 'candidate is not retryable' using errcode='22023';
  end if;
end;
$function$;

revoke all on function public.admin_get_knowledge_automation_ai_config() from public, anon, authenticated;
revoke all on function public.admin_set_knowledge_automation_ai_config(boolean,text,text,integer,text) from public, anon, authenticated;
revoke all on function public.get_knowledge_automation_worker_ai_config() from public, anon, authenticated;
revoke all on function public.admin_list_knowledge_automation_candidates_v2(text,integer) from public, anon, authenticated;
revoke all on function public.admin_retry_knowledge_automation_candidate_ai(bigint) from public, anon, authenticated;

grant execute on function public.admin_get_knowledge_automation_ai_config() to authenticated;
grant execute on function public.admin_set_knowledge_automation_ai_config(boolean,text,text,integer,text) to authenticated;
grant execute on function public.get_knowledge_automation_worker_ai_config() to service_role;
grant execute on function public.admin_list_knowledge_automation_candidates_v2(text,integer) to authenticated;
grant execute on function public.admin_retry_knowledge_automation_candidate_ai(bigint) to authenticated;
