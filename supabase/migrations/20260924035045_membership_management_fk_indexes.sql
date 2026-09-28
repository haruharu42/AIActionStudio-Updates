-- Cover new Creator Club management foreign keys used by admin operations.
-- Additive performance hardening; no data or access-policy changes.

begin;

create index if not exists creator_membership_admin_actions_actor_idx
    on public.creator_membership_admin_actions (actor_user_id);

create index if not exists creator_membership_plan_features_feature_idx
    on public.creator_membership_plan_features (feature_key);

create index if not exists creator_membership_plan_features_updated_by_idx
    on public.creator_membership_plan_features (updated_by);

create index if not exists creator_membership_settings_updated_by_idx
    on public.creator_membership_settings (updated_by);

commit;
