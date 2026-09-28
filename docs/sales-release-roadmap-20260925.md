# AI Action Studio — Sales Release Roadmap

Created: 2026-09-25

This roadmap is execution order, not permission to publish Production. Re-read live GitHub, CI, Preview and Supabase before every phase.


## 2026-09-28 live readiness checkpoint

The current live re-check supersedes older inline observation dates where values differ.

- Runtime code validated through Preview run #1098 on `a7d4d8f07fa97dfd6d38975de3f57f7bf53f6d88`: Typecheck, Lint, full Build/regression, dependency audit, PWA/Auth-cache checks, Cloudflare contract, Wrangler dry-run and Preview upload all passed.
- Current branch then received documentation-only commit `78a76e99fd8e408605bf32b4952d5e24245fc91a`.
- Public sales approval remains OFF.
- External-sales switch and access-code redemption are ON, but the real HTTPS purchase URL is not configured.
- Seller/legal/support data is not complete.
- Usable active purchase codes: 0.
- Active admin with verified MFA/TOTP: 0.
- Stripe Checkout and PWA Stripe plans remain OFF.
- One active non-admin release tester exists; enabled Push subscriptions for that tester population: 0.
- Signed-out Preview check confirms no external-purchase CTA and no enabled Stripe purchase button on `/plans`; legal/support routes return HTTP 200.
- Sales Center now separates automatic launch blockers from manual operator checks (price/refund, authenticated browser E2E, tester-device Push, closed paid beta, final RC/real-device checks and Production approval).
- Operator sequence: `docs/sales-launch-operator-runbook-20260928.md`.
- Detailed live gate snapshot: `docs/phase8-sales-release-readiness-20260928.md`.


## Phase 1 — Tester critical-path E2E

Status: in progress.

- [x] Admin Web Push real-device delivery/tap verified.
- [x] Notification Center moved to Tester rollout.
- [x] Designated non-admin tester can access Tester notification UI.
- [ ] Tester device creates/enables a Web Push subscription. Live DB re-check on 2026-09-27 JST: one active non-admin release tester exists, but that tester still has no enabled Push subscription.
- [ ] Send Tester-only push and verify receipt/tap. Do not send until the tester subscription exists and target/content are explicitly confirmed.
- [ ] Re-check article creation, external-AI return, core side-hustle workflow and mobile navigation on Tester.

Blocker: the tester push step requires an actual tester-device subscription and must not be bypassed by moving Notifications to Public.

## Phase 2 — Security and robustness before sale

Status: active.

Completed:

- [x] Retire browser-role access to unused public sales SECURITY DEFINER RPC.
- [x] Confirm all authenticated `admin_*` SECURITY DEFINER functions use the active-admin guard.
- [x] Confirm authenticated SECURITY DEFINER functions use empty `search_path`.
- [x] Remove `auth_rls_initplan` performance warnings from home-widget policies.
- [x] Add remaining missing foreign-key indexes.

Remaining:

- [ ] Decide whether to upgrade Supabase before broad public account creation. Live organization check on 2026-09-27 shows the current Supabase plan is Free, while leaked-password protection is available on Pro and above. Security Advisor therefore still reports `auth_leaked_password_protection` WARN; there is no SQL migration that can enable it on the current plan. If the plan is upgraded, enable it in Auth settings and re-run the advisor.
- [x] Keep first-factor enrollment and AAL2 challenge UI implemented in `AdminRouteGuard`; the production enforcement switch remains intentionally OFF during development.
- [x] Add a clear zero-MFA warning/first-factor flow to Admin Security and show the current admin MFA state in Sales Center pre-sale review.
- [ ] Enroll at least one verified TOTP on the active admin before enabling AAL2 enforcement. Live DB re-check on 2026-09-27: 1 active admin, 0 active admins with a verified MFA factor.
- [ ] After a verified admin TOTP exists, re-enable both the PWA admin-route MFA requirement and the database AAL2 admin guard, then complete admin login/re-login E2E. Do not enable only one side or enable either side before enrollment.
- [x] Map weak/leaked Supabase password errors to clear user-facing guidance so stronger Auth settings fail understandably.
- [x] Classify the remaining authenticated SECURITY DEFINER warnings by guard type and delegated call path.
- [x] Convert the zero-argument release-state wrapper to SECURITY INVOKER after compatibility testing.
- [x] Review `pg_net` public-schema warning: live extension is v0.20.4, non-relocatable, and actively used by Knowledge/Push worker invocation. Keep it in place rather than drop/recreate a live dependency.
- [x] Re-run advisors after database security changes.

