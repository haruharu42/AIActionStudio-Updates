-- Managed Staging reconstruction fixture for AAS.
-- TEST/STAGING ONLY. Never apply this file to Production.
-- Contains structure only: no Production users, catalog data, API keys, worker tokens, or release data.
-- The real Gemini migration is applied separately after this fixture in CI.

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  aas_user_id text not null unique,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  status text not null default 'pending'
    check (status in ('pending','active','suspended','disabled')),
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  ai_terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists profiles_pending_created_idx
  on public.profiles(created_at desc) where status='pending';
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create or replace function private.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.profiles
    where id=(select auth.uid())
      and role='admin'
      and status='active'
  );
$function$;
revoke all on function private.is_active_admin() from public,anon,authenticated;

revoke all on table public.profiles from public,anon,authenticated;
grant select,update on table public.profiles to authenticated;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles for select to authenticated
using (
  (((select auth.uid()) is not null) and id=(select auth.uid()))
  or (select private.is_active_admin())
);

drop policy if exists profiles_update_own_display_name on public.profiles;
create policy profiles_update_own_display_name
on public.profiles for update to authenticated
using (
  ((select auth.uid()) is not null)
  and id=(select auth.uid())
  and status='active'
)
with check (
  ((select auth.uid()) is not null)
  and id=(select auth.uid())
  and status='active'
);

create table if not exists public.knowledge_automation_settings (
  id smallint primary key default 1 check (id=1),
  enabled boolean not null default false,
  check_interval_hours integer not null default 24 check (check_interval_hours between 1 and 168),
  max_sources_per_run integer not null default 12 check (max_sources_per_run between 1 and 30),
  max_discovered_links_per_source integer not null default 6
    check (max_discovered_links_per_source between 0 and 20),
  project_url text not null,
  worker_token_hash text not null default '',
  last_worker_invoked_at timestamptz,
  last_success_at timestamptz,
  last_error text not null default '',
  updated_at timestamptz not null default now(),
  ai_enrichment_enabled boolean not null default false,
  ai_provider text not null default 'openai'
    constraint knowledge_automation_settings_ai_provider_check
    check (ai_provider='openai'),
  ai_model text not null default 'gpt-5.6',
  ai_max_candidates_per_run integer not null default 6
    constraint knowledge_automation_settings_ai_max_candidates_check
    check (ai_max_candidates_per_run between 1 and 20),
  ai_secret_name text not null default 'aas_knowledge_openai_api_key'
);
alter table public.knowledge_automation_settings enable row level security;
alter table public.knowledge_automation_settings force row level security;
revoke all on table public.knowledge_automation_settings from public,anon,authenticated;
grant select,insert,update,delete on table public.knowledge_automation_settings to service_role;

insert into public.knowledge_automation_settings(
  id,enabled,project_url,ai_enrichment_enabled,ai_provider,ai_model,
  ai_max_candidates_per_run,ai_secret_name
) values (
  1,false,'http://127.0.0.1:54321',false,'openai','gpt-5.6',6,
  'aas_knowledge_openai_api_key'
) on conflict(id) do nothing;

