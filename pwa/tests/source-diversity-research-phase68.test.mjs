import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("Phase 68 diversity research preparation is admin-only and review-gated", async () => {
  const migration = await readRepo("supabase/migrations/20260925012000_source_diversity_research_v1.sql");

  assert.match(migration, /admin_prepare_source_diversity_research/);
  assert.match(migration, /private\.is_active_admin/);
  assert.match(migration, /security definer/);
  assert.match(migration, /request\.channel='fresh'/);
  assert.match(migration, /status in \('pending','processing'\)/);
  assert.match(migration, /Source Diversity Research/);
  assert.match(migration, /revoke all on function/);
  assert.match(migration, /to authenticated/);
  assert.doesNotMatch(migration, /grant execute[\s\S]*to anon;/i);
  assert.doesNotMatch(migration, /update public\.knowledge_catalog|update public\.prompt_optimization_catalog|delete from public\.knowledge_catalog/i);
});

test("Phase 68 selects only weakly diversified source items and preserves current payload", async () => {
  const migration = await readRepo("supabase/migrations/20260925012000_source_diversity_research_v1.sql");

  assert.match(migration, /source_count <= 1 or domain_count <= 1/);
  assert.match(migration, /count\(distinct url\.domain\)/);
  assert.match(migration, /source_urls/);
  assert.match(migration, /'payload',payload/);
  assert.match(migration, /single_source_count/);
  assert.match(migration, /single_domain_count/);
});

test("client builds a non-gaming source diversity research prompt", async () => {
  const client = await readPwa("lib/knowledge-auto-update.ts");

  assert.match(client, /SourceDiversityResearchPreparation/);
  assert.match(client, /adminPrepareSourceDiversityResearch/);
  assert.match(client, /admin_prepare_source_diversity_research/);
  assert.match(client, /buildSourceDiversityResearchPrompt/);
  assert.match(client, /source_urlsの件数を増やすこと自体を目標にしない/);
  assert.match(client, /低品質な2件目を無理に追加しない/);
  assert.match(client, /公式・一次情報/);
  assert.match(client, /追加根拠なし/);
  assert.match(client, /既存keyは絶対に変更しない/);
});

test("admin UI connects diversity candidates to the existing Fresh review flow", async () => {
  const [panel, css] = await Promise.all([
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("app/phase26-knowledge.css"),
  ]);

  assert.match(panel, /prepareSourceDiversityResearch/);
  assert.match(panel, /adminPrepareSourceDiversityResearch/);
  assert.match(panel, /buildSourceDiversityResearchPrompt/);
  assert.match(panel, /追加根拠リサーチを準備・コピー/);
  assert.match(panel, /独立した公式\/一次情報が見つかった項目だけ更新/);
  assert.match(panel, /setSelectedId\(prepared\.requestId\)/);
  assert.match(css, /\.knowledge-source-diversity-research/);
});
