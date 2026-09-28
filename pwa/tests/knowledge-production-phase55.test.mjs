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

test("knowledge admin exposes all core and side-hustle tasks from the shared task registry", async () => {
  const [engine, admin] = await Promise.all([
    readPwa("lib/knowledge-engine.ts"),
    readPwa("components/admin-knowledge-page.tsx"),
  ]);

  assert.match(engine, /KNOWLEDGE_TASK_LABELS/);
  for (const task of ["title", "article", "image", "social", "promotion", ...sidejobTasks]) {
    assert.match(engine, new RegExp(task));
  }
  assert.match(admin, /KNOWLEDGE_TASKS\.map/);
  assert.match(admin, /KNOWLEDGE_TASK_LABELS\[key\]/);
  assert.doesNotMatch(admin, /const TASKS = \[/);
});

test("production workflow adds admin-only cancel retry scheduler and health RPCs", async () => {
  const migration = await readRepo("supabase/migrations/20260924164000_knowledge_production_workflow_v1.sql");

  assert.match(migration, /admin_cancel_knowledge_refresh/);
  assert.match(migration, /admin_retry_knowledge_refresh/);
  assert.match(migration, /admin_run_knowledge_scheduler/);
  assert.match(migration, /admin_get_knowledge_production_health/);
  assert.match(migration, /private\.is_active_admin/);
  assert.match(migration, /status not in \('failed', 'cancelled'\)/);
  assert.match(migration, /perform private\.enqueue_due_knowledge_refreshes\(\)/);
  assert.match(migration, /grant execute .* to authenticated/i);
  assert.doesNotMatch(migration, /grant .* to anon/i);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|api[_-]?key/i);
});

test("knowledge refresh UI can recover stuck work and review source URLs", async () => {
  const [panel, client, css] = await Promise.all([
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("lib/knowledge-auto-update.ts"),
    readPwa("app/phase26-knowledge.css"),
  ]);

  assert.match(client, /adminCancelKnowledgeRefresh/);
  assert.match(client, /adminRetryKnowledgeRefresh/);
  assert.match(client, /adminRunKnowledgeScheduler/);
  assert.match(client, /adminGetKnowledgeProductionHealth/);
  assert.match(panel, /更新期限を同期/);
  assert.match(panel, /この更新を再試行/);
  assert.match(panel, />中止</);
  assert.match(panel, /launchAiApp\("chatgpt"\)/);
  assert.match(panel, /launchAiApp\("claude"\)/);
  assert.match(panel, /launchAiApp\("gemini"\)/);
  assert.match(panel, /今回の根拠URL/);
  assert.match(css, /\.knowledge-source-review/);
  assert.match(css, /\.knowledge-refresh-row-actions button\.danger/);
});

test("source-backed bootstrap ships official guidance to Fresh before Stable", async () => {
  const migration = await readRepo("supabase/migrations/20260924164500_cloud_knowledge_bootstrap_v1.sql");

  assert.match(migration, /fresh_first/);
  assert.match(migration, /stable_at := now\(\) \+ make_interval/);
  assert.match(migration, /auto:task:sidejob_research:grounded-current-info-20260924/);
  assert.match(migration, /auto:prompt:chatgpt:official-best-practices-20260924/);
  assert.match(migration, /auto:prompt:claude:official-best-practices-20260924/);
  assert.match(migration, /auto:prompt:gemini:official-best-practices-20260924/);
  assert.match(migration, /developers\.openai\.com/);
  assert.match(migration, /help\.openai\.com/);
  assert.match(migration, /docs\.anthropic\.com/);
  assert.match(migration, /ai\.google\.dev/);
  assert.match(migration, /source_checked_at/);
  assert.match(migration, /published_knowledge_count/);
  assert.match(migration, /published_prompt_count/);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|api[_-]?key/i);
});

test("knowledge admin surfaces cloud catalog provenance and production health", async () => {
  const admin = await readPwa("components/admin-knowledge-page.tsx");

  assert.match(admin, /adminGetKnowledgeProductionHealth/);
  assert.match(admin, /Prompt最適化/);
  assert.match(admin, /Fresh \/ Stable/);
  assert.match(admin, /source_urls/);
  assert.match(admin, /source_summary/);
  assert.match(admin, /source_checked_at/);
  assert.match(admin, /根拠を開く/);
});