## Phase 3 — External-sale + access-code E2E

Status: configuration partially ready.

Required configuration:

- [x] External sales switch enabled.
- [x] Access-code switch enabled.
- [ ] Real HTTPS external purchase URL configured.
- [x] Verify external purchase CTA stays hidden when the external purchase URL is unset; signed-out Preview E2E passed.
- [ ] Verify the external purchase CTA appears and links correctly after a real valid HTTPS purchase URL is configured.
- [ ] Verify access code issuance operational process with the real external sales workflow.
- [x] Rollback-only DB E2E: issue code -> eligible user redemption -> PWA entitlement -> admin redemption audit.
- [x] Confirm rollback left no test code, entitlement or redemption history.
- [x] Add admin access-code redemption audit (AAS ID / redeemed time / PWA entitlement state; no email or billing data).
- [x] Rollback-only DB failure E2E: duplicate-user reuse, exhausted code and expired code all fail closed.
- [x] Rollback-only DB OFF-gate E2E: disabling new code redemption blocks new redemption while preserving the already-active PWA entitlement.
- [x] Harden browser access-code entry against duplicate submission, mobile auto-correction/capitalization and silent client-initialization failure; keep iPhone-readable input/layout regression coverage.
- [ ] Verify the same redemption path through the real authenticated browser UI.
- [ ] Verify duplicate/expired/exhausted code failures through disposable authenticated browser E2E.

This is the recommended first paid-launch path.

## Phase 4 — Legal and support finalization

- [x] Add Sales Center pre-sale review links for commercial disclosure, Terms, Privacy, AI terms, Support and access-code operations.
- [ ] Finalize sales price/offer on the chosen external platform.
- [ ] Finalize refund/cancellation wording.
- [x] Re-check Terms, Privacy and AI terms on the current signed-out Preview.
- [x] Re-check commercial-transactions disclosure on the current signed-out Preview.
- [ ] Re-check support and seller-disclosure **operational response process**. The public Support page itself was re-checked successfully; the real human response procedure still requires finalization.
- [x] Verify no private seller data is exposed outside the selected disclosure mode. Public billing config reports individual/on_request and keeps seller identity/contact fields non-public.

## Phase 5 — Closed paid beta

- [ ] Sell to a small controlled group through the external-sales route.
- [ ] Verify purchase -> code -> registration -> entitlement -> actual usage.
- [ ] Record support questions and failure points.
- [ ] Use Feature Control maintenance mode for a faulty feature instead of disabling the whole PWA.
- [ ] Resolve critical/high issues before widening rollout.

## Phase 6 — Promotion package

- [x] Dropdown-first Sales & Promotion Center.
- [x] Three-step promotion setup.
- [x] Latest-Preview screenshot request builder.
- [ ] Create release article from current exact Preview.
- [ ] Capture safe PC/mobile screenshots.
- [ ] Produce note article, X posts and FAQ/update material.
- [ ] Human-review price, availability, rollout stage and screenshots immediately before publishing.

## Phase 7 — General PWA sale

Requires explicit approval.

- [ ] Final release-candidate CI fully green.
- [ ] Real-device critical flows green.
- [ ] Closed paid beta issues resolved.
- [ ] Legal/support checks complete.
- [ ] Decide which Tester features move to Public.
- [ ] Explicitly approve Production route/domain release.
- [ ] Publish the external purchase page/CTA.
- [ ] Monitor inquiries, notification delivery, entitlements and feature health.

## Phase 8 — Optional Stripe route

Not required for first sale.

- [ ] Create Stripe TEST PWA Products/Prices.
- [ ] Configure Preview TEST secrets.
- [ ] Complete Checkout/webhook/idempotency/failure/Portal E2E.
- [ ] Re-check seller disclosure and cancellation policy.
- [ ] Explicitly approve Stripe LIVE.
- [ ] Create separate LIVE Products/Prices/Webhook/secrets.
- [ ] Enable PWA Stripe sale switches only after LIVE validation.

## Phase 9 — Ongoing operation

- Knowledge/source health monitoring
- notification/update communication
- support inquiry triage
- feature rollout/maintenance control
- sales/conversion analysis
- promotion refresh using current Preview screenshots
- periodic security/advisor review