create table if not exists public.knowledge_catalog (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  kind text not null check (kind in ('age','genre','subgenre','publication','task','combination')),
  label text not null check (char_length(label) between 1 and 120),
  parent_label text check (parent_label is null or char_length(parent_label) <= 120),
  aliases text[] not null default '{}',
  guidance text[] not null default '{}',
  deliverables text[] not null default '{}',
  cautions text[] not null default '{}',
  tasks text[] not null default '{}',
  priority smallint not null default 50 check (priority between 0 and 100),
  status text not null default 'active' check (status in ('active','draft','disabled')),
  source text not null default 'admin' check (source in ('admin','candidate')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  release_channel text not null default 'both' check (release_channel in ('both','fresh_first')),
  stable_available_at timestamptz not null default now(),
  source_urls text[] not null default '{}',
  source_summary text check (source_summary is null or length(source_summary) <= 1000),
  source_checked_at timestamptz,
  catalog_version bigint not null default 1 check (catalog_version >= 1)
);
create index if not exists knowledge_catalog_created_by_idx
  on public.knowledge_catalog(created_by);

create table if not exists public.prompt_optimization_catalog (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (length(key) between 1 and 180),
  provider text not null check (provider in ('all','chatgpt','claude','gemini')),
  plan text not null check (plan in ('all','free','paid')),
  task text not null check (task in (
    'all','title','article','image','social','promotion',
    'sidejob_content','sidejob_sns','sidejob_video','sidejob_affiliate','sidejob_resale',
    'sidejob_crowdsourcing','sidejob_skill_sales','sidejob_digital_product','sidejob_outreach',
    'sidejob_research','sidejob_efficiency','sidejob_planning'
  )),
  rules text[] not null default '{}',
  source_urls text[] not null default '{}',
  source_summary text check (source_summary is null or length(source_summary) <= 1000),
  priority smallint not null default 70 check (priority between 0 and 100),
  release_channel text not null default 'both' check (release_channel in ('both','fresh_first')),
  stable_available_at timestamptz not null default now(),
  catalog_version bigint not null default 1 check (catalog_version >= 1),
  status text not null default 'active' check (status in ('active','draft','disabled')),
  created_by uuid references public.profiles(id),
  source_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_prompt_optimization_catalog_created_by
  on public.prompt_optimization_catalog(created_by);

alter table public.knowledge_catalog enable row level security;
alter table public.prompt_optimization_catalog enable row level security;
revoke all on table public.knowledge_catalog from public,anon,authenticated;
revoke all on table public.prompt_optimization_catalog from public,anon,authenticated;
grant select,insert,update,delete on table public.knowledge_catalog to service_role;
grant select,insert,update,delete on table public.prompt_optimization_catalog to service_role;

create table if not exists public.knowledge_automation_sources (
  id bigint generated by default as identity primary key,
  source_url text not null unique check (source_url ~* '^https://[^[:space:]]+$'),
  tasks text[] not null default '{}',
  source_kind text not null default 'official_page'
    check (source_kind in ('official_page','official_help','official_policy','official_docs','official_changelog','official_feed')),
  enabled boolean not null default true,
  last_checked_at timestamptz,
  next_check_at timestamptz not null default now(),
  last_http_status integer,
  last_content_hash text,
  etag text,
  last_modified text,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_automation_runs (
  id bigint generated by default as identity primary key,
  trigger_type text not null default 'cron' check (trigger_type in ('cron','manual')),
  status text not null default 'pending'
    check (status in ('pending','processing','completed','failed','cancelled')),
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  sources_checked integer not null default 0,
  candidates_created integer not null default 0,
  changed_sources integer not null default 0,
  discovered_links integer not null default 0,
  error_message text not null default '',
  summary jsonb not null default '{}'::jsonb,
  candidates_analyzed integer not null default 0 check (candidates_analyzed >= 0),
  analysis_failures integer not null default 0 check (analysis_failures >= 0)
);

create table if not exists public.knowledge_automation_candidates (
  id bigint generated by default as identity primary key,
  fingerprint text not null unique,
  run_id bigint references public.knowledge_automation_runs(id) on delete set null,
  source_id bigint references public.knowledge_automation_sources(id) on delete set null,
  candidate_action text not null check (candidate_action in ('new','update','recheck','retire')),
  existing_item_type text check (existing_item_type is null or existing_item_type in ('knowledge','prompt')),
  existing_item_key text,
  matched_tasks text[] not null default '{}',
  source_url text not null check (source_url ~* '^https://[^[:space:]]+$'),
  source_title text not null default '',
  source_excerpt text not null default '',
  source_content_hash text not null default '',
  source_http_status integer,
  current_payload jsonb,
  proposed_payload jsonb,
  research_prompt text not null default '',
  confidence smallint not null default 50 check (confidence between 0 and 100),
  reason text not null default '',
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','converted')),
  review_notes text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  analysis_status text not null default 'pending'
    check (analysis_status in ('pending','completed','failed')),
  analysis_decision text not null default ''
    check (analysis_decision in ('','no_change','new','update','recheck','retire')),
  proposal_item_type text
    check (proposal_item_type is null or proposal_item_type in ('knowledge','prompt')),
  analysis_provider text not null default '',
  analysis_model text not null default '',
  analysis_reason text not null default '',
  analysis_error text not null default '',
  verified_source_urls text[] not null default '{}',
  analyzed_at timestamptz
);

create index if not exists knowledge_automation_sources_due_idx
  on public.knowledge_automation_sources(enabled,next_check_at,id);
create index if not exists knowledge_automation_runs_status_idx
  on public.knowledge_automation_runs(status,requested_at desc);
create index if not exists knowledge_automation_runs_requested_by_idx
  on public.knowledge_automation_runs(requested_by) where requested_by is not null;
create index if not exists knowledge_automation_candidates_status_idx
  on public.knowledge_automation_candidates(status,detected_at desc);
create index if not exists knowledge_automation_candidates_existing_idx
  on public.knowledge_automation_candidates(existing_item_type,existing_item_key)
  where existing_item_key is not null;
create index if not exists knowledge_automation_candidates_run_idx
  on public.knowledge_automation_candidates(run_id) where run_id is not null;
create index if not exists knowledge_automation_candidates_source_idx
  on public.knowledge_automation_candidates(source_id) where source_id is not null;
create index if not exists knowledge_automation_candidates_reviewed_by_idx
  on public.knowledge_automation_candidates(reviewed_by) where reviewed_by is not null;

alter table public.knowledge_automation_sources enable row level security;
alter table public.knowledge_automation_runs enable row level security;
alter table public.knowledge_automation_candidates enable row level security;
revoke all on table public.knowledge_automation_sources from public,anon,authenticated;
revoke all on table public.knowledge_automation_runs from public,anon,authenticated;
revoke all on table public.knowledge_automation_candidates from public,anon,authenticated;
grant select,insert,update,delete on table public.knowledge_automation_sources to service_role;
grant select,insert,update,delete on table public.knowledge_automation_runs to service_role;
grant select,insert,update,delete on table public.knowledge_automation_candidates to service_role;
grant usage,select on sequence public.knowledge_automation_sources_id_seq to service_role;
grant usage,select on sequence public.knowledge_automation_runs_id_seq to service_role;
grant usage,select on sequence public.knowledge_automation_candidates_id_seq to service_role;

create or replace function public.get_knowledge_automation_catalog_snapshot()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'knowledge',coalesce((
      select jsonb_agg(jsonb_build_object(
        'key',item.key,'kind',item.kind,'label',item.label,
        'parent_label',item.parent_label,'aliases',to_jsonb(item.aliases),
        'guidance',to_jsonb(item.guidance),'deliverables',to_jsonb(item.deliverables),
        'cautions',to_jsonb(item.cautions),'tasks',to_jsonb(item.tasks),
        'priority',item.priority,'source_urls',to_jsonb(item.source_urls),
        'source_summary',item.source_summary,'catalog_version',item.catalog_version
      ) order by item.key)
      from public.knowledge_catalog item where item.status='active'
    ),'[]'::jsonb),
    'prompts',coalesce((
      select jsonb_agg(jsonb_build_object(
        'key',item.key,'provider',item.provider,'plan',item.plan,'task',item.task,
        'rules',to_jsonb(item.rules),'priority',item.priority,
        'source_urls',to_jsonb(item.source_urls),
        'source_summary',item.source_summary,'catalog_version',item.catalog_version
      ) order by item.key)
      from public.prompt_optimization_catalog item where item.status='active'
    ),'[]'::jsonb)
  );
$function$;
revoke all on function public.get_knowledge_automation_catalog_snapshot()
  from public,anon,authenticated;
grant execute on function public.get_knowledge_automation_catalog_snapshot()
  to service_role;

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
      select secret.decrypted_secret from vault.decrypted_secrets secret
      where secret.name=settings.ai_secret_name limit 1
    ),'')
  )
  from public.knowledge_automation_settings settings where settings.id=1;
