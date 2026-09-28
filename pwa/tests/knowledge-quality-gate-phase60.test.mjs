import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("Phase 60 adds an admin-only server-enforced quality gate", async () => {
  const migration = await readRepo("supabase/migrations/20260924194000_knowledge_quality_gate_v1.sql");

  assert.match(migration, /private\.aas_validate_knowledge_refresh_bundle/);
  assert.match(migration, /public\.admin_validate_knowledge_refresh_bundle/);
  assert.match(migration, /public\.admin_publish_knowledge_refresh_bundle_v3/);
  assert.match(migration, /private\.is_active_admin/);
  assert.match(migration, /quality := private\.aas_validate_knowledge_refresh_bundle/);
  assert.match(migration, /knowledge quality gate failed/);
  assert.match(migration, /grant execute on function public\.admin_validate_knowledge_refresh_bundle\(jsonb\)\s+to authenticated/);
  assert.match(migration, /grant execute on function public\.admin_publish_knowledge_refresh_bundle_v3\(bigint, jsonb\)\s+to authenticated/);
  assert.doesNotMatch(migration, /grant execute .* to anon/i);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|api[_-]?key/i);

  assert.equal(
    (migration.match(/create or replace function private\.aas_validate_knowledge_refresh_bundle/g) ?? []).length,
    1,
    "private quality gate must be defined exactly once",
  );
  assert.equal(
    (migration.match(/create or replace function public\.admin_validate_knowledge_refresh_bundle/g) ?? []).length,
    1,
    "admin validation RPC must be defined exactly once",
  );
  assert.equal(
    (migration.match(/create or replace function public\.admin_publish_knowledge_refresh_bundle_v3/g) ?? []).length,
    1,
    "v3 publish RPC must be defined exactly once",
  );
});

test("quality gate blocks malformed or ungrounded Knowledge and Prompt items", async () => {
  const migration = await readRepo("supabase/migrations/20260924194000_knowledge_quality_gate_v1.sql");

  for (const code of [
    "duplicate_key",
    "knowledge_key_invalid",
    "knowledge_kind_invalid",
    "knowledge_tasks_invalid",
    "task_rule_scope_invalid",
    "knowledge_content_empty",
    "knowledge_sources_missing",
    "knowledge_source_url_invalid",
    "knowledge_source_summary_missing",
    "knowledge_priority_invalid",
    "prompt_key_invalid",
    "prompt_provider_invalid",
    "prompt_plan_invalid",
    "prompt_task_invalid",
    "prompt_rules_missing",
    "prompt_sources_missing",
    "prompt_source_url_invalid",
    "prompt_source_summary_missing",
    "prompt_priority_invalid",
  ]) {
    assert.ok(migration.includes(code), `missing quality rule: ${code}`);
  }

  assert.match(migration, /\^https:\/\//);
  assert.match(migration, /source_url_count/);
  assert.match(migration, /task_reference_count/);
  assert.match(migration, /jsonb_array_length\(blocking\) = 0/);
});

test("client uses v3 publish and falls back only when the RPC is actually missing", async () => {
  const client = await readPwa("lib/knowledge-auto-update.ts");

  assert.match(client, /adminValidateKnowledgeRefreshBundle/);
  assert.match(client, /admin_validate_knowledge_refresh_bundle/);
  assert.match(client, /admin_publish_knowledge_refresh_bundle_v3/);
  assert.match(client, /isMissingRpcError/);
  assert.match(client, /PGRST202/);
  assert.match(client, /current\.error && isMissingRpcError\(current\.error\)/);
  assert.match(client, /admin_publish_knowledge_refresh_bundle_v2/);
  assert.match(client, /parseKnowledgeQualityReport/);
  assert.match(client, /blocking\.length === 0/);
});

test("admin UI runs quality validation with diff review and blocks publish until valid", async () => {
  const [panel, css] = await Promise.all([
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("app/phase26-knowledge.css"),
  ]);

  assert.match(panel, /Promise\.all\(\[/);
  assert.match(panel, /adminPreviewKnowledgeRefreshBundleDiff/);
  assert.match(panel, /adminValidateKnowledgeRefreshBundle/);
  assert.match(panel, /qualityReport\?\.valid/);
  assert.match(panel, /品質ゲート通過/);
  assert.match(panel, /公開前の修正が必要/);
  assert.match(panel, /修正必須/);
  assert.match(panel, /確認推奨/);
  assert.match(panel, /BLOCK/);
  assert.match(panel, /WARN/);
  assert.match(panel, /品質ゲート: ブロック0件/);
  assert.match(css, /\.knowledge-quality-gate/);
  assert.match(css, /\.knowledge-quality-gate\.blocked/);
  assert.match(css, /\.knowledge-quality-issues\.blocking/);
  assert.match(css, /\.knowledge-quality-warnings/);
});

test("quality gate supports every core and side-hustle task", async () => {
  const migration = await readRepo("supabase/migrations/20260924194000_knowledge_quality_gate_v1.sql");
  const tasks = [
    "title","article","image","social","promotion",
    "sidejob_content","sidejob_sns","sidejob_video","sidejob_affiliate",
    "sidejob_resale","sidejob_crowdsourcing","sidejob_skill_sales",
    "sidejob_digital_product","sidejob_outreach","sidejob_research",
    "sidejob_efficiency","sidejob_planning",
  ];

  for (const task of tasks) {
    assert.ok(migration.includes(`'${task}'`), `missing task in quality gate: ${task}`);
  }
});
