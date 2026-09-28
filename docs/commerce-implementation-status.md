# Commerce / Sales implementation status

Last updated: 2026-09-25

## Current direction

AI Action Studio (AAS) is PWA-first and new paid sales are PWA-only.

The recommended first-sale path is:

**External purchase page -> AAS access code -> existing PWA entitlement**

Stripe remains implemented as an optional later route, but new Stripe checkout is currently intended to stay off until TEST-mode purchase/webhook/portal E2E is completed.

## Implemented

### Sales controls

- Admin Sales Center at `/admin/sales`.
- Dropdown-based sales modes and per-setting ON/OFF controls.
- External-sales master switch.
- Access-code redemption switch.
- HTTPS external purchase URL.
- Stripe new-checkout master switch.
- PWA 7-day and PWA monthly new-sale switches.
- Server-side checkout gating in the Worker.
- Existing contracts/entitlements are not destructively revoked when new sales are stopped.
- External-sales readiness panel that checks:
  - external sales enabled
  - access-code redemption enabled
  - valid HTTPS purchase URL
- Pre-sale review panel linking:
  - access-code issuance/history
  - commercial-transactions disclosure
  - Terms
  - Privacy
  - AI terms
  - Support
- Access-code redemption audit that returns only operational fields needed for E2E:
  - AAS ID / display name
  - redeemed time
  - sales channel / external reference
  - current PWA entitlement state/expiry
- User-facing purchase and redemption copy now consistently says "利用コード" while the legacy internal RPC/table names remain unchanged for compatibility.
- Rollback-only database E2E passed for code issue -> eligible user redemption -> entitlement -> audit history; the transaction was rolled back and left no test data.
- Rollback-only failure E2E passed for:
  - duplicate use by the same account
  - exhausted code
  - expired code
  - access-code reception OFF blocking new redemption
  - already-active PWA entitlement surviving the reception switch being turned OFF
- Client-side redemption now maps a server-side reception-OFF race to the specific "利用コードの新規受付は停止しています" message instead of a generic failure.

### Promotion

- Admin Sales & Promotion Center at `/admin/promotion`.
- Three-step promotion setup:
  - product/plan
  - destination
  - promotion method
- Prelaunch-safe wording when sale status has not been confirmed.
- note / Brain / Tips / SNS / campaign prompt generation.
- Live screenshot request builder that instructs ChatGPT to re-read exact HEAD + Preview before capturing article images.
- Promotion options and screenshot feature have been split into dedicated modules for easier maintenance.

### Billing foundation

- Supabase billing tables with RLS.
- Service-role-only billing mutation paths.
- Idempotent Stripe event processing by provider event ID.
- Existing `user_entitlements` remains the application access-control layer.
- Stripe-hosted Checkout and Customer Portal implementation.
- Raw-body Stripe webhook signature verification.
- TEST/LIVE event-mode separation.
- PWA sale-price IDs sourced from environment/config rather than hard-coded sale amounts.
- Fail-closed commerce mode.

Historical Windows/Bundle billing identifiers may still be recognized for old-record reconciliation. They are not current new-sale products.

### Security / performance hardening completed 2026-09-25

- Removed `anon` and `authenticated` execution from the unused legacy `get_public_commerce_sales_settings()` SECURITY DEFINER RPC.
- Current browser sales-settings path remains Worker `/api/sales/settings`.
- Verified authenticated admin-prefixed SECURITY DEFINER functions retain the active-admin guard.
- Verified authenticated SECURITY DEFINER functions use empty `search_path`.
- Optimized `user_home_widget_preferences` RLS policies to evaluate `auth.uid()` through a scalar subquery.
- Added the remaining foreign-key indexes reported by the performance advisor.
- Reviewed authenticated SECURITY DEFINER functions by guard path:
  - 89 include the active-admin guard
  - 8 include the notification feature-access guard
  - 123 include direct `auth.uid()` checks (overlaps with the guarded groups)
  - only one remaining function is delegated/indirect without a direct guard in its own body: `create_article_with_workspace`, which delegates article validation/ownership/quota to `create_article`
- Converted the zero-argument `get_my_app_release_state()` wrapper to SECURITY INVOKER because it only delegates to the guarded audience-aware overload.

## Intentionally not enabled

- Production Worker/public-route release has not been changed by these preparation tasks.
- Stripe LIVE is not enabled.
- PWA 7-day Stripe sale is not enabled by default.
- PWA monthly Stripe sale is not enabled by default.
- Seller identity/contact information is not guessed or fabricated.
- External purchase URL is not guessed.
- Prices, refund policy and campaign claims are not fabricated.

## Current release blockers to re-check live

Do not rely on this list as a fixed snapshot; re-query live systems before acting.

- Designated tester Web Push E2E requires the tester device to create/enable a push subscription.
- External-first paid launch requires a real external purchase URL.
- Real-browser access-code purchase-to-entitlement E2E is still required; database rollback E2E has passed.
- Seller/legal/refund/support wording must be finalized.
- Supabase Auth leaked-password protection remains disabled and should be enabled through Auth settings if the project plan supports it; pg_net's public-schema warning is documented as intentionally retained because the installed extension is non-relocatable and actively used by Knowledge/Push calls.
- General Public rollout requires explicit approval.
