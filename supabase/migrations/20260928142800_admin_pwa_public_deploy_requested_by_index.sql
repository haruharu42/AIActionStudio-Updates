begin;

create index if not exists app_release_deployments_requested_by_idx
  on public.app_release_deployments(requested_by)
  where requested_by is not null;

commit;
