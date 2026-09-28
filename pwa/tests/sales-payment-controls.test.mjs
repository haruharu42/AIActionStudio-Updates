import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(root, "..");
const readPwa = (relative) => readFile(path.join(root, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("sales settings default to external/code on and Stripe sales off", async () => {
  const migration = await readRepo("supabase/migrations/20260915074000_commerce_sales_controls.sql");

  assert.match(migration, /external_sales_enabled boolean not null default true/i);
  assert.match(migration, /access_code_enabled boolean not null default true/i);
  assert.match(migration, /stripe_checkout_enabled boolean not null default false/i);
  assert.match(migration, /pwa_7day_enabled boolean not null default false/i);
  assert.match(migration, /pwa_monthly_enabled boolean not null default false/i);
  assert.match(migration, /windows_monthly_enabled boolean not null default false/i);
  assert.match(migration, /bundle_monthly_enabled boolean not null default false/i);
});

test("sales settings are active-admin controlled and do not destructively revoke existing rights", async () => {
  const migration = await readRepo("supabase/migrations/20260915074000_commerce_sales_controls.sql");

  assert.match(migration, /admin_get_commerce_sales_settings/);
  assert.match(migration, /admin_update_commerce_sales_settings/);
  assert.match(migration, /private\.is_active_admin\(\)/);
  assert.match(migration, /access_code_enabled/);
  assert.match(migration, /access code redemption is disabled/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.user_entitlements/i);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.billing_subscriptions/i);
  assert.doesNotMatch(migration, /update\s+public\.billing_subscriptions\s+set\s+status/i);
});

test("Stripe Checkout is gated server-side and billing portal remains available", async () => {
  const [salesWorker, index, billing] = await Promise.all([
    readPwa("worker/sales-controls.ts"),
    readPwa("worker/index.ts"),
    readPwa("worker/billing.ts"),
  ]);

  assert.match(salesWorker, /\/api\/billing\/checkout/);
  assert.match(salesWorker, /stripeCheckoutEnabled/);
  assert.match(salesWorker, /PLAN_FLAGS/);
  assert.match(salesWorker, /販売受付設定を確認できないため、新規決済を停止しています/);
  assert.match(salesWorker, /Stripeでの新規購入受付は停止しています/);
  assert.doesNotMatch(salesWorker, /\/api\/billing\/portal/);
  assert.doesNotMatch(salesWorker, /AAS-WIN-MONTHLY/);
  assert.doesNotMatch(salesWorker, /AAS-BUNDLE-MONTHLY/);
  assert.doesNotMatch(salesWorker, /windows_monthly_enabled/);
  assert.doesNotMatch(salesWorker, /bundle_monthly_enabled/);
  assert.ok(index.indexOf("handleSalesControlRequest") < index.indexOf("handleBillingRequest(request, env)"));
  assert.match(index, /rejectLegacyCheckout/);
  assert.match(billing, /\/api\/billing\/portal/);
});

test("admin UI exposes sales controls while PWA runtime omits legacy plan switches", async () => {
  const [adminSections, settingsPage, settingsLib, layout, presets, selectControl] = await Promise.all([
    readPwa("lib/admin-sections.ts"),
    readPwa("components/sales-settings-admin-page.tsx"),
    readPwa("lib/sales-settings.ts"),
    readPwa("app/layout.tsx"),
    readPwa("lib/sales-presets.ts"),
    readPwa("components/admin-sales/sales-select-setting.tsx"),
  ]);

  assert.match(adminSections, /href: "\/admin\/sales"/);
  for (const label of [
    "note / Brain / Tips等の外部販売",
    "利用コード受付",
    "Stripe新規購入受付",
    "PWA 7日利用パス",
    "PWA 月額プラン",
  ]) assert.ok(settingsPage.includes(label), `missing admin setting: ${label}`);
  assert.match(settingsPage, /既存の契約・利用期間・利用権は停止・取消しされません/);
  assert.match(settingsPage, /販売モードプリセット/);
  assert.match(settingsPage, /SellerSettingsPanel/);
  const sellerPanel = await readPwa("components/admin-sales/seller-settings-panel.tsx");
  const sellerLib = await readPwa("lib/seller-settings.ts");
  assert.match(sellerPanel, /販売者情報・公開方法/);
  assert.match(sellerPanel, /公開サポートURL/);
  assert.match(sellerPanel, /販売者情報を保存/);
  assert.match(sellerLib, /admin_get_commerce_seller_settings/);
  assert.match(sellerLib, /admin_update_commerce_seller_settings/);
  assert.match(sellerLib, /認証情報を含まないHTTPS URL/);
  assert.match(presets, /外部販売中心（推奨）/);
  assert.match(presets, /applySalesPresetToSettings/);
  assert.match(presets, /inferSalesPreset/);
  assert.match(selectControl, /受付する \/ ON/);
  assert.match(selectControl, /停止する \/ OFF/);
  assert.match(settingsPage, /保存するまで本番設定は変わりません/);
  assert.match(settingsPage, /AI Action Studio（AAS）/);
  assert.doesNotMatch(settingsPage, /title="Windows 月額プラン"/);
  assert.doesNotMatch(settingsPage, /title="PWA \+ Windows 月額"/);
  assert.match(settingsLib, /admin_get_commerce_sales_settings/);
  assert.match(settingsLib, /admin_update_commerce_sales_settings/);
  assert.doesNotMatch(settingsLib, /windowsMonthlyEnabled/);
  assert.doesNotMatch(settingsLib, /bundleMonthlyEnabled/);
  assert.match(settingsLib, /p_windows_monthly_enabled: false/);
  assert.match(settingsLib, /p_bundle_monthly_enabled: false/);
  assert.match(layout, /phase32-sales-settings\.css/);
});

test("plans and access-code UI obey PWA-only public sales settings", async () => {
  const [plans, accessCode, settingsLib] = await Promise.all([
    readPwa("components/commerce-plans-page.tsx"),
    readPwa("components/commerce/commerce-access-code-panel.tsx"),
    readPwa("lib/sales-settings.ts"),
  ]);

  assert.match(plans, /fetchPublicSalesSettings/);
  assert.match(plans, /safeExternalSalesUrl/);
  assert.match(plans, /externalPurchaseUrl/);
  assert.match(plans, /外部販売ページで購入する/);
  assert.match(plans, /購入ページURLが未設定/);
  assert.match(plans, /rel="noopener noreferrer"/);
  assert.match(plans, /plan\.platformScope === "pwa"/);
  assert.match(plans, /planSalesEnabled\(salesSettings, plan\.planCode\)/);
  assert.match(plans, /CommerceAccessCodePanel enabled=\{Boolean\(salesSettings\?\.accessCodeEnabled\)\}/);
  assert.match(accessCode, /利用コードをお持ちの方/);
  assert.match(accessCode, /redeemPwaInvite/);
  assert.match(plans, /Stripe新規受付停止中/);
  assert.match(settingsLib, /if \(!settings\?\.stripeCheckoutEnabled\) return false/);
  for (const planCode of ["AAS-PWA-7DAY", "AAS-PWA-MONTHLY"]) {
    assert.ok(settingsLib.includes(planCode), `missing PWA plan gate: ${planCode}`);
  }
  assert.equal(settingsLib.includes('if (planCode === "AAS-WIN-MONTHLY")'), false);
  assert.equal(settingsLib.includes('if (planCode === "AAS-BUNDLE-MONTHLY")'), false);
});

test("commercial transaction copy follows the active sales mode and exposes a support route", async () => {
  const [page, support, terms, privacy, aiTerms] = await Promise.all([
    readPwa("components/commercial-transactions-page.tsx"),
    readPwa("components/support-request-page.tsx"),
    readPwa("app/terms/page.tsx"),
    readPwa("app/privacy/page.tsx"),
    readPwa("app/ai-terms/page.tsx"),
  ]);

  assert.match(page, /fetchPublicSalesSettings/);
  assert.match(page, /planSalesEnabled/);
  assert.match(page, /stripeSalesEnabled/);
  assert.match(page, /externalSalesEnabled/);
  assert.match(page, /safeExternalSalesUrl/);
  assert.match(page, /externalSalesReady/);
  assert.match(page, /購入ページURLが未設定/);
  assert.match(page, /AAS内のStripe新規購入は停止しています/);
  assert.match(page, /外部販売ページで案内する支払方法/);
  assert.match(page, /案内された利用コードをAASへ登録/);
  assert.match(page, /visibleStripePlans/);
  assert.match(page, /supportUrl = safeHttpsUrl\(seller\?\.supportUrl\) \|\| "\/support"/);
  assert.match(page, /問い合わせ・開示請求/);
  assert.match(page, /現在の外部販売ページを開く/);
  for (const pendingCopy of [
    "外部販売を開始する場合は、購入ページへ支払時期を表示します",
    "外部販売を開始する場合は、キャンセル・解約条件を購入ページへ表示します",
    "外部販売を開始する場合は、返金・キャンセル条件を購入確定前に販売ページへ表示します",
  ]) assert.ok(page.includes(pendingCopy), `missing pre-sale legal copy: ${pendingCopy}`);

  assert.match(support, /販売者情報の開示請求/);
  assert.match(support, /fetchPublicSalesSettings/);
  assert.match(support, /safeExternalSalesUrl/);
  assert.match(support, /購入ページURLは現在未設定/);
  assert.match(support, /外部販売ページを開く/);
  assert.match(support, /クレジットカード番号/);
  assert.match(support, /アクセストークン/);

  assert.match(terms, /初回の新規販売は、外部販売ページで購入/);
  assert.doesNotMatch(terms, /現在の新規販売は/);

  for (const legalPage of [terms, privacy, aiTerms]) {
    assert.doesNotMatch(legalPage, /公開準備ドラフト/);
    assert.match(legalPage, /\/support/);
  }
});


test("legacy public sales settings RPC is no longer callable by browser roles", async () => {
  const migration = await readRepo("supabase/migrations/20260925101747_lock_down_legacy_public_sales_settings_rpc.sql");
  const salesLib = await readPwa("lib/sales-settings.ts");

  assert.match(migration, /revoke execute on function public\.get_public_commerce_sales_settings\(\)\s*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.get_public_commerce_sales_settings\(\)\s*to service_role/i);
  assert.match(salesLib, /fetch\("\/api\/sales\/settings"/);
  assert.doesNotMatch(salesLib, /get_public_commerce_sales_settings/);
});


test("external-sales readiness is isolated and does not treat it as full production approval", async () => {
  const [page, panel, readiness] = await Promise.all([
    readPwa("components/sales-settings-admin-page.tsx"),
    readPwa("components/admin-sales/sales-readiness-panel.tsx"),
    readPwa("lib/sales-readiness.ts"),
  ]);

  assert.match(page, /SalesReadinessPanel settings=\{settings\} hasUnsavedChanges=\{changed\}/);
  assert.match(panel, /外部販売ルートの販売準備/);
  assert.match(panel, /未保存の変更を含む確認結果/);
  assert.match(panel, /変更を保存.*本番の販売設定は変わりません/s);
  assert.match(panel, /AAS全体の本番公開判定とは別/);
  assert.match(panel, /実機E2E・法務・サポート・公開段階/);
  assert.match(readiness, /getExternalSalesReadiness/);
  assert.match(readiness, /externalSalesEnabled/);
  assert.match(readiness, /accessCodeEnabled/);
  assert.match(readiness, /hasHttpsPurchaseUrl/);
  assert.match(readiness, /note \/ Brain \/ Tips等の実際の購入ページURL/);
});


test("sales center groups legal support and access-code review without auto-approving launch", async () => {
  const [page, preflight, css] = await Promise.all([
    readPwa("components/sales-settings-admin-page.tsx"),
    readPwa("components/admin-sales/sales-release-preflight-panel.tsx"),
    readPwa("app/phase32-sales-settings.css"),
  ]);

  assert.match(page, /SalesReleasePreflightPanel/);
  assert.match(preflight, /販売前チェック/);
  assert.match(preflight, /利用コードの発行・使用履歴を確認/);
  assert.match(preflight, /href="\/admin\/users"/);
  assert.match(preflight, /auth\.mfa\.listFactors\(\)/);
  assert.match(preflight, /管理者MFA/);
  assert.match(preflight, /verifiedMfaCount/);
  assert.match(preflight, /href="\/admin\/security"/);
  assert.match(preflight, /漏洩パスワード保護/);
  assert.match(preflight, /要Dashboard確認/);
  for (const route of ["/commercial-transactions", "/terms", "/privacy", "/ai-terms", "/support"]) {
    assert.ok(preflight.includes(route), `missing pre-sale review route: ${route}`);
  }
  assert.match(preflight, /要人確認/);
  assert.match(preflight, /「販売可能」の自動判定にはしません/);
  assert.match(preflight, /価格・返金条件・販売者情報・サポート方針・公開段階は自動確定しません/);
  assert.match(preflight, /未保存の販売設定/);
  assert.match(preflight, /販売開始保留/);
  assert.match(preflight, /自動確認は通過/);
  assert.match(preflight, /fetchCommerceConfig/);
  assert.match(preflight, /legalReady/);
  assert.match(preflight, /販売者情報/);
  assert.match(preflight, /admin_list_pwa_invites/);
  assert.match(preflight, /usableInviteCount/);
  assert.match(preflight, /購入者へ渡せる有効な利用コードがありません/);
  assert.match(preflight, /販売用の利用コード/);
  assert.match(preflight, /automatedBlockers/);
  assert.match(preflight, /active管理者に確認済みMFAがありません/);
  assert.match(preflight, /解消するまで販売開始扱いにしないでください/);
  assert.match(css, /\.sales-release-gate/);
  assert.match(css, /\.sales-release-gate\.blocked/);
  assert.match(css, /\.sales-release-gate\.review/);
  assert.match(css, /\.sales-release-preflight-grid/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.sales-release-preflight-grid/);
});


test("access-code purchase flow owns its own request state", async () => {
  const [plans, accessCode, commerceCss] = await Promise.all([
    readPwa("components/commerce-plans-page.tsx"),
    readPwa("components/commerce/commerce-access-code-panel.tsx"),
    readPwa("app/phase27-commerce.css"),
  ]);

  assert.doesNotMatch(plans, /inviteCode|inviteBusy|inviteMessage|inviteSuccess|inviteInFlight|redeemInvite/);
  assert.match(accessCode, /const \[code, setCode\] = useState/);
  assert.match(accessCode, /const \[busy, setBusy\] = useState/);
  assert.match(accessCode, /const inFlight = useRef/);
  assert.match(accessCode, /await refresh\(\)/);
  assert.match(accessCode, /autoCapitalize="none"/);
  assert.match(accessCode, /autoCorrect="off"/);
  assert.match(accessCode, /spellCheck=\{false\}/);
  assert.match(accessCode, /enterKeyHint="done"/);
  assert.match(accessCode, /state\.kind === "ready" \|\| state\.kind === "entitlement_denied" \|\| state\.kind === "pending"/);
  assert.match(accessCode, /state\.kind === "ready" && !success/);
  assert.match(accessCode, /success && state\.kind === "ready"/);
  assert.match(commerceCss, /padding: 28px clamp\(14px, 4vw, 32px\) calc\(120px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(commerceCss, /@media \(max-width: 620px\)[\s\S]*?\.commerce-invite-form \{ align-items: stretch; flex-direction: column; \}/);
  assert.match(commerceCss, /@media \(max-width: 620px\)[\s\S]*?\.commerce-invite-form button \{ width: 100%; \}/);
});


test("sales legal pages match the current AAS PWA-only product model", async () => {
  const [commercial, terms, privacy, aiTerms, support] = await Promise.all([
    readPwa("components/commercial-transactions-page.tsx"),
    readPwa("app/terms/page.tsx"),
    readPwa("app/privacy/page.tsx"),
    readPwa("app/ai-terms/page.tsx"),
    readPwa("components/support-request-page.tsx"),
  ]);

  for (const source of [commercial, terms, privacy, aiTerms, support]) {
    assert.doesNotMatch(source, /AI記事スタジオ/);
  }
  assert.match(commercial, /AI Action Studio 販売条件/);
  assert.match(commercial, /新規販売はPWA版のみ/);
  assert.doesNotMatch(commercial, /Windows版は対応Windows環境/);
  assert.match(terms, /AI Action Studio PWA 利用規約/);
  assert.match(terms, /PWA利用権は同一のAASアカウントで管理/);
  assert.doesNotMatch(terms, /Windows版とPWA版/);
  assert.match(privacy, /AI Action Studio PWA プライバシーポリシー/);
  assert.match(privacy, /クラウド保存した記事・画像等/);
  assert.doesNotMatch(privacy, /Windows版とPWA版/);
  assert.match(aiTerms, /AI Action Studio PWA AI利用条件/);
  assert.match(support, /AI Action Studio お問い合わせ案内/);
});


test("external purchase URL is HTTPS-only and credential-free before rendering a CTA", async () => {
  const [settings, plans, workerSales] = await Promise.all([
    readPwa("lib/sales-settings.ts"),
    readPwa("components/commerce-plans-page.tsx"),
    readPwa("worker/sales-controls.ts"),
  ]);

  assert.match(settings, /export function safeExternalSalesUrl/);
  assert.match(settings, /parsed\.protocol !== "https:" \|\| parsed\.username \|\| parsed\.password/);
  assert.match(settings, /認証情報を含まない https:\/\//);
  assert.match(plans, /safeExternalSalesUrl\(salesSettings\.externalSalesUrl\)/);
  assert.match(plans, /externalPurchaseUrl && \(/);
  assert.match(workerSales, /function safeExternalSalesUrl/);
  assert.match(workerSales, /parsed\.protocol !== "https:" \|\| parsed\.username \|\| parsed\.password/);
  assert.match(workerSales, /externalSalesUrl: safeExternalSalesUrl\(row\.external_sales_url\)/);
});
