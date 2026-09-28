-- Cover notification/feature-control foreign keys used by cleanup and admin history queries.

create index if not exists app_feature_controls_updated_by_idx
  on public.app_feature_controls(updated_by)
  where updated_by is not null;

create index if not exists app_notification_push_deliveries_subscription_idx
  on public.app_notification_push_deliveries(subscription_id);

create index if not exists app_notifications_created_by_idx
  on public.app_notifications(created_by)
  where created_by is not null;
