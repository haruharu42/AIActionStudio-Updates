import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("stale pending knowledge requests are released after their channel refresh cycle", async () => {
  const migration = await readRepo("supabase/migrations/20260924175000_knowledge_pending_cycle_recovery.sql");

  assert.match(migration, /request\.status = 'pending'/);
  assert.match(migration, /make_interval\(hours => channel\.refresh_hours\)/);
  assert.match(migration, /pending request exceeded its channel refresh cycle/);
  assert.match(migration, /status = 'failed'/);
  assert.match(migration, /enqueue_due_knowledge_refreshes/);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|api[_-]?key/i);
});

test("public sales settings RPC exposes only safe public commerce fields", async () => {
  const migration = await readRepo("supabase/migrations/20260924175500_public_sales_settings_rpc.sql");

  assert.match(migration, /get_public_commerce_sales_settings/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /external_sales_enabled/);
  assert.match(migration, /access_code_enabled/);
  assert.match(migration, /external_sales_url/);
  assert.match(migration, /stripe_checkout_enabled/);
  assert.match(migration, /pwa_7day_enabled/);
  assert.match(migration, /pwa_monthly_enabled/);
  assert.match(migration, /grant execute .* to anon, authenticated, service_role/i);
  assert.doesNotMatch(migration, /updated_by|windows_monthly_enabled|bundle_monthly_enabled/i);
});

test("sales control worker prefers publishable-key public RPC and keeps privileged fallback", async () => {
  const worker = await readPwa("worker/sales-controls.ts");

  assert.match(worker, /AAS_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(worker, /rpc\/get_public_commerce_sales_settings/);
  assert.match(worker, /apikey: publishableKey/);
  assert.match(worker, /AAS_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(worker, /privilegedResponse/);
  assert.match(worker, /販売受付設定を確認できないため、新規決済を停止しています/);
});

test("preview and production deploys inject only public Supabase runtime variables", async () => {
  const [preview, production] = await Promise.all([
    readRepo(".github/workflows/pwa-preview-deploy.yml"),
    readRepo(".github/workflows/pwa-member-beta-deploy.yml"),
  ]);

  for (const workflow of [preview, production]) {
    assert.match(workflow, /--var "AAS_SUPABASE_URL:\$NEXT_PUBLIC_AAS_SUPABASE_URL"/);
    assert.match(workflow, /--var "AAS_SUPABASE_PUBLISHABLE_KEY:\$NEXT_PUBLIC_AAS_SUPABASE_PUBLISHABLE_KEY"/);
    assert.doesNotMatch(workflow, /--var "AAS_SUPABASE_SERVICE_ROLE_KEY:/);
  }
});
