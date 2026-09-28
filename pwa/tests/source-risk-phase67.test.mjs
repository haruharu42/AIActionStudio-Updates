import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("Phase 67 source risk report is admin-only and read-only", async () => {
  const migration = await readRepo("supabase/migrations/20260925004000_knowledge_source_risk_report_v1.sql");

  assert.match(migration, /admin_get_knowledge_source_risk_report/);
  assert.match(migration, /private\.is_active_admin/);
  assert.match(migration, /security definer/);
  assert.match(migration, /stable/);
  assert.match(migration, /revoke all on function/);
  assert.match(migration, /to authenticated/);
  assert.doesNotMatch(migration, /grant execute[\s\S]*to anon;/i);
  assert.doesNotMatch(migration, /insert into|update public\.knowledge_catalog|delete from public\.knowledge_catalog/i);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|api[_-]?key/i);
});

test("source risk report measures URL and domain concentration without auto-rejecting items", async () => {
  const migration = await readRepo("supabase/migrations/20260925004000_knowledge_source_risk_report_v1.sql");

  assert.match(migration, /single_source_count/);
  assert.match(migration, /single_domain_count/);
  assert.match(migration, /multi_domain_count/);
  assert.match(migration, /unique_domain_count/);
  assert.match(migration, /top_domain_share_percent/);
  assert.match(migration, /domain_usage/);
  assert.match(migration, /regexp_replace\(raw_host, '\^www\\\.'/);
  assert.match(migration, /review_items/);
});

test("client parses the source diversity report", async () => {
  const client = await readPwa("lib/knowledge-auto-update.ts");

  assert.match(client, /export type SourceRiskReport/);
  assert.match(client, /export type SourceRiskDomain/);
  assert.match(client, /export type SourceRiskItem/);
  assert.match(client, /parseSourceRiskReport/);
  assert.match(client, /adminGetSourceRiskReport/);
  assert.match(client, /admin_get_knowledge_source_risk_report/);
});

test("admin UI shows source diversity metrics as review support", async () => {
  const [panel, css] = await Promise.all([
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("app/phase26-knowledge.css"),
  ]);

  assert.match(panel, /SOURCE DIVERSITY/);
  assert.match(panel, /根拠ドメインの分散状況/);
  assert.match(panel, /単一ソースは自動で不合格にはしません/);
  assert.match(panel, /使用ドメイン上位/);
  assert.match(panel, /単一ソース \/ 単一ドメインの確認候補/);
  assert.match(panel, /adminGetSourceRiskReport/);
  assert.match(css, /\.knowledge-source-risk-report/);
  assert.match(css, /\.knowledge-source-risk-metrics/);
  assert.match(css, /\.knowledge-source-domain-list/);
});
