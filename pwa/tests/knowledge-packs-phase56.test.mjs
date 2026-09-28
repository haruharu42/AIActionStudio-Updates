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

test("Phase 56 source-backed Knowledge Pack covers every side-hustle task", async () => {
  const [phase55, phase56] = await Promise.all([
    readRepo("supabase/migrations/20260924164500_cloud_knowledge_bootstrap_v1.sql"),
    readRepo("supabase/migrations/20260924181500_side_hustle_knowledge_pack_v1.sql"),
  ]);
  const combined = phase55 + "\n" + phase56;

  for (const task of sidejobTasks) {
    assert.match(combined, new RegExp(task), `missing task coverage: ${task}`);
  }

  for (const sourceHost of [
    "note.com",
    "help.x.com",
    "support.google.com",
    "caa.go.jp",
    "help.jp.mercari.com",
    "crowdworks.jp",
    "coconala.com",
    "mhlw.go.jp",
    "openai.com",
  ]) {
    assert.ok(phase56.includes(sourceHost), `missing official source host: ${sourceHost}`);
  }

  assert.match(phase56, /Fresh.*Stable|fresh_first/i);
  assert.match(phase56, /published_knowledge_count/);
  assert.match(phase56, /13, 0, next_version/);
  assert.doesNotMatch(phase56, /service[_-]?role|sb_secret_|api[_-]?key/i);
});

test("Phase 56 Knowledge Pack keeps fact claims conservative and source checked", async () => {
  const migration = await readRepo("supabase/migrations/20260924181500_side_hustle_knowledge_pack_v1.sql");

  assert.match(migration, /source_checked_at/);
  assert.match(migration, /source_urls/);
  assert.match(migration, /source_summary/);
  assert.match(migration, /未確認/);
  assert.match(migration, /保証しない/);
  assert.match(migration, /実績.*創作|実績・資格・経験を創作/);
  assert.match(migration, /広告であること/);
  assert.match(migration, /勤務先のルール/);
});

test("Knowledge admin loads task assignments and shows 12-task coverage", async () => {
  const [admin, css] = await Promise.all([
    readPwa("components/admin-knowledge-page.tsx"),
    readPwa("app/phase26-knowledge.css"),
  ]);

  assert.match(admin, /stable_available_at,tasks,updated_at/);
  assert.match(admin, /task\.startsWith\("sidejob_"\)/);
  assert.match(admin, /item\.tasks\.includes\(task\)/);
  assert.match(admin, /副業Knowledge(カバレッジ|深度)/);
  assert.match(admin, /(12副業タスク|sidejobTasks)/);
  assert.match(admin, /Knowledge不足/);
  assert.match(admin, /(基準達成|標準達成)/);
  assert.match(css, /\.knowledge-coverage-grid/);
  assert.match(css, /article\.(standard|covered)/);
  assert.match(css, /article\.missing/);
});
