begin;

create table if not exists public.user_home_widget_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  desktop_layout jsonb not null default '[]'::jsonb,
  mobile_layout jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_home_widget_preferences_desktop_array
    check (jsonb_typeof(desktop_layout) = 'array'),
  constraint user_home_widget_preferences_mobile_array
    check (jsonb_typeof(mobile_layout) = 'array')
);

alter table public.user_home_widget_preferences enable row level security;

drop policy if exists "user_home_widget_preferences_select_own" on public.user_home_widget_preferences;
create policy "user_home_widget_preferences_select_own"
  on public.user_home_widget_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_home_widget_preferences_insert_own" on public.user_home_widget_preferences;
create policy "user_home_widget_preferences_insert_own"
  on public.user_home_widget_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_home_widget_preferences_update_own" on public.user_home_widget_preferences;
create policy "user_home_widget_preferences_update_own"
  on public.user_home_widget_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_home_widget_preferences_delete_own" on public.user_home_widget_preferences;
create policy "user_home_widget_preferences_delete_own"
  on public.user_home_widget_preferences
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_home_widget_preferences to authenticated;

comment on table public.user_home_widget_preferences is
  'Per-user AI Action Studio home widget layouts for desktop and mobile.';

commit;
