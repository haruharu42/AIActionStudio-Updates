-- Disposable PostgreSQL 17 fixture for staged Gemini migration only.
-- THIS MOCK IS NOT A SUBSTITUTE FOR REAL SUPABASE AUTH/VAULT INTEGRATION.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create schema private;
create schema vault;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.mock_uid',true),'')::uuid;
$$;

create function private.is_active_admin() returns boolean language sql stable as $$
  select coalesce(nullif(current_setting('test.mock_admin',true),'')::boolean,false);
$$;

create table vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  secret text not null,
  description text not null
);
create view vault.decrypted_secrets as select id,name,secret as decrypted_secret from vault.secrets;
create function vault.create_secret(p_secret text,p_name text,p_description text)
returns uuid language plpgsql as $$
declare new_id uuid;
begin
  insert into vault.secrets(name,secret,description)
  values (p_name,p_secret,p_description) returning id into new_id;
  return new_id;
end;
$$;
create function vault.update_secret(p_id uuid,p_secret text,p_name text,p_description text)
returns void language plpgsql as $$
begin
  update vault.secrets set name=p_name,secret=p_secret,description=p_description where id=p_id;
end;
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
insert into public.knowledge_automation_settings(id) values(1);

-- Real service_role has server-side DB access; simulate only necessary table rights.
grant usage on schema public to anon,authenticated,service_role;
grant select,update on public.knowledge_automation_settings to service_role;
