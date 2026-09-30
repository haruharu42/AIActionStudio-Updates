-- Disposable local-Supabase fixture for pwa-release-deploy Auth E2E.
-- CI-only. Never apply to a linked/production project.

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
    select 1 from public.profiles p
    where p.id=(select auth.uid())
      and p.role='admin'
      and p.status='active'
  );
$function$;
revoke all on function private.is_active_admin() from public, anon, authenticated;

create table if not exists public.app_release_deployments (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'requested'
);
alter table public.app_release_deployments enable row level security;

create or replace function public.admin_list_app_release_deployments()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not private.is_active_admin() then
    raise exception 'active admin required' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',d.id,'status',d.status) order by d.id)
    from public.app_release_deployments d
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.admin_list_app_release_deployments() from public,anon,authenticated;
grant execute on function public.admin_list_app_release_deployments() to authenticated;
grant usage on schema public to anon,authenticated,service_role;
