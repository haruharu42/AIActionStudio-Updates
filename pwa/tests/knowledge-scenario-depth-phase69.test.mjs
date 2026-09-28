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

function scenarioRows(sql) {
  const match = sql.match(/\$rows\$([\s\S]*?)\$rows\$::jsonb/);
  assert.ok(match, "scenario row JSON block is missing");
  return JSON.parse(match[1]);
}

test("Phase 69 derives scenario tags from existing side-hustle inputs", async () => {
  const [engine, builder, catalog] = await Promise.all([
    readPwa("lib/knowledge-engine.ts"),
    readPwa("features/side-hustles/prompt-builder.ts"),
    readPwa("features/side-hustles/catalog.ts"),
  ]);

  assert.match(engine, /buildKnowledgeScenarioTags/);
  assert.match(engine, /scenarioTagFromRuleKey/);
  assert.match(engine, /scenarioRuleMatches/);
  assert.match(builder, /experienceScenarioTags/);
  assert.match(builder, /"experience:beginner"/);
  assert.match(builder, /"experience:experienced"/);
  assert.match(builder, /scenarioTags: experienceScenarioTags\(resolved\.experience_level \?\? resolved\.experience\)/);
  assert.match(catalog, /"experience_level"/);
  assert.match(catalog, /"指定しない"/);
  assert.match(catalog, /"未経験・これから始める"/);
  assert.match(catalog, /"経験者・継続中"/);
  assert.match(catalog, /field\.key === "experience"/);
  assert.match(engine, /\["sales", \[/);
  assert.match(engine, /\["acquisition", \[/);
  assert.match(engine, /\["production", \[/);
  assert.match(engine, /\["note", \[/);
  assert.match(engine, /\["youtube", \[/);
  assert.match(engine, /addScenarioTag\(tags, "risk", "high"\)/);
  assert.match(engine, /addScenarioTag\(tags, "strategy", "test"\)/);
  assert.match(engine, /addScenarioTag\(tags, "strategy", "repeat"\)/);
  assert.match(builder, /scenarioText: Object\.values\(resolved\)\.join\(" "\)/);
  assert.match(builder, /【今回の取り組み経験】/);
});

test("scenario rules remain inactive when the current selections do not match", async () => {
  const engine = await readPwa("lib/knowledge-engine.ts");

  assert.match(engine, /if \(required\.length === 0\) return true/);
  assert.match(engine, /if \(available\.size === 0\) return false/);
  assert.match(engine, /every\(\(options\) => options\.some\(\(tag\) => available\.has\(tag\)\)\)/);
  assert.match(engine, /if \(!scenarioRuleMatches\(rule, input\)\) return false/);
  assert.match(engine, /cloudRuleRank\(rule, input\)/);
  assert.match(engine, /MAX_CLOUD_RULES_PER_COMPILE = 5/);
});

test("Phase 69 adds five scenario Knowledge rules to every side-hustle task", async () => {
  const sql = await readRepo("supabase/migrations/20260925030000_side_hustle_scenario_knowledge_v1.sql");
  const rows = scenarioRows(sql);

  assert.equal(rows.length, 60);
  const counts = new Map(sidejobTasks.map((task) => [task, 0]));

  for (const row of rows) {
    assert.match(row.key, /^auto:scenario:sidejob_[a-z_]+:[a-z0-9_-]+:[a-z0-9._-]+:/);
    assert.equal(row.tasks.length, 1);
    assert.ok(counts.has(row.tasks[0]), `unknown task: ${row.tasks[0]}`);
    counts.set(row.tasks[0], counts.get(row.tasks[0]) + 1);

    assert.ok(row.priority >= 40 && row.priority <= 48, `unexpected scenario priority: ${row.key}`);
    assert.ok(row.guidance.length >= 2, `guidance too shallow: ${row.key}`);
    assert.ok(row.deliverables.length >= 3, `deliverables too shallow: ${row.key}`);
    assert.ok(row.cautions.length >= 2, `cautions too shallow: ${row.key}`);
    assert.ok(row.source_urls.length >= 1, `missing source: ${row.key}`);
    assert.ok(row.source_urls.every((url) => url.startsWith("https://")), `non-https source: ${row.key}`);
    assert.match(row.source_summary, /^2026-09-25確認。/);
  }

  for (const task of sidejobTasks) {
    assert.equal(counts.get(task), 5, `scenario depth must be 5: ${task}`);
  }
});

test("Phase 69 covers experience, use mode, media, risk, and strategy contexts", async () => {
  const sql = await readRepo("supabase/migrations/20260925030000_side_hustle_scenario_knowledge_v1.sql");
  const rows = scenarioRows(sql);
  const keys = rows.map((row) => row.key);

  for (const marker of [
    ":experience:beginner:",
    ":experience:experienced:",
    ":mode:sales:",
    ":mode:acquisition:",
    ":mode:production:",
    ":mode:outreach:",
    ":mode:research:",
    ":medium:note:",
    ":medium:x:",
    ":medium:youtube:",
    ":medium:mercari:",
    ":medium:crowdworks:",
    ":medium:coconala:",
    ":medium:email:",
    ":risk:high:",
    ":strategy:test:",
    ":strategy:repeat:",
  ]) {
    assert.ok(keys.some((key) => key.includes(marker)), `missing scenario dimension: ${marker}`);
  }
});

test("Phase 69 extends the Phase 58 five-plus baseline without mutating Stable directly", async () => {
  const [baseline, scenario] = await Promise.all([
    readRepo("supabase/migrations/20260924191500_side_hustle_knowledge_deep_v3.sql"),
    readRepo("supabase/migrations/20260925030000_side_hustle_scenario_knowledge_v1.sql"),
  ]);

  assert.match(baseline, /12副業タスクすべてを出典付きCloud Knowledge 5件以上へ拡張/);
  assert.match(scenario, /計60件の状況別Knowledge/);
  assert.match(scenario, /'fresh_first'/);
  assert.match(scenario, /published_knowledge_count/);
  assert.match(scenario, /60, 0, next_version/);
  assert.doesNotMatch(scenario, /insert into public\.knowledge_stable_catalog/i);
  assert.doesNotMatch(scenario, /delete from|truncate/i);
  assert.doesNotMatch(scenario, /service[_-]?role|sb_secret_|api[_-]?key/i);
});
