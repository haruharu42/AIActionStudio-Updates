-- Disposable local-Supabase fixture for Gemini Auth/Vault E2E.
-- This file is copied into an isolated temporary Supabase project by CI only.
-- It must never be applied to a linked or production project.

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user',
  status text not null default 'active'
);

alter table public.profiles enable row level security;

create or replace function private.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
      from public.profiles p
     where p.id = (select auth.uid())
       and p.role = 'admin'
       and p.status = 'active'
  );
$function$;

revoke all on function private.is_active_admin() from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;

create table public.knowledge_automation_settings (
  id integer primary key,
  ai_enrichment_enabled boolean not null default false,
  ai_provider text not null default 'openai',
  ai_model text not null default 'gpt-5.6',
  ai_max_candidates_per_run integer not null default 6,
  ai_secret_name text not null default 'aas_knowledge_openai_api_key',
  updated_at timestamptz not null default now(),
  constraint knowledge_automation_settings_ai_provider_check check (ai_provider = 'openai')
);

alter table public.knowledge_automation_settings enable row level security;
insert into public.knowledge_automation_settings(id) values (1);
