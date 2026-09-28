import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("Phase 63 adds a server-enforced Stable promotion gate", async () => {
  const migration = await readRepo("supabase/migrations/20260924202500_stable_promotion_gate_v1.sql");

  assert.match(migration, /private\.aas_validate_stable_promotion_bundle/);
  assert.match(migration, /public\.admin_validate_stable_promotion_bundle/);
  assert.match(migration, /public\.admin_publish_knowledge_refresh_bundle_v4/);
  assert.match(migration, /request_channel = 'stable'/);
  assert.match(migration, /stable promotion gate failed/);
  assert.match(migration, /admin_publish_knowledge_refresh_bundle_v3/);
  assert.match(migration, /private\.is_active_admin/);
  assert.doesNotMatch(migration, /grant .* to anon/i);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|api[_-]?key/i);
});

test("Stable gate mirrors Top-5 rank and all semantic contract dimensions", async () => {
  const migration = await readRepo("supabase/migrations/20260924202500_stable_promotion_gate_v1.sql");

  for (const task of [
    "sidejob_content","sidejob_sns","sidejob_video","sidejob_affiliate",
    "sidejob_resale","sidejob_crowdsourcing","sidejob_skill_sales",
    "sidejob_digital_product","sidejob_outreach","sidejob_research",
    "sidejob_efficiency","sidejob_planning",
  ]) {
    assert.ok(migration.includes(task), `missing Stable contract task: ${task}`);
  }

  assert.match(migration, /where position <= 5/);
  assert.match(migration, /priority \+ eligible\.specificity desc/);
  assert.match(migration, /stable_top5_shortage/);
  assert.match(migration, /stable_core_contract_missing/);
  assert.match(migration, /stable_support_contract_missing/);
  assert.match(migration, /stable_top_rule_not_task_specific/);
  assert.match(migration, /stable_selected_source_missing/);
  assert.match(migration, /stable_selected_source_stale/);
  assert.match(migration, /stale_days integer := 90/);
  assert.match(migration, /from public\.knowledge_stable_catalog as catalog/);
  assert.match(migration, /existing_release <> 'fresh_first'/);
  assert.match(migration, /existing_stable_at > now\(\)/);
});

test("Stable gate evaluates prospective catalog with bundle overrides", async () => {
  const migration = await readRepo("supabase/migrations/20260924202500_stable_promotion_gate_v1.sql");

  assert.match(migration, /bundle_knowledge as/);
  assert.match(migration, /prospective_catalog as/);
  assert.match(migration, /not exists[\s\S]*incoming\.key = catalog\.key/);
  assert.match(migration, /union all[\s\S]*from bundle_knowledge as incoming/);
  assert.match(migration, /source_checked_at[\s\S]*now\(\)/);
});

test("Stable review UI previews the gate and blocks publish until it passes", async () => {
  const [client, panel, css] = await Promise.all([
    readPwa("lib/knowledge-auto-update.ts"),
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("app/phase26-knowledge.css"),
  ]);

  assert.match(client, /StablePromotionReport/);
  assert.match(client, /adminValidateStablePromotionBundle/);
  assert.match(client, /admin_validate_stable_promotion_bundle/);
  assert.match(client, /admin_publish_knowledge_refresh_bundle_v4/);
  assert.match(panel, /stablePromotionReport/);
  assert.match(panel, /Stable昇格ゲート/);
  assert.match(panel, /Stableゲート通過後に公開/);
  assert.match(panel, /selected\.channel === "stable" && !stablePromotionReport\?\.valid/);
  assert.match(css, /\.knowledge-stable-gate/);
  assert.match(css, /\.knowledge-stable-gate-grid/);
});


test("Phase 63 separates mutable Fresh rows from durable Stable snapshots", async () => {
  const migration = await readRepo("supabase/migrations/20260924202500_stable_promotion_gate_v1.sql");

  assert.match(migration, /create table if not exists public\.knowledge_stable_catalog/);
  assert.match(migration, /create table if not exists public\.prompt_optimization_stable_catalog/);
  assert.match(migration, /alter table public\.knowledge_stable_catalog enable row level security/);
  assert.match(migration, /revoke all on table public\.knowledge_stable_catalog from public, anon, authenticated/);
  assert.match(migration, /from public\.knowledge_stable_catalog as catalog/);
  assert.match(migration, /from public\.prompt_optimization_stable_catalog as item/);
  assert.match(migration, /Stableへ昇格するKnowledgeは、先に同じkeyをFreshで公開/);
  assert.match(migration, /stable_wait_window_active/);
  assert.match(migration, /stable_bundle_differs_from_fresh/);
  assert.match(migration, /変更は先にFreshへ公開してください/);
  assert.match(migration, /if member_access then/);
  assert.doesNotMatch(migration, /or catalog\.stable_available_at <= now\(\)/);
});

test("v4 publication snapshots only gate-approved Stable bundle keys", async () => {
  const migration = await readRepo("supabase/migrations/20260924202500_stable_promotion_gate_v1.sql");

  assert.match(migration, /if request_channel = 'stable' then[\s\S]*insert into public\.knowledge_stable_catalog/);
  assert.match(migration, /jsonb_array_elements\(coalesce\(p_bundle -> 'knowledge_rules'/);
  assert.match(migration, /insert into public\.prompt_optimization_stable_catalog/);
  assert.match(migration, /on conflict \(key\) do update/);
  assert.match(migration, /promoted_at=now\(\)/);
});


test("Phase 63.1 bootstraps the legacy production state into Stable exactly once", async () => {
  const migration = await readRepo("supabase/migrations/20260924204000_stable_baseline_bootstrap_v1.sql");

  assert.match(migration, /stable_knowledge_count = 0/);
  assert.match(migration, /stable_prompt_count = 0/);
  assert.match(migration, /insert into public\.knowledge_stable_catalog/);
  assert.match(migration, /from public\.knowledge_catalog/);
  assert.match(migration, /insert into public\.prompt_optimization_stable_catalog/);
  assert.match(migration, /from public\.prompt_optimization_catalog/);
  assert.match(migration, /where status='active'/);
  assert.match(migration, /where channel='stable'/);
  assert.doesNotMatch(migration, /truncate|delete from public\.knowledge_stable_catalog|delete from public\.prompt_optimization_stable_catalog/i);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|api[_-]?key/i);
});
