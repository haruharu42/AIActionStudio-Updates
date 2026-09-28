# AI Action Studio — PWA Sales Production Checklist

Last updated: 2026-09-28

This checklist is the current sales baseline for AI Action Studio (AAS). It intentionally keeps Production release and Stripe LIVE disabled until the relevant gates are explicitly approved.

> Do not trust a fixed Git SHA, Preview URL, rollout count, or database snapshot in this document. Re-read GitHub, CI, Preview and Supabase at the start of each release task.

## 1. Current product model

New sales are PWA-only:

- `AAS-PWA-7DAY` — one-time 7-day PWA pass, no automatic renewal
- `AAS-PWA-MONTHLY` — monthly PWA subscription

The runtime PWA entitlement remains:

- `AAS-PWA-BETA`

Historical Windows / Bundle plan codes may remain in billing reconciliation code so old records can still be interpreted, but they are not offered as new-sale products.

## 2. Recommended first-sale route: external sale + access code

The shortest launch route does not require Stripe LIVE.

Required settings:

- External sales enabled
- Access-code redemption enabled
- A real HTTPS purchase page URL configured (note / Brain / Tips or another approved destination)
- Stripe new checkout may remain disabled

Required E2E:

1. Customer reaches the external purchase page from AAS.
2. Customer completes the external purchase using the seller's chosen external platform.
3. Seller provides the existing AAS access/invite code through the approved operational process.
4. Active eligible user redeems the code.
5. PWA entitlement becomes active with the intended expiry.
6. The user can enter the PWA and use the paid feature set.
7. Invalid, expired, exhausted and reused codes fail closed.
8. Turning off new code redemption does not revoke an already-active entitlement.

The Sales Center has two different checks:

- the lightweight readiness panel checks the basic external-sale configuration
- the pre-sale panel reads the persisted Supabase launch-readiness snapshot for purchase URL, seller information, usable invite stock and verified admin MFA

Neither check starts sales by itself. Public sales remain locked until an active admin explicitly approves the final public-sales gate after the automated and manual checks are complete.

## 2A. Public-sales approval lock

Saving sales settings is not the same as starting sales.

- `commerce_sales_settings.public_sales_approved` defaults to `false`.
- `/api/sales/settings` returns effective public-sale state only after the Worker confirms the approval lock and runtime readiness.
- `/api/billing/config` must not advertise a plan as available while the public-sales lock is closed.
- approving public sales is rejected at the database layer when the persisted automated readiness check is incomplete.
- approving public sales also requires the current admin session to be MFA-backed AAL2; stopping public sales remains available to an active admin for emergency fail-closed operation.
- unavailable Stripe plans are returned as unavailable with no public price payload, so TEST prices are not advertised while sales are locked.
- changing sales settings or seller/legal settings automatically revokes the approval and re-locks new sales.
- loss of usable invite stock or verified active-admin MFA makes the external route fail closed at runtime even if it was approved earlier.
- stopping public sales keeps existing entitlements and historical billing records intact.

Manual approval still requires a human check of leaked-password protection, legal pages, actual price/refund terms and the purchase-before-login support path.
## 3. Tester and release gates

Before general paid release:

- designated non-admin tester can enter the candidate Preview
- core PWA flows work on real iPhone
- core PWA flows work on a second supported form factor/browser where practical
- notification center works at Tester rollout
- Web Push is tested on the designated tester after that tester has created a push subscription
- article creation survives external-AI/tab switching
- side-hustle prompt workflows load and copy correctly
- image/article/SNS flows do not expose admin-only information
- access-code redemption E2E passes
- feature-control maintenance mode can stop a problem feature without disabling the whole PWA
- rollback/update controls have been verified

Do not move a Tester-only feature to Public merely to complete an E2E.

## 4. Security gates

Before general sale:

- no browser role can execute a legacy SECURITY DEFINER RPC that is no longer required
- every admin SECURITY DEFINER RPC retains its active-admin authorization guard
- SECURITY DEFINER functions keep an empty `search_path` and schema-qualify referenced objects
- browser-visible bundles/config contain no service-role, Stripe secret or webhook secret
- RLS ownership policies remain owner-scoped
- Supabase security/performance advisors are reviewed; warnings are fixed or explicitly classified as intentional
- leaked-password protection is reviewed/enabled in Supabase Auth before broad public account creation
- admin MFA policy is reviewed before general release

Current browser clients obtain public sales settings from the Worker `/api/sales/settings` endpoint, not from the retired browser-callable public sales RPC.

## 5. Legal / seller information

Before taking money from the general public, review and finalize:

- 利用規約
- プライバシーポリシー
- AI利用条件
- 特定商取引法に基づく表記
- refund / cancellation policy
- supported environment
- support response policy
- seller disclosure/contact details required for the selected sales channel

Never guess seller identity, address, phone, email, prices, refund terms or campaign claims.

## 6. Promotion and screenshots

For release articles and update posts:

1. Re-read the latest PR branch and exact HEAD.
2. Require successful Preview CI for that HEAD.
3. Obtain the current Preview URL from that exact workflow.
4. Compare the implemented code with the actual Preview screen.
5. Capture only the screen needed for the article.
6. Keep AAS IDs, email addresses, billing data, tokens, private notifications and admin-only details out of public screenshots.
7. Place each screenshot at the most relevant article heading and provide a short caption/alt text.
8. Never reuse an old screenshot when the current Preview differs.

The Promotion Center can generate the ChatGPT request for this workflow.

## 7. Optional later route: Stripe TEST -> Stripe LIVE

Stripe is not required for the first external-sale launch.

When Stripe is introduced, TEST mode comes first. Preview-only bindings/secrets include:

- `AAS_COMMERCE_MODE=test`
- `AAS_SUPABASE_URL`
- `AAS_SUPABASE_SERVICE_ROLE_KEY`
- `AAS_STRIPE_SECRET_KEY` using a test key
- `AAS_STRIPE_WEBHOOK_SECRET` using the TEST endpoint secret
- `AAS_STRIPE_PRICE_PWA_7D`
- `AAS_STRIPE_PRICE_PWA_MONTHLY`

Never place service-role keys, Stripe secret keys or webhook secrets in `NEXT_PUBLIC_*`, GitHub source, screenshots or logs.

TEST E2E must cover:

1. PWA 7-day successful Checkout and finite entitlement expiry.
2. A second 7-day purchase extends a valid finite period without shortening it.
3. PWA monthly subscription activation.
4. Period-end cancellation preserves access through the paid period.
5. Payment failure/past-due behavior follows the defined policy.
6. Duplicate subscription prevention.
7. Admin remains purchase-free.
8. Suspended/disabled users cannot start new Checkout.
9. Duplicate webhook delivery is idempotent.
10. Invalid webhook signatures do not mutate billing/entitlements.
11. TEST/LIVE event-mode mismatch is rejected.
12. Customer Portal cancellation/payment-method flow passes.
13. No secrets appear in client-visible output.

Only after TEST E2E, legal/seller fields, Production routing and explicit user approval should Stripe LIVE objects/secrets be configured.

## 8. CI / deployment gates

Required for every release candidate:

- exact branch/PR/HEAD re-read
- Typecheck SUCCESS
- Lint SUCCESS
- Build + regression tests SUCCESS
- Dependency audit/preflight SUCCESS
- PWA asset/auth-cache validation SUCCESS
- Preview-only Cloudflare contract verification SUCCESS
- Wrangler dry-run SUCCESS
- Preview upload SUCCESS
- real-device check for the changed critical flow

Do not merge `main`, change Production Worker/routes, enable Stripe LIVE, change DNS or publish a Windows release without explicit approval.
