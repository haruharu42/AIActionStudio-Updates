-- Disposable Supabase PostgreSQL fixture: real vault extension, simulated Auth claims.
-- NEVER run against a linked Supabase project or customer data.
\set ON_ERROR_STOP on
do $$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end; $$;

create schema if not exists auth;
create schema if not exists private;
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault cascade;

-- Use Supabase's built-in auth.uid() and emulate only the JWT claim on this fixture.
-- Unlike the mock-Postgres fixture, do not replace or grant on the protected auth schema.
create or replace function private.is_active_admin() returns boolean language sql stable as $$
  select coalesce(nullif(current_setting('test.mock_admin',true),'')::boolean,false);
$$;

create table public.knowledge_automation_settings (
  id integer primary key,
  ai_enrichment_enabled boolean not null default false,
  ai_provider text not null default 'openai',
  ai_model text not null default 'gpt-5.6',
  ai_max_candidates_per_run integer not null default 6,
  ai_secret_name text not null default 'aas_knowledge_openai_api_key',
  updated_at timestamptz not null default now(),
  constraint knowledge_automation_settings_ai_provider_check check (ai_provider='openai')
);
insert into public.knowledge_automation_settings(id) values (1);
grant usage on schema public to anon,authenticated,service_role;
grant select,update on public.knowledge_automation_settings to service_role;
