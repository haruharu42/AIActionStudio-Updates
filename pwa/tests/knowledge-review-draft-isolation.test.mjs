import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const panelSource = () => readFile(path.join(root, "components/knowledge-refresh-panel.tsx"), "utf8");
function actionSource(panel, name, nextName) {
  const start = panel.indexOf("const " + name + " = async");
  const end = panel.indexOf("const " + nextName + " = async", start);
  assert.ok(start >= 0 && end > start, name + " action exists");
  return panel.slice(start, end);
}

test("switching Knowledge review context cannot publish a previous candidate JSON by mistake", async () => {
  const panel = await panelSource();
  const enqueue = actionSource(panel, "enqueue", "start");
  const start = actionSource(panel, "start", "copyResearchPrompt");
  const diversity = actionSource(panel, "prepareSourceDiversity", "copyHeldResearchBatch");
  for (const action of [enqueue, diversity]) {
    assert.match(action, /setSelectedId\(/);
    assert.match(action, /setPreparedAutomationCandidateId\(null\)/);
    assert.match(action, /setBundleText\(""\)/);
    assert.match(action, /setDiffPreview\(null\)/);
  }
  assert.match(start, /if \(selectedId !== request\.id\) \{/);
  assert.match(start, /setPreparedAutomationCandidateId\(null\)/);
  assert.match(start, /setBundleText\(""\)/);
  assert.match(start, /status: "processing" as const/);
  assert.match(panel, /if \(selectedId === request\.id\) return;/);
  assert.doesNotMatch([...["enqueue", "start", "prepareSourceDiversity"].map((name) =>
    actionSource(panel, name, { enqueue: "start", start: "copyResearchPrompt", prepareSourceDiversity: "copyHeldResearchBatch" }[name])
  )].join("\n"), /adminPublishKnowledgeRefreshBundle/);
});

test("confirmed Knowledge state changes remain successful even if dashboard reload fails", async () => {
  const panel = await panelSource();
  const specs = [
    ["prepareAutomationCandidate", "runAutomation", "adminRequestKnowledgeRefresh"],
    ["prepareSourceDiversity", "copyHeldResearchBatch", "adminPrepareSourceDiversityResearch"],
    ["reviewAutomationCandidate", "enqueue", "adminReviewKnowledgeAutomationCandidate"],
    ["enqueue", "start", "adminRequestKnowledgeRefresh"],
    ["start", "copyResearchPrompt", "adminStartKnowledgeRefresh"],
  ];
  for (const [name, nextName, api] of specs) {
    const action = actionSource(panel, name, nextName);
    assert.equal((action.match(new RegExp(api + "\\(", "g")) ?? []).length, 1, name + " must invoke the write API once");
    assert.match(action, /try \{\s*await reload\(\);/);
    assert.match(action, /\} catch \{/);
    assert.match(action, /再読込/);
    assert.match(action, /結果を確認できませんでした/);
    assert.doesNotMatch(action, /adminPublishKnowledgeRefreshBundle/);
  }
  assert.match(actionSource(panel, "reviewAutomationCandidate", "enqueue"), /setAutomationCandidates\(\(current\) => current\.filter/);
});
