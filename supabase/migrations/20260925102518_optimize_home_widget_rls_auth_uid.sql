begin;

-- Keep the same row ownership checks while allowing Postgres to evaluate
-- auth.uid() once per statement instead of once per row.
alter policy user_home_widget_preferences_select_own
on public.user_home_widget_preferences
using ((select auth.uid()) = user_id);

alter policy user_home_widget_preferences_insert_own
on public.user_home_widget_preferences
with check ((select auth.uid()) = user_id);

alter policy user_home_widget_preferences_update_own
on public.user_home_widget_preferences
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter policy user_home_widget_preferences_delete_own
on public.user_home_widget_preferences
using ((select auth.uid()) = user_id);

commit;
