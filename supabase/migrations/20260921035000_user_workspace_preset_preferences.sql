create table if not exists public.user_workspace_preset_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preset_key text not null default 'balanced'
    check (preset_key in ('balanced','note_growth','longform','sns_growth','aas_official')),
  apply_article boolean not null default true,
  apply_images boolean not null default true,
  apply_sns boolean not null default true,
  apply_note boolean not null default true,
  apply_workflow boolean not null default true,
  apply_account_design boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_workspace_preset_preferences enable row level security;
alter table public.user_workspace_preset_preferences force row level security;

drop policy if exists workspace_preset_select_own_active on public.user_workspace_preset_preferences;
create policy workspace_preset_select_own_active
on public.user_workspace_preset_preferences
for select to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_active_profile())
  and (select public.can_access_product('AAS-PWA-BETA'))
);

drop policy if exists workspace_preset_insert_own_active on public.user_workspace_preset_preferences;
create policy workspace_preset_insert_own_active
on public.user_workspace_preset_preferences
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.is_active_profile())
  and (select public.can_access_product('AAS-PWA-BETA'))
  and (preset_key <> 'aas_official' or (select private.is_active_admin()))
);

drop policy if exists workspace_preset_update_own_active on public.user_workspace_preset_preferences;
create policy workspace_preset_update_own_active
on public.user_workspace_preset_preferences
for update to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_active_profile())
  and (select public.can_access_product('AAS-PWA-BETA'))
)
with check (
  user_id = (select auth.uid())
  and (select private.is_active_profile())
  and (select public.can_access_product('AAS-PWA-BETA'))
  and (preset_key <> 'aas_official' or (select private.is_active_admin()))
);

drop policy if exists workspace_preset_delete_own_active on public.user_workspace_preset_preferences;
create policy workspace_preset_delete_own_active
on public.user_workspace_preset_preferences
for delete to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_active_profile())
  and (select public.can_access_product('AAS-PWA-BETA'))
);

revoke all on table public.user_workspace_preset_preferences from public, anon, authenticated;
grant select, insert, update, delete on table public.user_workspace_preset_preferences to authenticated;

create or replace function private.touch_workspace_preset_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function private.touch_workspace_preset_updated_at() from public, anon, authenticated;

drop trigger if exists workspace_preset_touch_updated_at on public.user_workspace_preset_preferences;
create trigger workspace_preset_touch_updated_at
before update on public.user_workspace_preset_preferences
for each row execute function private.touch_workspace_preset_updated_at();

comment on table public.user_workspace_preset_preferences is
  'Owner-scoped cross-feature preset selection and application switches for AAS PWA.';
