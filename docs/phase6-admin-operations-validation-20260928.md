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


## Phase 7 Knowledge refresh structure checkpoint

- Fresh/Stable channel guidance and recent refresh history were extracted from `knowledge-refresh-panel.tsx` into `knowledge-refresh/knowledge-refresh-static-sections.tsx`.
- Publication, diff review, automation candidate review, AI configuration, Supabase/RPC calls, and admin safety guards remain in the controller panel.
- Regression tests inspect the controller and extracted presentation module together and explicitly keep runtime mutation APIs out of the static module.


## Phase 7 security and performance advisor review

- Supabase Security Advisor was re-run after the UI/controller refactors. The `authenticated_security_definer_function_executable` warning covers 143 callable SECURITY DEFINER functions.
- Classification found 96 functions with an explicit `private.is_active_admin` guard and 131 with direct `auth.uid` checks. The remaining 9 have indirect authorization: eight notification v2 wrappers call `private.assert_notification_feature_access()` (which checks `auth.uid()` and feature access), and `create_article_with_workspace` delegates creation/ownership/quota authorization to `create_article()`.
- No unguarded authenticated SECURITY DEFINER RPC was found in this review. No blanket EXECUTE revoke was applied because that would break intended authenticated RPC contracts.
- Leaked-password protection remains an Advisor warning because Supabase documents it as Pro-plan-and-above functionality; AAS operations capacity is currently configured as Free. No unsupported setting change was attempted.
- `pg_net` is reported as installed in the public schema, but the installed 0.20.4 extension is marked `relocatable=false`. It was not force-moved or reinstalled because current cron/http automation depends on it and a destructive reinstall is outside this maintenance pass.
- Performance Advisor currently reports unused indexes at INFO level only. No indexes were removed solely from current usage counters; low-traffic/new indexes can legitimately remain unused until more production traffic exists.


## Phase 7 opaque browser diagnostic checkpoint

- `WINDOW_SCRIPT_ERROR_OPAQUE` is now classified at the database boundary as warning/warning instead of error/error because the browser supplies no Error object, source filename, line, or column.
- Actionable client/runtime diagnostics remain error/error.
- The previously open opaque browser event was resolved during the migration; current open ops events are zero at verification time.
- Supabase Security and Performance Advisors were rerun after the migration and showed only the previously documented known items.


## Phase 8 real-browser login hero checkpoint

- Real desktop Preview verification found visible horizontal/vertical seams because `aas-login-hero-hq.svg` referenced four external tile SVGs as an exact 2x2 grid.
- The login hero is now self-contained: the four embedded WebP sources are composed inside one local SVG with their native 355x385 dimensions, 20px overlaps, and feather masks across the internal horizontal/vertical seams.
- The public hero no longer references `aas-login-tile-*.svg`; CSS cache identity was advanced to `20260928-natural-v4`.
- Regression coverage now requires the self-contained data images and seam masks and rejects external tile references.
- Baseline signed-out route smoke testing covered /create, /images, /prompts, /sns, /note-operations, /workflow, /membership, /settings, /admin, and /admin/operations: all returned the expected access gate with no protected-content exposure or 404/500.
