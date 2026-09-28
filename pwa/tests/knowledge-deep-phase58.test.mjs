import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("Phase 58 balances cloud rule priority with specificity before the five-rule cap", async () => {
  const engine = await readPwa("lib/knowledge-engine.ts");

  assert.match(engine, /function cloudRuleRank/);
  assert.match(engine, /rule\.priority \+ cloudRuleSpecificity\(rule\)/);
  assert.match(engine, /cloudRuleRank\(b, input\) - cloudRuleRank\(a, input\)/);
  assert.match(engine, /MAX_CLOUD_RULES_PER_COMPILE = 5/);
  assert.match(engine, /if \(rule\.kind === "task"\) return 30/);
  assert.match(engine, /return 5;/);
});

test("Phase 58 deep pack adds nine source-backed practical rules without secrets", async () => {
  const migration = await readRepo("supabase/migrations/20260924191500_side_hustle_knowledge_deep_v3.sql");

  assert.match(migration, /published_knowledge_count/);
  assert.match(migration, /9, 0, next_version/);
  assert.match(migration, /fresh_first/);

  for (const host of [
    "bunka.go.jp",
    "nta.go.jp",
    "ppc.go.jp",
    "no-trouble.caa.go.jp",
    "crowdworks.jp",
    "coconala.com",
    "help.x.com",
    "support.google.com",
    "developers.openai.com",
    "docs.anthropic.com",
    "ai.google.dev",
    "help.jp.mercari.com",
  ]) {
    assert.ok(migration.includes(host), `missing source host: ${host}`);
  }

  for (const task of [
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
  ]) {
    assert.match(migration, new RegExp(task), `missing Phase 58 coverage: ${task}`);
  }

  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|api[_-]?key/i);
});

test("Phase 58 covers rights tax privacy commerce marketplace analytics research AI QA and resale margin", async () => {
  const migration = await readRepo("supabase/migrations/20260924191500_side_hustle_knowledge_deep_v3.sql");

  assert.match(migration, /画像・文章・素材の権利と出典/);
  assert.match(migration, /収入・経費・証憑/);
  assert.match(migration, /顧客・案件情報は必要最小限/);
  assert.match(migration, /オンライン販売は申込み前に条件/);
  assert.match(migration, /連絡と決済のプラットフォーム規約/);
  assert.match(migration, /SNS・動画は指標を分けて改善仮説/);
  assert.match(migration, /一次情報を複数確認/);
  assert.match(migration, /代表例評価と人の確認/);
  assert.match(migration, /販売価格・手数料・送料/);

  assert.match(migration, /未確認/);
  assert.match(migration, /保証しない|保証/);
  assert.match(migration, /個人情報/);
  assert.match(migration, /著作権/);
});