$function$;
revoke all on function public.get_knowledge_automation_worker_ai_config()
  from public,anon,authenticated;
grant execute on function public.get_knowledge_automation_worker_ai_config()
  to service_role;

create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'pwa' check (channel='pwa'),
  version text not null
    check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$'),
  title text not null,
  notes text not null default '',
  status text not null default 'candidate'
    check (status in ('candidate','published','retired','rolled_back')),
  update_kind text not null default 'optional'
    check (update_kind in ('optional','required')),
  build_key text not null check (build_key ~ '^[0-9A-Za-z._-]{3,120}$'),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  retired_at timestamptz,
  update_notes text not null default '' check (char_length(update_notes) <= 6000),
  fix_notes text not null default '' check (char_length(fix_notes) <= 6000),
  unique(channel,version),
  unique(channel,build_key)
);
create index if not exists app_releases_created_by_idx on public.app_releases(created_by);

create table if not exists public.app_release_deployments (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.app_releases(id) on delete restrict,
  requested_by uuid references public.profiles(id) on delete set null,
  source_branch text not null check (source_branch in ('main','preview/current')),
  source_sha text not null check (source_sha ~ '^[0-9a-f]{40}$'),
  status text not null default 'requested'
    check (status in ('requested','dispatched','running','succeeded','failed','cancelled')),
  github_run_id bigint,
  github_run_url text,
  target_sha text check (target_sha is null or target_sha ~ '^[0-9a-f]{40}$'),
  deployment_url text check (
    deployment_url is null
    or deployment_url='https://ai-article-studio-pwa.ai-article-studio.workers.dev/'
  ),
  error_message text,
  requested_at timestamptz not null default now(),
  dispatched_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists app_release_deployments_one_active_per_release_idx
  on public.app_release_deployments(release_id)
  where status in ('requested','dispatched','running');
create index if not exists app_release_deployments_release_requested_idx
  on public.app_release_deployments(release_id,requested_at desc);
create index if not exists app_release_deployments_requested_by_idx
  on public.app_release_deployments(requested_by) where requested_by is not null;

alter table public.app_releases enable row level security;
alter table public.app_release_deployments enable row level security;
alter table public.app_releases force row level security;
alter table public.app_release_deployments force row level security;
revoke all on table public.app_releases from public,anon,authenticated;
revoke all on table public.app_release_deployments from public,anon,authenticated;
grant select,insert,update,delete on table public.app_releases to service_role;
grant select,insert,update,delete on table public.app_release_deployments to service_role;

create or replace function public.admin_list_app_release_deployments()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.is_active_admin() then
    raise exception 'active admin required' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',d.id,'release_id',d.release_id,'source_branch',d.source_branch,
      'source_sha',d.source_sha,'status',d.status,'github_run_id',d.github_run_id,
      'github_run_url',d.github_run_url,'target_sha',d.target_sha,
      'deployment_url',d.deployment_url,'error_message',d.error_message,
      'requested_at',d.requested_at,'dispatched_at',d.dispatched_at,
      'started_at',d.started_at,'finished_at',d.finished_at,'updated_at',d.updated_at
    ) order by d.requested_at desc)
    from (
      select * from public.app_release_deployments
      order by requested_at desc limit 20
    ) d
  ),'[]'::jsonb);
end;
$function$;
revoke all on function public.admin_list_app_release_deployments()
  from public,anon,authenticated;
grant execute on function public.admin_list_app_release_deployments()
  to authenticated;
