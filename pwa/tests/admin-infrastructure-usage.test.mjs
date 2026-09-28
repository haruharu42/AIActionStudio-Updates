import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(pwaRoot, relative), "utf8");

test("admin infrastructure usage is a dedicated active-admin route", async () => {
  const [route, adminLayout, sections, rootLayout] = await Promise.all([
    read("app/admin/infrastructure/page.tsx"),
    read("app/admin/layout.tsx"),
    read("lib/admin-sections.ts"),
    read("app/layout.tsx"),
  ]);

  assert.match(route, /AdminInfrastructureUsagePage/);
  assert.match(adminLayout, /AdminRouteGuard/);
  assert.match(sections, /"infrastructure"/);
  assert.match(sections, /\/admin\/infrastructure/);
  assert.match(sections, /インフラ使用量・料金/);
  assert.match(rootLayout, /phase52-infrastructure-usage\.css/);
});

test("infrastructure usage reuses protected Supabase capacity data and public GitHub metrics", async () => {
  const [usage, page, operations] = await Promise.all([
    read("lib/infrastructure-usage.ts"),
    read("components/admin-infrastructure-usage-page.tsx"),
    read("lib/operations-admin.ts"),
  ]);

  assert.match(usage, /loadOpsSnapshot/);
  assert.match(usage, /refreshOpsCapacity/);
  assert.match(operations, /admin_ops_get_snapshot/);
  assert.match(operations, /admin_ops_refresh_capacity/);

  assert.match(usage, /AAS_GITHUB_REPOSITORY = "haruharu42\/AIArticleStudio-Updates"/);
  assert.match(usage, /api\.github\.com\/repos/);
  assert.match(usage, /\/actions\/runs/);
  assert.match(usage, /\/actions\/artifacts/);
  assert.match(usage, /\/actions\/caches/);
  assert.match(page, /GitHub Billingを開く/);
  assert.match(page, /Supabase Usageを開く/);

  assert.doesNotMatch(usage, /service[_-]?role|sb_secret_|github_token|ghp_/i);
  assert.doesNotMatch(page, /service[_-]?role|sb_secret_|github_token|ghp_/i);
});

test("usage dashboard keeps official quota and cost references explicit and conservative", async () => {
  const [usage, page] = await Promise.all([
    read("lib/infrastructure-usage.ts"),
    read("components/admin-infrastructure-usage-page.tsx"),
  ]);

  assert.match(usage, /INFRASTRUCTURE_PRICING_REFERENCE_DATE = "2026-09-28"/);
  assert.match(usage, /actionsMinutesPerMonth: 2_000/);
  assert.match(usage, /artifactStorageBytes: 500 \* MIB/);
  assert.match(usage, /actionsMinutesPerMonth: 3_000/);
  assert.match(usage, /actionsMinutesPerMonth: 50_000/);
  assert.match(usage, /GITHUB_CACHE_INCLUDED_BYTES = 10 \* GIB/);
  assert.match(usage, /GITHUB_SHARED_STORAGE_OVERAGE_USD_PER_GB_MONTH = 0\.25/);
  assert.match(usage, /GITHUB_CACHE_OVERAGE_USD_PER_GB_MONTH = 0\.07/);
  assert.match(usage, /SUPABASE_STORAGE_OVERAGE_USD_PER_GB_MONTH = 0\.0213/);
  assert.match(usage, /SUPABASE_GP3_DISK_OVERAGE_USD_PER_GB_MONTH = 0\.125/);
  assert.match(usage, /500 \* MIB/);
  assert.match(usage, /storageIncludedBytes: 1 \* GIB/);
  assert.match(usage, /databaseOrDiskIncludedBytes: 8 \* GIB/);
  assert.match(usage, /storageIncludedBytes: 100 \* GIB/);

  assert.match(page, /Public repositoryの標準GitHub-hosted runnerは無料/);
  assert.match(page, /最終的な請求額を公式Billing画面で確認/);
  assert.match(page, /Database実使用量と有料プランのprovisioned diskは別指標/);
  assert.match(page, /Workflow Run数。請求対象の分数そのものではありません/);
});

test("GitHub plan choice is local-only metadata and does not weaken admin/database authorization", async () => {
  const usage = await read("lib/infrastructure-usage.ts");
  const adminGuard = await read("components/admin-route-guard.tsx");

  assert.match(usage, /aas-admin-infrastructure-github-plan:v1/);
  assert.match(usage, /window\.localStorage/);
  assert.match(adminGuard, /profile\.role !== "admin"/);
  assert.match(adminGuard, /profile\.status !== "active"/);
  assert.doesNotMatch(usage, /supabase\.from\(|\.rpc\(/);
});
