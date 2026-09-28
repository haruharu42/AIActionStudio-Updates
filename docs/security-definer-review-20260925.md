# Authenticated SECURITY DEFINER Review — 2026-09-25

Scope: live Supabase project for AI Action Studio (AAS).

This document records the review outcome; it is not a permanent exemption list. Re-run the live advisor and re-read function definitions before future security changes.

## Current advisor state

After converting the zero-argument release-state wrapper to SECURITY INVOKER:

- authenticated SECURITY DEFINER executable WARN: 135
- anon SECURITY DEFINER executable WARN: 0
- auth leaked-password protection WARN: 1
- extension-in-public WARN: 1 (`pg_net`)
- RLS-enabled-with-no-policy INFO: 35
- performance: only unused-index INFO remained at the time of review

## Guard-path classification

Among the 135 authenticated-callable SECURITY DEFINER functions:

- 89 contain `private.is_active_admin()`
- 8 contain `private.assert_notification_feature_access()`
- 123 contain a direct `auth.uid()` check
- 1 is delegated/indirect without a direct guard in its own body

Counts overlap because an admin function can contain both `auth.uid()` and `private.is_active_admin()`.

## Delegated/indirect function

### `create_article_with_workspace(p_article jsonb, p_workspace jsonb)`

Reason to keep SECURITY DEFINER for now:

1. It calls `public.create_article(...)`, which is the single source for:
   - authenticated user identity
   - active profile validation
   - supported role validation
   - article quota
   - ownership
   - payload validation/normalization
2. After the article is created, it inserts the matching `article_workspaces` row using the created article's user ID.
3. Switching this wrapper to SECURITY INVOKER without redesigning workspace table permissions can break the atomic article + workspace creation path.

Action: keep intentional for now. If this path is redesigned later, prefer a non-exposed/private privileged implementation with a narrow public API.

## Wrapper changed to SECURITY INVOKER

### `get_my_app_release_state()`

The zero-argument overload only calls:

`public.get_my_app_release_state('public')`

The audience-aware overload already performs user/profile/release-tester validation and remains the privileged implementation. The zero-argument wrapper did not need owner privileges.

Verification performed before recording the migration:

- authenticated tester-equivalent call succeeded
- returned `signed_in=true`
- returned `active=true`
- advisor authenticated SECURITY DEFINER count decreased by one

## Intentional exposed privileged categories

Do not bulk-revoke these without per-function review.

### Admin operations

Admin-prefixed/administrative functions use the active-admin guard before returning or mutating privileged data.

### Notification self-service

V2 notification preference/read/subscription wrappers call the notification feature-access guard before delegating to the underlying implementation.

### Per-user privileged operations

A large set of self-service functions use `auth.uid()` plus profile/ownership/status checks to perform operations that direct table RLS intentionally does not expose.

## Remaining security work

1. Enable Supabase Auth leaked-password protection before broad public account growth if the project plan supports it. Current Supabase documentation states this feature is available on Pro and above, and it is configured in Auth settings rather than through a database migration.
2. Keep `pg_net` in place for now. Live inspection on 2026-09-25 found:
   - version: `0.20.4`
   - extension schema metadata: `public`
   - `extrelocatable=false`
   - active AAS callers include `private.invoke_knowledge_automation_worker` and `private.invoke_notification_push_worker`
   Supabase documentation states pg_net creates/uses its own `net` namespace and shows fresh installs using `schema extensions`, while its troubleshooting guidance warns that drop/recreate can fail when dependencies exist. Because AAS has live dependencies, do not drop/recreate only to silence the advisor.
3. Continue reviewing SECURITY DEFINER functions feature-by-feature when touched; do not change them solely to reduce advisor counts.
4. Re-run security advisors after each DB privilege/function change.
