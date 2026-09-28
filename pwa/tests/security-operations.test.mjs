import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(root, "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("operations migration protects logs behind RLS and admin/service RPCs", async () => {
  const sql = await readRepo("supabase/migrations/20260914053000_security_operations_center.sql");
  for (const table of ["ops_events", "ops_audit_runs", "ops_audit_findings", "ops_health_checks"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`alter table public\\.${table} force row level security`));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public,anon,authenticated`));
  }
  assert.match(sql, /record_client_error/);
  assert.match(sql, /ops_record_system_event/);
  assert.match(sql, /admin_ops_get_snapshot/);
  assert.match(sql, /admin_ops_run_security_audit/);
  assert.match(sql, /private\.is_active_admin/);
  assert.match(sql, /grant execute on function public\.ops_record_system_event[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function public\.ops_record_system_event[^;]+to authenticated/s);
});

test("operations audit covers RLS, anonymous RPC, billing, Storage and scheduler", async () => {
  const sql = await readRepo("supabase/migrations/20260914053000_security_operations_center.sql");
  for (const code of ["DB_RLS_FORCE", "ANON_RPC_EXECUTE", "SECDEF_SEARCH_PATH", "BILLING_AUTH_EXECUTE", "ARTICLE_BUCKET_CONFIG", "ARTICLE_STORAGE_POLICIES", "AUDIT_SCHEDULER"]) {
    assert.match(sql, new RegExp(code));
  }
  const scheduler = await readRepo("supabase/migrations/20260914053100_security_operations_scheduler.sql");
  assert.match(scheduler, /create extension if not exists pg_cron/);
  assert.match(scheduler, /aas-ops-security-audit-hourly/);
  assert.match(scheduler, /0 \* \* \* \*/);
  assert.match(scheduler, /private\.ops_run_database_audit\('scheduled'\)/);
});

test("capacity monitoring measures database and Storage without exposing its settings table", async () => {
  const sql = await readRepo("supabase/migrations/20260914054500_ops_capacity_monitoring.sql");
  assert.match(sql, /create table public\.ops_capacity_settings/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /revoke all on table public\.ops_capacity_settings from public, anon, authenticated/);
  assert.match(sql, /pg_database_size/);
  assert.match(sql, /from storage\.objects/);
  assert.match(sql, /admin_ops_update_capacity_settings/);
  assert.match(sql, /admin_ops_refresh_capacity/);
  assert.match(sql, /aas-ops-capacity-hourly/);
  assert.match(sql, /5 \* \* \* \*/);
  assert.match(sql, /SUPABASE_DATABASE_CAPACITY/);
  assert.match(sql, /SUPABASE_STORAGE_CAPACITY/);
});

test("error logging redacts secrets and never stores stack or request bodies", async () => {
  const client = await read("lib/ops.ts");
  const workerOps = await read("worker/ops.ts");
  const worker = await read("worker/index.ts");
  assert.match(client, /sb_secret_/);
  assert.match(client, /sk_\(\?:live\|test\)_/);
  assert.match(client, /whsec_/);
  assert.match(client, /record_client_error/);
  assert.doesNotMatch(client, /\.stack/);
  assert.match(workerOps, /ops_record_system_event/);
  assert.doesNotMatch(workerOps, /request\.text|request\.json|cookie/i);
  assert.match(worker, /WORKER_UNHANDLED_EXCEPTION/);
  assert.match(worker, /WEBHOOK_REJECTED/);
  assert.match(worker, /ctx\.waitUntil/);
  assert.doesNotMatch(worker, /request\.headers\.get\(["']authorization/);
});

test("operations health endpoint and admin UI are wired without exposing secrets", async () => {
  const worker = await read("worker/index.ts");
  const route = await read("app/admin/operations/page.tsx");
  const page = await read("components/operations-admin-page.tsx");
  const adminClient = await read("lib/operations-admin.ts");
  const layout = await read("app/layout.tsx");
  const topbar = await read("components/admin-home-topbar.tsx");
  const sections = await read("lib/admin-sections.ts");
  assert.match(worker, /\/api\/ops\/health/);
  assert.match(route, /OperationsAdminPage/);
  assert.match(page, /Security & Operations|SECURITY & OPERATIONS/);
  assert.match(page, /今すぐ監査/);
  assert.match(page, /エラー・セキュリティログ/);
  assert.match(page, /Supabase使用容量/);
  assert.match(page, /容量設定を保存/);
  assert.match(adminClient, /admin_ops_get_snapshot/);
  assert.match(adminClient, /admin_ops_set_event_status/);
  assert.match(adminClient, /admin_ops_update_capacity_settings/);
  assert.match(adminClient, /admin_ops_refresh_capacity/);
  assert.match(layout, /AppErrorReporter/);
  assert.match(layout, /phase30-security-operations\.css/);
  assert.match(topbar, /ADMIN_HOME_SHORTCUT_IDS/);
  assert.match(sections, /\/admin\/operations/);
  assert.doesNotMatch(`${page}\n${adminClient}`, /AAS_SUPABASE_SERVICE_ROLE_KEY|AAS_STRIPE_SECRET_KEY|AAS_STRIPE_WEBHOOK_SECRET/);
});

test("fully opaque browser script diagnostics are warnings while actionable client errors stay errors", async () => {
  const migration = await readRepo("supabase/migrations/20260928072031_ops_opaque_script_warning_v1.sql");

  assert.match(migration, /v_event_kind text := 'error'/);
  assert.match(migration, /v_severity text := 'error'/);
  assert.match(migration, /v_code = 'WINDOW_SCRIPT_ERROR_OPAQUE'/);
  assert.match(migration, /v_event_kind := 'warning'/);
  assert.match(migration, /v_severity := 'warning'/);
  assert.match(migration, /private\.ops_upsert_event/);
  assert.match(migration, /error_code='WINDOW_SCRIPT_ERROR_OPAQUE'/);
  assert.match(migration, /status='resolved'/);
  assert.match(migration, /grant execute on function public\.record_client_error\(text,text,text,text,text\) to authenticated/);
  assert.doesNotMatch(migration, /grant .* to anon/i);
});

test("global error boundary reports safe messages instead of stack traces", async () => {
  const reporter = await read("components/app-error-reporter.tsx");
  const ops = await read("lib/ops.ts");
  const boundary = await read("app/error.tsx");
  assert.match(reporter, /unhandledrejection/);
  assert.match(reporter, /windowErrorDiagnostic/);
  assert.match(ops, /WINDOW_ERROR/);
  assert.match(ops, /WINDOW_SCRIPT_ERROR_OPAQUE/);
  assert.match(boundary, /ROUTE_RENDER_ERROR/);
  assert.doesNotMatch(`${reporter}\n${ops}\n${boundary}`, /\.stack/);
});

test("user data isolation hardening is explicit and continuously audited", async () => {
  const sql = await readRepo("supabase/migrations/20260916023000_user_data_isolation_hardening.sql");
  for (const table of [
    "admin_user_actions",
    "article_quota_settings",
    "billing_customers",
    "billing_events",
    "commerce_sales_settings",
    "knowledge_candidate_decisions",
    "knowledge_candidate_signals",
    "pwa_invite_redemptions",
    "pwa_invites",
  ]) {
    assert.match(sql, new RegExp(`['\"]${table}['\"]`));
  }
  for (const policy of [
    "profiles_select_self_or_admin",
    "articles_select_own_active",
    "article_workspaces_select_own_active",
    "article_assets_select_own_active",
    "user_entitlements_select_own",
    "billing_checkout_sessions_select_own",
    "billing_subscriptions_select_own",
    "user_writing_profiles_select_own_active",
  ]) {
    assert.match(sql, new RegExp(policy));
  }
  for (const storagePolicy of [
    "article_assets_storage_insert_prepared",
    "article_assets_storage_select_ready",
    "article_assets_storage_select_delete_pending",
    "article_assets_storage_delete_pending",
  ]) {
    assert.match(sql, new RegExp(storagePolicy));
  }
  assert.match(sql, /for all to anon, authenticated using \(false\) with check \(false\)/);
  assert.match(sql, /revoke all on table public\.%I from public, anon, authenticated/);
  assert.match(sql, /auth\.uid/);
  assert.match(sql, /raw_user_meta_data\|user_metadata/);
  assert.match(sql, /security_invoker=true/);
  assert.match(sql, /private\.is_active_admin/);
  assert.match(sql, /USER_DATA_OWNER_POLICY_MISSING/);
  assert.match(sql, /USER_DATA_STORAGE_POLICY_WEAK/);
  assert.match(sql, /USER_METADATA_AUTHORIZATION/);
  assert.match(sql, /ADMIN_RPC_AUTHORIZATION_MISSING/);
  assert.match(sql, /user-data-isolation/);
  assert.match(sql, /aas-user-data-isolation-audit-hourly/);
  assert.match(sql, /7 \* \* \* \*/);
  assert.match(sql, /private\.ops_run_user_data_isolation_audit\(\)/);
});


test("Supabase plan guide shows current USD pricing with approximate Japanese yen", async () => {
  const guide = await read("components/supabase-plan-guide.tsx");
  assert.match(guide, /\$0 \/ 月/);
  assert.match(guide, /\$25〜 \/ 月/);
  assert.match(guide, /\$599〜 \/ 月/);
  assert.match(guide, /JPY_REFERENCE_RATE = 157/);
  assert.match(guide, /1 USD ≈ ¥157/);
  assert.match(guide, /2026-09-19時点/);
  assert.match(guide, /日本円も個別見積/);
  assert.match(guide, /為替・税・決済会社の換算レート/);
});
