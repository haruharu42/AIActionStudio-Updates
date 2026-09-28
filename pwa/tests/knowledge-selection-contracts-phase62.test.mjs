import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");

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

test("Phase 62 defines explicit selection contracts for all side-hustle tasks", async () => {
  const source = await readPwa("lib/knowledge-selection-contracts.ts");

  assert.match(source, /SIDEJOB_SELECTION_CONTRACTS/);
  assert.match(source, /evaluateKnowledgeSelectionContract/);
  assert.match(source, /taskCore/);
  assert.match(source, /missingGroups/);
  assert.match(source, /matchedKeys/);

  for (const task of sidejobTasks) {
    assert.match(source, new RegExp(`${task}: \\\{`), `missing contract: ${task}`);
    assert.ok(source.includes(`taskCore("${task}"`), `missing core contract: ${task}`);
  }
});

test("selection contracts require task-specific core plus supporting operational knowledge", async () => {
  const source = await readPwa("lib/knowledge-selection-contracts.ts");

  for (const prefix of [
    "auto:cross:commercial:",
    "auto:cross:analytics:",
    "auto:cross:copyright:",
    "auto:cross:marketplace:",
    "auto:cross:privacy:",
    "auto:cross:research:",
    "auto:cross:ai-workflow:",
    "auto:cross:tax:",
  ]) {
    assert.ok(source.includes(prefix), `missing support contract prefix: ${prefix}`);
  }

  assert.match(source, /groups\.every\(\(group\) => group\.passed\)/);
  assert.doesNotMatch(source, /fetch\(|supabase|service[_-]?role|sb_secret_|api[_-]?key/i);
});

test("Phase 62 makes selection contract failures blocking regressions", async () => {
  const source = await readPwa("lib/knowledge-regression.ts");

  assert.match(source, /evaluateKnowledgeSelectionContract/);
  assert.match(source, /contractPassed/);
  assert.match(source, /missingContractGroups/);
  assert.match(source, /選択契約不足/);
  assert.match(source, /\|\| !contractPassed/);
});

test("Regression Lab shows selection contract coverage per side-hustle task", async () => {
  const [admin, css] = await Promise.all([
    readPwa("components/admin-knowledge-page.tsx"),
    readPwa("app/phase26-knowledge.css"),
  ]);

  assert.match(admin, /選択契約/);
  assert.match(admin, /result\.contractGroups/);
  assert.match(admin, /group\.passed/);
  assert.match(admin, /group\.description/);
  assert.match(css, /\.knowledge-contract-groups/);
  assert.match(css, /knowledge-contract-groups > span\.pass/);
  assert.match(css, /knowledge-contract-groups > span\.fail/);
});
