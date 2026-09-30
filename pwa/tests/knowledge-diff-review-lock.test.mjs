import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
test("busy Knowledge diff review locks the selected request and pasted JSON", async () => {
  const panel = await readFile(path.join(root, "components/knowledge-refresh-panel.tsx"), "utf8");
  const selectStart = panel.indexOf('className="knowledge-refresh-select"');
  const selectEnd = panel.indexOf("<span", selectStart);
  assert.ok(selectStart > 0 && selectEnd > selectStart);
  assert.match(panel.slice(selectStart, selectEnd), /disabled=\{busy\}/);
  const importStart = panel.indexOf('className="knowledge-refresh-import"');
  const controlsStart = panel.indexOf('className="knowledge-refresh-publish-actions"', importStart);
  assert.ok(importStart > 0 && controlsStart > importStart);
  const editor = panel.slice(importStart, controlsStart);
  assert.match(editor, /<textarea[\s\S]*?rows=\{14\}[\s\S]*?disabled=\{busy\}/);
  assert.match(editor, /setDiffPreview\(null\)/);
  const previewStart = panel.indexOf("const previewDiff = async () => {");
  const publishStart = panel.indexOf("const publish = async () => {", previewStart);
  assert.ok(previewStart > 0 && publishStart > previewStart);
  const preview = panel.slice(previewStart, publishStart);
  assert.match(preview, /if \(busy \|\| !selected \|\| !bundleText\.trim\(\)\) return;/);
  assert.equal((preview.match(/adminPreviewKnowledgeRefreshBundleDiff\(/g) ?? []).length, 1);
  const publish = panel.slice(publishStart, panel.indexOf("const activeRequests =", publishStart));
  assert.match(publish, /if \(busy \|\| !selected \|\| !diffPreview/);
  assert.match(panel, /disabled=\{busy \|\| !diffPreview\}/);
});
