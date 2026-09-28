import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

const sidejobTasks = [
  "sidejob_content",
  "sidejob_sns",
  "sidejob_video",
  "sidejob_affiliate",
  "sidejob_resale",
  "sidejob_crowdsourcing",
  "sidejob_skill_sales",
  "sidejob_digital_product",
  "sidejob_outreach",
  "sidejob_research",
  "sidejob_efficiency",
  "sidejob_planning",
];

test("Knowledge compiler bounds cloud rules and prompt sections before catalog growth", async () => {
  const engine = await readPwa("lib/knowledge-engine.ts");

  assert.match(engine, /MAX_CLOUD_RULES_PER_COMPILE = 5/);
  assert.match(engine, /MAX_GUIDANCE_LINES = 18/);
  assert.match(engine, /MAX_DELIVERABLE_LINES = 12/);
  assert.match(engine, /MAX_CAUTION_LINES = 18/);
  assert.match(engine, /cloudRuleSpecificity/);
  assert.match(engine, /matchesCloudRule/);
  assert.match(engine, /Math\.min\(MAX_CLOUD_RULES_PER_COMPILE/);
  assert.match(engine, /selected: index < safeLimit/);
  assert.match(engine, /\.slice\(0, MAX_GUIDANCE_LINES\)/);
  assert.match(engine, /\.slice\(0, MAX_DELIVERABLE_LINES\)/);
  assert.match(engine, /\.slice\(0, MAX_CAUTION_LINES\)/);
});

test("Phase 57 depth pack adds ten official-source rules without secrets", async () => {
  const migration = await readRepo("supabase/migrations/20260924184500_side_hustle_knowledge_depth_v2.sql");

  assert.match(migration, /published_knowledge_count/);
  assert.match(migration, /10, 0, next_version/);
  assert.match(migration, /fresh_first/);
  assert.match(migration, /support\.google\.com\/youtube/);
  assert.match(migration, /help\.x\.com/);
  assert.match(migration, /help\.jp\.mercari\.com/);
  assert.match(migration, /crowdworks\.jp/);
  assert.match(migration, /mhlw\.go\.jp/);
  assert.match(migration, /developers\.openai\.com/);
  assert.match(migration, /caa\.go\.jp/);
  assert.match(migration, /note\.com/);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|api[_-]?key/i);
});

test("combined Phase 55-57 migrations contain source-backed rules for all side-hustle tasks", async () => {
  const files = await Promise.all([
    readRepo("supabase/migrations/20260924164500_cloud_knowledge_bootstrap_v1.sql"),
    readRepo("supabase/migrations/20260924181500_side_hustle_knowledge_pack_v1.sql"),
    readRepo("supabase/migrations/20260924184500_side_hustle_knowledge_depth_v2.sql"),
  ]);
  const combined = files.join("\n");

  for (const task of sidejobTasks) {
    assert.match(combined, new RegExp(task), `missing task: ${task}`);
  }
  assert.match(combined, /Phase 57 Knowledge Depth/);
});

test("Knowledge admin shows depth tiers and 90-day source freshness state", async () => {
  const [admin, css] = await Promise.all([
    readPwa("components/admin-knowledge-page.tsx"),
    readPwa("app/phase26-knowledge.css"),
  ]);

  assert.match(admin, /KNOWLEDGE_STANDARD_DEPTH = 3/);
  assert.match(admin, /KNOWLEDGE_DEEP_DEPTH = 5/);
  assert.match(admin, /KNOWLEDGE_SOURCE_STALE_DAYS = 90/);
  assert.match(admin, /isSourceStale/);
  assert.match(admin, /副業Knowledge深度/);
  assert.match(admin, /標準達成/);
  assert.match(admin, /基礎のみ/);
  assert.match(admin, /深掘り/);
  assert.match(admin, /根拠の再確認が必要です/);
  assert.match(css, /\.knowledge-coverage-grid article\.deep/);
  assert.match(css, /\.knowledge-coverage-grid article\.basic/);
  assert.match(css, /\.knowledge-coverage-grid article\.stale/);
  assert.match(css, /\.knowledge-coverage-summary/);
});
