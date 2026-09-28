import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("Phase 65 adds an admin-only source freshness queue", async () => {
  const migration = await readRepo("supabase/migrations/20260924233000_knowledge_source_freshness_queue_v1.sql");

  assert.match(migration, /admin_get_knowledge_source_freshness_queue/);
  assert.match(migration, /admin_prepare_knowledge_source_recheck/);
  assert.match(migration, /private\.is_active_admin/);
  assert.match(migration, /warning days must be less than stale days/);
  assert.match(migration, /interval '90 days'/);
  assert.match(migration, /interval '60 days'/);
  assert.match(migration, /'missing'/);
  assert.match(migration, /'stale'/);
  assert.match(migration, /'due'/);
  assert.match(migration, /'fresh'/);
  assert.match(migration, /grant execute on function[\s\S]*to authenticated;/i);
  assert.doesNotMatch(migration, /grant execute on function[\s\S]*to anon;/i);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|api[_-]?key/i);
});

test("source freshness preparation reuses the review-gated Fresh workflow", async () => {
  const migration = await readRepo("supabase/migrations/20260924233000_knowledge_source_freshness_queue_v1.sql");

  assert.match(migration, /where request\.channel='fresh'/);
  assert.match(migration, /request\.status in \('pending','processing'\)/);
  assert.match(migration, /'fresh',now\(\),now\(\),'processing'/);
  assert.match(migration, /Source Freshness Queue/);
  assert.doesNotMatch(migration, /admin_publish_knowledge_refresh_bundle/);
  assert.doesNotMatch(migration, /update public\.knowledge_catalog\s+set\s+source_checked_at/is);
});

test("client parses freshness states and builds a constrained source-review prompt", async () => {
  const client = await readPwa("lib/knowledge-auto-update.ts");

  assert.match(client, /SourceFreshnessState = "fresh" \| "due" \| "stale" \| "missing"/);
  assert.match(client, /parseSourceFreshnessQueue/);
  assert.match(client, /adminGetSourceFreshnessQueue/);
  assert.match(client, /adminPrepareSourceFreshnessRecheck/);
  assert.match(client, /buildSourceFreshnessResearchPrompt/);
  assert.match(client, /keyを変えない/);
  assert.match(client, /公式根拠を実際に開いて確認/);
  assert.match(client, /確認できない項目を推測で通さない/);
  assert.match(client, /公開処理でsource_checked_atを更新/);
});

test("admin operations UI surfaces source freshness without bypassing quality review", async () => {
  const [panel, css] = await Promise.all([
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("app/phase26-knowledge.css"),
  ]);

  assert.match(panel, /SOURCE FRESHNESS QUEUE/);
  assert.match(panel, /公式根拠の再確認/);
  assert.match(panel, /再確認プロンプトを準備・コピー/);
  assert.match(panel, /adminPrepareSourceFreshnessRecheck/);
  assert.match(panel, /buildSourceFreshnessResearchPrompt/);
  assert.match(panel, /変更点を確認/);
  assert.match(panel, /品質ゲート/);
  assert.match(css, /\.knowledge-source-freshness-queue/);
  assert.match(css, /\.knowledge-source-freshness-items/);
  assert.match(css, /\.knowledge-source-recheck/);
});
