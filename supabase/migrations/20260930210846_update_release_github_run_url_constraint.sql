-- Keep release deployment GitHub run URLs compatible across the repository rename.
-- The current Production worker can still emit the legacy AIArticleStudio-Updates path,
-- while the new worker emits AIActionStudio-Updates. Allow both during rollout/rollback.
-- Unrelated repositories remain rejected.

alter table public.app_release_deployments
  drop constraint if exists app_release_deployments_run_url_check;

alter table public.app_release_deployments
  add constraint app_release_deployments_run_url_check
  check (
    github_run_url is null
    or github_run_url ~ '^https://github[.]com/haruharu42/(AIActionStudio-Updates|AIArticleStudio-Updates)/actions/runs/[0-9]+$'
  );
