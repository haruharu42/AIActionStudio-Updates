import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");

test("Phase 61 regression evaluator uses the production compiler selector", async () => {
  const source = await readPwa("lib/knowledge-regression.ts");

  assert.match(source, /previewCloudKnowledgeSelection/);
  assert.match(source, /SIDEJOB_REGRESSION_TASKS/);
  assert.match(source, /task\.startsWith\("sidejob_"\)/);
  assert.match(source, /selectedRules\.length < minSelected/);
  assert.match(source, /taskSpecificSelected < 1/);
  assert.match(source, /!topRuleIsTaskSpecific/);
  assert.match(source, /missingSourceCount > 0/);
  assert.match(source, /emptyContentCount > 0/);
  assert.match(source, /staleSourceCount > 0/);
});

test("Phase 61 checks source metadata, staleness, and task-specific rules", async () => {
  const source = await readPwa("lib/knowledge-regression.ts");

  assert.match(source, /rule\.kind === "task"/);
  assert.match(source, /rule\.tasks\.length === 1/);
  assert.match(source, /sourceCheckedAt/);
  assert.match(source, /sourceUrls/);
  assert.ok(source.includes("https:"));
  assert.match(source, /90/);
  assert.match(source, /guidance\.length \+ rule\.deliverables\.length \+ rule\.cautions\.length/);
});

test("admin Knowledge page surfaces regression status for all side-hustle tasks", async () => {
  const [admin, css] = await Promise.all([
    readPwa("components/admin-knowledge-page.tsx"),
    readPwa("app/phase26-knowledge.css"),
  ]);

  assert.match(admin, /evaluateSidejobKnowledgeRegression/);
  assert.match(admin, /Knowledge選択 回帰テスト/);
  assert.match(admin, /REGRESSION LAB/);
  assert.match(admin, /PASS \{regressionSummary\.pass\}/);
  assert.match(admin, /WARN \{regressionSummary\.warn\}/);
  assert.match(admin, /FAIL \{regressionSummary\.fail\}/);
  assert.match(admin, /副業固有/);
  assert.match(admin, /最上位/);
  assert.match(admin, /compilerRules/);
  assert.match(css, /\.knowledge-regression-lab/);
  assert.match(css, /\.knowledge-regression-grid/);
  assert.match(css, /> article\.fail/);
});

test("regression evaluator is read-only and does not add network or secret access", async () => {
  const source = await readPwa("lib/knowledge-regression.ts");

  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /supabase|service[_-]?role|sb_secret_|api[_-]?key/i);
  assert.doesNotMatch(source, /insert|update|delete/i);
});
