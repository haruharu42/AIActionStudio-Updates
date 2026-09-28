# Phase 6 Admin & Operations Validation — 2026-09-28

## Verified runtime state

- Supabase project is active and healthy.
- Feature Control is server-authoritative and staged as admin -> tester -> public.
- Direct admin -> public promotion is blocked at both UI/client and database boundaries.
- Public PWA release requires an active tester stage and admin AAL2.
- Feature maintenance mode keeps admin/tester verification paths while stopping general-user access.
- Notification Center is connected to release publication, feature rollout/maintenance changes, and completed Knowledge refreshes.
- Web Push is enabled with device-scoped subscriptions, Vault-backed secrets, worker-token authentication, immediate enqueue, and cron recovery.
- Knowledge research automation is active; automated research creates candidates, while user-wide Knowledge notifications occur only after reviewed/published refresh completion.
- Supabase/GitHub infrastructure usage remains admin-only and does not embed privileged GitHub or Supabase secrets in the browser.

## Supabase live checks

- Feature registry: 52 entries.
- Active release tester exists.
- PWA candidate is currently at tester stage.
- Push delivery queue has no pending/processing failures at validation time.
- Knowledge automation most recently completed successfully with no recorded error.
- Notification, Knowledge research, and refresh queue cron jobs are active.

## Security advisor disposition

- RLS-without-policy INFO findings for the inspected control/notification/release/Knowledge tables are intentional: direct anon/authenticated table privileges are revoked and access is RPC-only.
- SECURITY DEFINER RPC warnings are not being mass-converted; sensitive RPCs inspected use explicit authorization checks and empty search_path, while worker-only RPCs are service-role-only.
- pg_net extension warning remains an operational item. The deployed pg_net 0.20.4 is non-relocatable and its objects live in the net schema; changing it in production without a planned dependency-safe migration could break cron HTTP invocation.
- Leaked-password protection is not available on the current Supabase Free organization plan; enabling it requires a supported paid plan.

This document records validation results only and does not change runtime behavior.


## Article-create split regression follow-up

- Regression tests now inspect the article step aggregator plus generation, finish, and shared step modules after the component split.
- No article workflow behavior was rolled back to satisfy the tests.


## Phase 7 operations UI checkpoint

- Initial Security & Operations status now remains unknown until both the protected snapshot and Worker health probe are available.
- This prevents a transient false healthy state during first load while preserving the existing monitoring and refresh behavior.


## Phase 7 note operations structure checkpoint

- The static Start Guide and Calendar presentation were extracted from `note-operations-page.tsx` into `note-operations/note-operations-static-tabs.tsx`.
- Supabase/RPC, AI launch, persistence, atomic schedule replacement, import parsing, and status mutations remain in the controller page.
- Regression tests read the controller and extracted static-tab module together while a dedicated boundary test keeps database/runtime logic out of the static tabs.


## Phase 7 note operations prompt boundary checkpoint

- Pure note profile/account/monthly schedule prompt builders were moved to `lib/note-operation-prompts.ts`.
- `lib/note-operations.ts` re-exports the same public builder names, preserving existing imports.
- Supabase queries, atomic schedule replacement, persistence, parsing, and status mutations remain outside the prompt module.
- Regression coverage reads the compatibility module and prompt module together and explicitly prevents database/runtime dependencies from entering the prompt boundary.


## Phase 7 membership structure checkpoint

- Member status, membership audit history, and future-operation recommendations were extracted from `admin-membership-page.tsx` into `admin-membership/admin-membership-static-sections.tsx`.
- Pricing updates, feature toggles, member assignment/revoke operations, Supabase/RPC calls, and confirmation guards remain in the controller page.
- Regression coverage reads both modules together and explicitly keeps mutation/runtime APIs out of the extracted presentation module.

- Follow-up: account-preset and shared-workspace-preset regression tests now inspect both the compatibility note operations module and the extracted prompt module after the split.
