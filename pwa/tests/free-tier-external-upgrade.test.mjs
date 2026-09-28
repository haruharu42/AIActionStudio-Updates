import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(root, "..");
const readPwa = (relative) => readFile(path.join(root, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("external purchase URL is admin controlled and HTTPS-only", async () => {
  const [migration, settingsLib, settingsPage, worker] = await Promise.all([
    readRepo("supabase/migrations/20260915130000_external_sales_upgrade_url.sql"),
    readPwa("lib/sales-settings.ts"),
    readPwa("components/sales-settings-admin-page.tsx"),
    readPwa("worker/sales-controls.ts"),
  ]);

  assert.match(migration, /add column if not exists external_sales_url text/i);
  assert.match(migration, /external_sales_url_https_check/i);
  assert.match(migration, /active admin required/i);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.user_entitlements/i);
  assert.match(settingsLib, /validateExternalSalesUrl/);
  assert.match(settingsLib, /p_external_sales_url/);
  assert.match(settingsPage, /購入ページURL（note等）/);
  assert.match(settingsPage, /https:\/\/note\.com/);
  assert.match(worker, /external_sales_url/);
  assert.match(worker, /externalSalesUrl/);
});

test("permanent daily free tier preserves paid/admin bypass and daily quotas", async () => {
  const migration = await readRepo("supabase/migrations/20260915133000_permanent_daily_free_tier.sql");

  assert.match(migration, /permanent_daily_free_enabled boolean not null default true/i);
  assert.match(migration, /admin_get_permanent_daily_free_enabled/);
  assert.match(migration, /p_permanent_daily_free_enabled boolean/);
  assert.match(migration, /private\.has_active_product_entitlement\(current_user_id, 'AAS-PWA-BETA'\)/);
  assert.match(migration, /profile_role = 'admin'/);
  assert.match(migration, /settings\.permanent_daily_free_enabled is true\s+or trial\.ends_at > now\(\)/i);
  assert.match(migration, /if not settings\.permanent_daily_free_enabled and trial\.ends_at <= now\(\)/i);
  assert.match(migration, /settings\.daily_total_limit <= current_total/);
  assert.match(migration, /selected_limit <= current_feature/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.user_entitlements/i);
});

test("permanent daily free usage works without a legacy timed-trial row", async () => {
  const [independentUsage, conflictFix] = await Promise.all([
    readRepo("supabase/migrations/20260915143000_permanent_daily_free_independent_usage.sql"),
    readRepo("supabase/migrations/20260915144500_permanent_daily_free_usage_conflict_fix.sql"),
  ]);

  assert.match(independentUsage, /references public\.profiles\(id\) on delete cascade/i);
  assert.match(independentUsage, /settings\.permanent_daily_free_enabled is true/i);
  assert.match(independentUsage, /if not settings\.permanent_daily_free_enabled then/i);
  assert.match(independentUsage, /where profile\.id = current_user_id\s+for update/i);
  assert.doesNotMatch(independentUsage, /delete\s+from\s+public\.user_entitlements/i);
  assert.match(conflictFix, /on conflict on constraint free_trial_daily_usage_pkey/i);
});

test("admin can configure permanent mode and all daily limits", async () => {
  const [panel, helper] = await Promise.all([
    readPwa("components/free-trial-admin-panel.tsx"),
    readPwa("lib/free-tier-mode.ts"),
  ]);

  for (const label of [
    "期限なしの日次無料枠",
    "1日の総利用回数",
    "記事生成 / 日",
    "タイトル候補 / 日",
    "記事リライト / 日",
    "SNS投稿生成 / 日",
    "画像生成 / 日",
    "AI補助 / 日",
    "リセット時刻",
  ]) assert.ok(panel.includes(label), `missing free-tier admin setting: ${label}`);

  assert.match(helper, /admin_get_permanent_daily_free_enabled/);
  assert.match(helper, /p_permanent_daily_free_enabled/);
  assert.match(helper, /p_daily_total_limit/);
});

test("quota exhaustion prompt is dismissible, resets by usage date, and only links to a redeemable external sale", async () => {
  const [banner, freeTrialLib, layout] = await Promise.all([
    readPwa("components/free-trial-banner.tsx"),
    readPwa("lib/free-trial.ts"),
    readPwa("app/layout.tsx"),
  ]);

  assert.match(banner, /aas:free-trial-limit-dismissed:\$\{usageDate\}/);
  assert.match(banner, /次のリセットで無料利用回数が戻ります/);
  assert.match(banner, /この機能の本日の無料回数に達しました/);
  assert.match(banner, /ほかの機能は、本日の残り総回数/);
  assert.match(banner, /sales\?\.externalSalesEnabled && sales\.accessCodeEnabled && sales\.externalSalesUrl/);
  assert.match(banner, /利用権を見る/);
  assert.match(banner, />閉じる</);
  assert.match(banner, /permanentFree \? "無料プラン" : "無料トライアル"/);
  assert.match(freeTrialLib, /FREE_TRIAL_USAGE_CHANGED_EVENT/);
  assert.match(freeTrialLib, /notifyFreeTrialUsageChanged\(result\)/);
  assert.match(layout, /<FreeTrialBanner \/>/);
});


test("free-plan summary can collapse to a persistent usage-only view", async () => {
  const [banner, styles] = await Promise.all([
    readPwa("components/free-trial-banner.tsx"),
    readPwa("app/phase28-free-trial.css"),
  ]);

  assert.match(banner, /aas:free-trial-details-collapsed:\$\{userId\}/);
  assert.match(banner, /detailsCollapsed \? " is-collapsed" : ""/);
  assert.match(banner, /無料プラン詳細を閉じる/);
  assert.match(banner, /無料プラン詳細を開く/);
  assert.match(banner, /!detailsCollapsed && \(/);
  assert.match(styles, /\.free-trial-banner\.is-collapsed/);
  assert.match(styles, /\.free-trial-banner\.is-collapsed \.free-trial-usage/);
});
