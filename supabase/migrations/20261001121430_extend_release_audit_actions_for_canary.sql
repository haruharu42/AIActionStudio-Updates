-- Extend the release audit action allow-list for the Production Canary pipeline.
-- This preserves all legacy release audit actions and adds the Canary/Public
-- deployment lifecycle actions emitted by the new guarded release flow.

alter table public.app_release_audit
  drop constraint if exists app_release_audit_action_check;

alter table public.app_release_audit
  add constraint app_release_audit_action_check
  check (
    action in (
      'candidate_created',
      'candidate_promoted_to_tester',
      'tester_added',
      'tester_removed',
      'published',
      'user_accepted',
      'rolled_back',
      'deployment_requested',
      'deployment_dispatched',
      'deployment_running',
      'deployment_succeeded',
      'deployment_failed',
      'canary_deployment_requested',
      'canary_deployment_dispatched',
      'canary_deployment_running',
      'canary_deployment_succeeded',
      'canary_deployment_failed',
      'canary_verified',
      'public_deployment_requested',
      'public_deployment_dispatched',
      'public_deployment_running',
      'public_deployment_succeeded',
      'public_deployment_failed'
    )
  );
