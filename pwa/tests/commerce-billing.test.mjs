import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(root, "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("commerce database extends existing entitlement security instead of bypassing it", async () => {
  const migration = await readRepo("supabase/migrations/20260914003000_commerce_billing_foundation.sql");

  for (const table of [
    "commerce_plans",
    "billing_customers",
    "billing_checkout_sessions",
    "billing_subscriptions",
    "billing_events",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`));
  }

  assert.match(migration, /AAS-PWA-7DAY/);
  assert.match(migration, /AAS-PWA-MONTHLY/);
  assert.match(migration, /AAS-WIN-MONTHLY/);
  assert.match(migration, /AAS-BUNDLE-MONTHLY/);
  assert.match(migration, /array\['AAS-PWA-BETA', 'AAS-WIN-BETA'\]/);
  assert.match(migration, /on conflict \(provider_event_id\) do nothing/);
  assert.match(migration, /billing_apply_pass_event/);
  assert.match(migration, /billing_sync_subscription_event/);
  assert.match(migration, /to service_role/);
  assert.doesNotMatch(migration, /grant execute on function public\.billing_[^(]+\([^;]+\) to authenticated/i);
});

test("billing integrity hardening binds pass and subscription events to registered AAS checkout identities", async () => {
  const hardening = await readRepo("supabase/migrations/20260914050000_billing_integrity_hardening.sql");
  const checkoutGuard = await readRepo("supabase/migrations/20260914052000_billing_checkout_identity_guard.sql");

  assert.match(hardening, /billing_customers_guard_identity/);
  assert.match(hardening, /billing customer identity is immutable/);
  assert.match(hardening, /billing_subscriptions_guard_identity/);
  assert.match(hardening, /billing subscription identity is immutable/);
  assert.match(hardening, /recent registered checkout required for new subscription/);
  assert.match(hardening, /checkout\.provider_session_id = normalized_session_id/);
  assert.match(hardening, /checkout\.user_id = p_user_id/);
  assert.match(hardening, /checkout\.plan_code = normalized_plan_code/);
  assert.match(hardening, /checkout\.provider_customer_id = normalized_customer_id/);
  assert.match(hardening, /'ignored'/);
  assert.match(hardening, /grant execute on function public\.billing_apply_pass_event[^;]+to service_role/s);
  assert.doesNotMatch(hardening, /to authenticated/i);

  assert.match(checkoutGuard, /billing_checkout_sessions_guard_identity/);
  assert.match(checkoutGuard, /billing checkout identity is immutable/);
  assert.match(checkoutGuard, /old\.user_id is distinct from new\.user_id/);
  assert.match(checkoutGuard, /old\.plan_code is distinct from new\.plan_code/);
  assert.match(checkoutGuard, /old\.provider_customer_id is distinct from new\.provider_customer_id/);
});

test("billing Worker fails closed and validates raw Stripe webhook signatures", async () => {
  const worker = await read("worker/billing.ts");

  assert.match(worker, /AAS_COMMERCE_MODE/);
  assert.match(worker, /return value === "test" \|\| value === "live" \? value : "off"/);
  assert.match(worker, /request\.arrayBuffer\(\)/);
  assert.match(worker, /stripe-signature/);
  assert.match(worker, /HMAC/);
  assert.match(worker, /SHA-256/);
  assert.match(worker, /SIGNATURE_TOLERANCE_SECONDS = 300/);
  assert.match(worker, /billing_mode_mismatch/);
  assert.match(worker, /checkout\.session\.completed/);
  assert.match(worker, /customer\.subscription\.updated/);
  assert.match(worker, /invoice\.payment_failed/);
  assert.match(worker, /billing_record_ignored_event/);
  assert.doesNotMatch(worker, /console\.(log|info|debug)\([^)]*(secret|service|signature|authorization)/i);
});

test("checkout auth separates the public Auth API key from elevated service access", async () => {
  const worker = await read("worker/billing.ts");
  const vars = await read(".dev.vars.example");

  assert.match(worker, /AAS_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(worker, /function authApiKey/);
  assert.match(worker, /apikey: apiKey/);
  assert.match(worker, /authorization: `Bearer \$\{match\[1\]\}`/);
  assert.match(worker, /auth_user_rejected/);
  assert.match(worker, /profile_lookup_failed/);
  assert.match(worker, /!serviceKey\.startsWith\("sb_secret_"\)/);
  assert.match(vars, /AAS_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME/);
});

test("individual seller on-request mode keeps private identity out of public config", async () => {
  const worker = await read("worker/billing.ts");
  const client = await read("lib/commerce.ts");
  const disclosure = await read("components/commercial-transactions-page.tsx");
  const vars = await read(".dev.vars.example");
  const migration = await readRepo("supabase/migrations/20260928032442_commerce_seller_admin_settings_v1.sql");

  assert.match(worker, /AAS_SELLER_TYPE/);
  assert.match(worker, /AAS_SELLER_DISCLOSURE_MODE/);
  assert.match(worker, /function sellerConfigFromEnv/);
  assert.match(worker, /async function loadSellerConfig/);
  assert.match(worker, /commerce_sales_settings\?id=eq\.1&select=seller_type,seller_disclosure_mode,seller_name,seller_address,seller_phone,seller_email,seller_support_url/);
  assert.match(worker, /hasDatabaseSellerData/);
  assert.match(worker, /return hasDatabaseSellerData \? databaseConfig : fallback/);
  assert.match(worker, /function publicSellerConfig/);
  assert.match(worker, /name: discloseDirectly \? seller\.name : ""/);
  assert.match(worker, /address: discloseDirectly \? seller\.address : ""/);
  assert.match(worker, /phone: discloseDirectly \? seller\.phone : ""/);
  assert.match(worker, /email: discloseDirectly \? seller\.email : ""/);
  assert.match(worker, /seller: publicSellerConfig\(seller\)/);
  assert.match(worker, /safeHttpsUrl\(seller\.supportUrl\)/);
  assert.match(migration, /admin_get_commerce_seller_settings/);
  assert.match(migration, /admin_update_commerce_seller_settings/);
  assert.match(migration, /private\.is_active_admin\(\)/);
  assert.match(migration, /seller_disclosure_mode/);
  assert.match(migration, /seller_support_url/);
  assert.match(client, /disclosureMode: SellerDisclosureMode/);
  assert.match(disclosure, /請求があった場合には遅滞なく開示します/);
  assert.match(disclosure, /seller\?\.disclosureMode === "on_request"/);
  assert.match(disclosure, /販売者情報の開示について/);
  assert.match(disclosure, /問い合わせ・開示請求窓口/);
  assert.match(disclosure, /function safeHttpsUrl/);
  assert.match(disclosure, /parsed\.protocol === "https:"/);
  assert.match(vars, /AAS_SELLER_TYPE=individual/);
  assert.match(vars, /AAS_SELLER_DISCLOSURE_MODE=on_request/);
});

test("service-role and Stripe secrets stay outside browser-visible configuration", async () => {
  const envExample = await read(".env.example");
  const client = await read("lib/commerce.ts");
  const plans = await read("components/commerce-plans-page.tsx");
  const billing = await read("components/billing-account-page.tsx");

  for (const source of [envExample, client, plans, billing]) {
    assert.doesNotMatch(source, /AAS_SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(source, /AAS_STRIPE_SECRET_KEY/);
    assert.doesNotMatch(source, /AAS_STRIPE_WEBHOOK_SECRET/);
    assert.doesNotMatch(source, /^\s*NEXT_PUBLIC_[A-Z0-9_]+\s*=\s*(?:sb_secret_|sk_(?:live|test)_|whsec_)/im);
  }

  assert.match(client, /client\.auth\.getSession\(\)/);
  assert.match(client, /authorization: `Bearer \$\{token\}`/);
  assert.match(client, /validatedStripeRedirect/);
  assert.match(client, /"checkout\.stripe\.com"/);
  assert.match(client, /"billing\.stripe\.com"/);
  assert.match(client, /parsed\.username \|\| parsed\.password/);
});

test("purchase UI states renewal and cancellation terms before Checkout", async () => {
  const plans = await read("components/commerce-plans-page.tsx");
  const accessCode = await read("components/commerce/commerce-access-code-panel.tsx");
  const disclosure = await read("components/commercial-transactions-page.tsx");
  const billing = await read("components/billing-account-page.tsx");
  const client = await read("lib/commerce.ts");

  assert.match(plans, /1か月ごとの自動更新/);
  assert.match(plans, /7日間・自動更新なし/);
  assert.match(plans, /特定商取引法に基づく表記/);
  assert.match(plans, /accepted/);
  assert.match(plans, /checkoutInFlight/);
  assert.match(plans, /if \(checkoutInFlight\.current\) return/);
  assert.match(accessCode, /const inFlight = useRef\(false\)/);
  assert.match(accessCode, /if \(inFlight\.current\) return/);
  assert.match(billing, /portalInFlight/);
  assert.match(billing, /if \(portalInFlight\.current\) return/);
  assert.match(disclosure, /販売価格/);
  assert.match(disclosure, /支払時期/);
  assert.match(disclosure, /解約/);
  assert.match(disclosure, /返金・キャンセル/);
  assert.match(client, /Intl\.NumberFormat\("ja-JP"/);
});

test("free trial feature access fails closed when status verification is unavailable", async () => {
  const gate = await read("components/free-trial-feature-gate.tsx");

  assert.match(gate, /const \[loadError, setLoadError\]/);
  assert.match(gate, /setReady\(false\)/);
  assert.match(gate, /ACCESS CHECK/);
  assert.match(gate, /window\.location\.reload\(\)/);
  assert.doesNotMatch(gate, /\(\) => \{\s*if \(active\) setReady\(true\);\s*\}/s);
});

test("unentitled logged-in users are routed to plans and can redeem an existing access code", async () => {
  const access = await read("lib/phase6-access.ts");
  const plans = await read("components/commerce-plans-page.tsx");
  const accessCode = await read("components/commerce/commerce-access-code-panel.tsx");
  const invite = await read("lib/phase9-invite.ts");

  assert.match(access, /window\.location\.pathname !== "\/"/);
  assert.match(access, /window\.location\.replace\("\/plans\?from=login"\)/);
  assert.match(plans, /CommerceAccessCodePanel/);
  assert.doesNotMatch(plans, /redeemPwaInvite|inviteInFlight|inviteCode/);
  assert.match(accessCode, /redeemPwaInvite/);
  assert.match(accessCode, /利用コードをお持ちの方/);
  assert.match(accessCode, /利用コードを登録/);
  assert.match(accessCode, /AI Action Studio/);
  assert.match(accessCode, /if \(inFlight\.current\) return/);
  assert.doesNotMatch(accessCode, /AI記事スタジオ|旧表記：招待コード/);
  assert.match(invite, /redeem_pwa_invite/);
});

test("Worker routes billing before the application handler, filters public billing config, records failures, and adds security headers", async () => {
  const entry = await read("worker/index.ts");
  assert.match(entry, /const billingResponse = await handleBillingRequest\(request, env\)/);
  assert.match(entry, /if \(billingResponse\) \{/);
  assert.match(entry, /BILLING_REQUEST_FAILED/);
  assert.match(entry, /WEBHOOK_REJECTED/);
  assert.match(entry, /filterPublicBillingConfig\(request, url, billingResponse\)/);
  assert.match(entry, /return withSecurityHeaders\(await filterPublicBillingConfig\(request, url, billingResponse\)\)/);
  assert.match(entry, /withSecurityHeaders\(await handler\.fetch\(request, env, ctx\)\)/);
  assert.ok(entry.indexOf("handleBillingRequest(request") < entry.indexOf("handler.fetch(request"));
  assert.ok(entry.indexOf("filterPublicBillingConfig(request, url, billingResponse)") < entry.indexOf("handler.fetch(request"));
  for (const header of [
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "permissions-policy",
    "content-security-policy",
    "strict-transport-security",
  ]) {
    assert.match(entry, new RegExp(header));
  }
});


test("external sales CTA is rendered only from a guarded HTTPS URL", async () => {
  const [plans, sales] = await Promise.all([
    read("components/commerce-plans-page.tsx"),
    read("lib/sales-settings.ts"),
  ]);

  assert.match(plans, /外部販売ページで購入する/);
  assert.match(plans, /externalPurchaseUrl \? "外部販売を受付中です" : "外部販売ページを準備中です"/);
  assert.match(plans, /rel="noopener noreferrer"/);
  assert.match(sales, /safeExternalSalesUrl/);
});

test("public commerce shortcuts stay below signed-out auth and access status surfaces", async () => {
  const [home, css] = await Promise.all([
    read("app/page.tsx"),
    read("app/phase27-commerce.css"),
  ]);

  assert.match(home, /commerce-public-shortcuts/);
  assert.match(
    css,
    /\.auth-page \+ \.commerce-public-shortcuts,\s*\.status-page \+ \.commerce-public-shortcuts\s*\{[\s\S]*?margin-top:\s*16px;/,
  );
});

