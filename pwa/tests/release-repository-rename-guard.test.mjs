import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("release Worker targets the renamed GitHub repository and retains existing public URL", async () => {
  const worker = await readRepo("supabase/functions/pwa-release-deploy/index.ts");
  assert.ok(worker.includes('const REPO = "haruharu42/AIActionStudio-Updates";'));
  assert.ok(!worker.includes('const REPO = "haruharu42/AIArticleStudio-Updates";'));
  assert.ok(worker.includes('const WORKFLOW = "pwa-admin-public-release.yml";'));
  assert.ok(worker.includes("AAS_GITHUB_RELEASE_TOKEN"));
  assert.ok(worker.includes('const PUBLIC_URL = "https://ai-article-studio-pwa.ai-article-studio.workers.dev/";'));
  assert.ok(worker.includes('const DEFAULT_PREVIEW_BRANCH = "main";'));
  assert.ok(worker.includes('"preview/current"'));
});

test("renamed release target retains approved workflow-dispatch safety checks", async () => {
  const [worker, workflow] = await Promise.all([
    readRepo("supabase/functions/pwa-release-deploy/index.ts"),
    readRepo(".github/workflows/pwa-admin-public-release.yml"),
  ]);
  assert.ok(worker.includes('github(`/actions/workflows/${WORKFLOW}/dispatches`'));
  assert.ok(worker.includes("if (dispatch.status !== 204)"));
  assert.ok(workflow.includes("workflow_dispatch:"));
  for (const input of ["request_id", "release_id", "source_branch", "source_sha"]) {
    assert.ok(workflow.includes("      " + input + ":"), "missing dispatch input: " + input);
  }
  assert.ok(workflow.includes("Only main or preview/current may be promoted"));
  assert.ok(workflow.includes("git merge-base --is-ancestor"));
  assert.ok(workflow.includes("Admin public release Cloudflare contract: PASS"));
});

test("README links to the renamed repository's existing Preview workflow", async () => {
  const readme = await readRepo("README.md");
  assert.ok(readme.includes("https://github.com/haruharu42/AIActionStudio-Updates/actions/workflows/pwa-preview-deploy.yml"));
  assert.ok(!readme.includes("haruharu42/AIArticleStudio-Updates"));
});
