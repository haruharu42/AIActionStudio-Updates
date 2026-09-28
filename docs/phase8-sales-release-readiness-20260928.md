# Phase 8 — Sales / Release Readiness — 2026-09-28

This checkpoint records the current release-readiness state. It is not permission to publish Production or enable public sales.

## Current live sales gate

Verified against the live Supabase project:

- external sales switch: ON
- access-code redemption switch: ON
- real HTTPS external purchase URL: NOT configured
- seller legal/support data: NOT complete
- usable active purchase access codes: 0
- active admins: 1
- active admins with verified MFA/TOTP: 0
- public sales approval: OFF
- Stripe checkout: OFF
- PWA 7-day Stripe plan: OFF
- PWA monthly Stripe plan: OFF
- active non-admin release testers: 1
- enabled Push subscriptions for that tester population: 0

Therefore public sales remain intentionally locked.

## Automatic blockers before public-sales approval

The database-side public-sales approval requires:

1. external sales enabled,
2. access-code redemption enabled,
3. a safe HTTPS purchase URL,
4. complete seller/support disclosure data,
5. at least one usable active purchase access code,
6. at least one verified MFA factor for the active admin,
7. the approving admin session itself at AAL2.

Changing sales settings or seller settings clears a previous public-sales approval.

## Manual operator checks

The Sales Center now explicitly lists checks that AAS must not auto-mark complete:

- final sales price / duration / refund and cancellation wording,
- authenticated real-browser purchase -> access-code -> entitlement flow,
- duplicate / expired / exhausted code failure behavior,
- tester-device Push subscription and tester-only notification delivery/tap,
- closed paid-beta purchase and support operation,
- final release-candidate CI plus PC/mobile real-device critical flows,
- final Feature Control scope and explicit Production Worker/route/domain approval.

The single public-sales approval checkbox now makes these operator checks explicit instead of implying that legal-page review alone is sufficient.

## Delivery safety

Production/Member Beta delivery remains separately guarded:

- main-branch only,
- exact 40-character commit SHA,
- explicit deployment confirmation text,
- required legal/support/PWA assets,
- Typecheck, Lint, full regression build, dependency audit,
- Cloudflare/Wrangler contract checks.

Public-sales approval does not itself deploy Production.

## Current next actions

Do not invent or auto-fill seller identity, price, refund policy, external purchase URL, or MFA.

Before first controlled paid sale:

1. finish seller/support information,
2. enroll and verify admin TOTP, then verify AAL2 re-login,
3. create at least one controlled active purchase access code,
4. create the real external purchase page with final price/refund wording,
5. save the real HTTPS purchase URL,
6. complete authenticated browser redemption E2E,
7. enroll the tester device for Push and verify tester-only delivery,
8. run a small closed paid beta,
9. only then consider public-sales approval and Production rollout.
