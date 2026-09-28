# AI Action Studio — Sales Launch Operator Runbook

Updated: 2026-09-28

This runbook is an execution order. It is not authorization to publish Production, enable public sales, or create Stripe LIVE resources.

## 0. Starting state

At the latest live check:

- public sales approval: OFF
- external-sales switch: ON
- access-code redemption switch: ON
- external purchase URL: not configured
- seller/legal/support data: incomplete
- usable active purchase codes: 0
- active admin with verified MFA/TOTP: 0
- Stripe Checkout: OFF
- PWA Stripe plans: OFF
- active non-admin release tester: 1
- enabled Push subscription for tester population: 0

The public Worker correctly fails closed in this state.

## 1. Seller and support setup

In Admin Sales:

1. Confirm seller type and disclosure mode.
2. Enter the real seller name, address, phone and support email.
3. Set the real HTTPS support URL.
4. Save.
5. Re-open the commercial-transactions page and Support page signed out.
6. Confirm private seller details are not exposed when disclosure mode is on-request.

Do not use placeholder personal data for launch.

## 2. Admin MFA

Before any public-sales approval:

1. Enroll a real TOTP factor on the active admin.
2. Verify the factor.
3. Sign out and sign in again.
4. Complete the MFA challenge so the current session is AAL2.
5. Confirm Admin Security reports the verified factor/session correctly.

Do not enable a Production AAL2 enforcement switch before a working verified factor exists.

## 3. External purchase offer

For the first paid route, external sale + access code is the preferred path.

1. Decide the real product/offer.
2. Decide the price and usable period.
3. Finalize refund/cancellation wording.
4. Create the external purchase page.
5. Ensure the purchase URL is HTTPS and contains no embedded credentials.
6. Make price, duration, refund/cancellation and support terms visible before purchase.
7. Save the URL in Admin Sales.

Do not invent a price in AAS. The actual offer must be decided by the operator.

## 4. Controlled access code

Before the first paid test:

1. Create at least one active code intended for the controlled test.
2. Confirm its expiry, entitlement expiry and usage limit.
3. Keep the code private until the intended purchase/test.
4. Verify Admin Users shows issuance/redemption status without exposing unnecessary billing data.

## 5. Authenticated browser E2E

Use a disposable/test general-user account and the real browser UI.

Verify:

1. signed-in user without entitlement reaches the plans/access-code path,
2. valid code redemption succeeds,
3. PWA entitlement becomes active,
4. the user can enter the intended feature set,
5. the same code cannot be reused contrary to its rules,
6. expired code fails closed,
7. exhausted code fails closed,
8. disabled redemption blocks new redemptions but does not destroy an already-valid entitlement.

Do not replace this with database-only verification.

## 6. Tester device / Push

For the designated non-admin tester:

1. Sign in on the tester device.
2. Enable notification permission and create an AAS Push subscription.
3. Confirm the subscription appears as enabled.
4. Send a tester-only notification with non-sensitive content.
5. Verify device receipt.
6. Tap the notification and verify the expected AAS destination.
7. Confirm no unintended public audience received it.

Do not move Notifications to Public just to bypass a missing tester subscription.

## 7. Closed paid beta

Before general sale:

1. Use the real external purchase route with a small controlled group.
2. Verify purchase -> code delivery -> registration -> entitlement -> actual AAS use.
3. Record support questions and failure points.
4. Use Feature Control maintenance mode for a faulty individual feature rather than disabling the whole PWA when possible.
5. Resolve critical/high defects before widening the audience.

## 8. Final release candidate

Pin one exact candidate SHA.

Required:

- Typecheck PASS
- Lint PASS
- full build/regression PASS
- dependency audit PASS
- PWA assets/auth-cache checks PASS
- Cloudflare contract PASS
- Wrangler dry-run PASS
- PC real-device critical flow PASS
- smartphone real-device critical flow PASS
- signed-out legal/support routes PASS
- sales CTA remains locked until approval

If the branch moves, the previous validation is no longer the final release-candidate proof. Re-run on the new exact SHA.

## 9. Public-sales approval

Only after Sections 1–8 are complete:

1. Open Admin Sales.
2. Confirm the automated blockers are all clear.
3. Confirm the manual operator checklist.
4. Ensure the current admin session is AAL2.
5. Check the manual-review confirmation.
6. Approve public sales.

Database guards still reject approval when automated readiness is not satisfied.

Changing sales settings or seller settings clears a previous approval.

## 10. Production / Member Beta deployment

Public-sales approval does not deploy Production.

Deployment is a separate decision and remains guarded by:

- main branch only,
- exact 40-character SHA,
- explicit workflow confirmation,
- build/regression/audit validation,
- Cloudflare/Wrangler contract validation.

Do not merge or deploy just because public-sales readiness is green.

## 11. First hours after opening sales

Watch:

- entitlement/redemption failures,
- notification delivery,
- open operations/security events,
- support inquiries,
- Feature Control state,
- Knowledge automation health,
- purchase CTA/availability text,
- public legal/support pages.

If a sales-path issue occurs, stop public sales first while preserving existing entitlements, then investigate.

## 12. Stripe

Stripe is optional for the first sale and remains OFF.

Before Stripe LIVE:

1. complete Stripe TEST Products/Prices,
2. configure TEST secrets,
3. run Checkout/Webhook/idempotency/failure/Portal E2E,
4. re-check legal/cancellation wording,
5. explicitly approve LIVE,
6. create separate LIVE Products/Prices/Webhook/secrets,
7. only then enable Stripe sale switches.

Never reuse TEST identifiers/secrets as LIVE configuration.
