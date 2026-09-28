import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");

test("compiler runtime and admin preview share one explainable selection function", async () => {
  const engine = await readPwa("lib/knowledge-engine.ts");

  assert.match(engine, /export type CloudKnowledgeSelectionItem/);
  assert.match(engine, /export type CloudKnowledgeSelectionPreview/);
  assert.match(engine, /export function previewCloudKnowledgeSelection/);
  assert.match(engine, /eligibleCount: items\.length/);
  assert.match(engine, /selected: items\.filter\(\(item\) => item\.selected\)/);
  assert.match(engine, /skipped: items\.filter\(\(item\) => !item\.selected\)/);
  assert.match(engine, /score: cloudRuleRank\(rule, input\)/);
  assert.match(engine, /position: index < safeLimit \? index \+ 1 : null/);
  assert.match(engine, /const cloudRules = previewCloudKnowledgeSelection\(runtimeCloudRules, input\)/);
});

test("compiler preview explains task and combination rule selection", async () => {
  const engine = await readPwa("lib/knowledge-engine.ts");

  assert.match(engine, /タスク固有ルール/);
  assert.match(engine, /複数機能に共通する横断ルール/);
  assert.match(engine, /サブジャンル一致/);
  assert.match(engine, /ジャンル一致/);
  assert.match(engine, /掲載先一致/);
  assert.match(engine, /対象条件一致/);
  assert.match(engine, /MAX_CLOUD_RULES_PER_COMPILE/);
  assert.match(engine, /cloudRuleRank\(b, input\) - cloudRuleRank\(a, input\)/);
});

test("catalog parser is reused so admin preview sees runtime-shaped Knowledge rules", async () => {
  const catalog = await readPwa("lib/knowledge-catalog.ts");

  assert.match(catalog, /export function parseKnowledgeCatalogRow/);
  assert.match(catalog, /parseKnowledgeCatalogRow\(row\)/);
  assert.match(catalog, /source: "cloud"/);
  assert.match(catalog, /sourceUrls: asStringArray\(row\.source_urls\)/);
  assert.match(catalog, /sourceCheckedAt/);
});

test("admin Knowledge page previews Fresh and Stable compiler selections", async () => {
  const [admin, css] = await Promise.all([
    readPwa("components/admin-knowledge-page.tsx"),
    readPwa("app/phase26-knowledge.css"),
  ]);

  assert.match(admin, /COMPILER PREVIEW/);
  assert.match(admin, /実際に採用されるKnowledge/);
  assert.match(admin, /previewCloudKnowledgeSelection/);
  assert.match(admin, /parseKnowledgeCatalogRow/);
  assert.match(admin, /compilerChannel/);
  assert.match(admin, />Fresh</);
  assert.match(admin, />Stable</);
  assert.match(admin, /Stable待ち/);
  assert.match(admin, /採用枠から外れた候補/);
  assert.match(admin, /score \{item\.score\}/);
  assert.match(admin, /根拠を開く/);
  assert.match(admin, /aliases,guidance,deliverables,cautions/);

  assert.match(css, /\.knowledge-compiler-preview/);
  assert.match(css, /\.knowledge-compiler-selected/);
  assert.match(css, /\.knowledge-compiler-skipped/);
  assert.match(css, /\.knowledge-channel-switch/);
});
