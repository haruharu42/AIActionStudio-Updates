import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("release Worker targets the renamed GitHub repository and retains Canary/public URLs", async () => {
  const worker = await readRepo("supabase/functions/pwa-release-deploy/index.ts");
  assert.ok(worker.includes('const REPO = "haruharu42/AIActionStudio-Updates";'));
  assert.ok(!worker.includes('const REPO = "haruharu42/AIArticleStudio-Updates";'));
  assert.ok(worker.includes('const CANARY_WORKFLOW = "pwa-admin-canary-release.yml";'));
  assert.ok(worker.includes('const PUBLIC_WORKFLOW = "pwa-admin-public-release.yml";'));
  assert.ok(worker.includes("AAS_GITHUB_RELEASE_TOKEN"));
  assert.ok(worker.includes('const CANARY_URL = "https://ai-article-studio-pwa-canary.ai-article-studio.workers.dev/";'));
  assert.ok(worker.includes('const PUBLIC_URL = "https://ai-article-studio-pwa.ai-article-studio.workers.dev/";'));
  assert.ok(worker.includes('const DEFAULT_PREVIEW_BRANCH = "main";'));
  assert.ok(worker.includes('"preview/current"'));
});

test("renamed release target retains guarded Canary/public workflow dispatch safety checks", async () => {
  const [worker, canaryWorkflow, publicWorkflow] = await Promise.all([
    readRepo("supabase/functions/pwa-release-deploy/index.ts"),
    readRepo(".github/workflows/pwa-admin-canary-release.yml"),
    readRepo(".github/workflows/pwa-admin-public-release.yml"),
  ]);
  assert.ok(worker.includes('github(`/actions/workflows/${workflow}/dispatches`'));
  assert.ok(worker.includes("if (dispatch.status !== 204)"));
  for (const workflow of [canaryWorkflow, publicWorkflow]) {
    assert.ok(workflow.includes("workflow_dispatch:"));
    for (const input of ["request_id", "release_id", "source_branch", "source_sha"]) {
      assert.ok(workflow.includes("      " + input + ":"), "missing dispatch input: " + input);
    }
  }
  assert.ok(canaryWorkflow.includes("Only main or preview/current may be used for Production Canary"));
  assert.ok(canaryWorkflow.includes("branch_head"));
  assert.ok(canaryWorkflow.includes("Public-build and Canary config contract: PASS"));
  assert.ok(publicWorkflow.includes("canary_run_id:"));
  assert.ok(publicWorkflow.includes("Download exact Canary-tested release bundle"));
  assert.ok(publicWorkflow.includes("No rebuild was performed during public promotion"));
  assert.ok(!publicWorkflow.includes("git push origin"));
});

test("README links to the renamed repository's existing Preview workflow", async () => {
  const readme = await readRepo("README.md");
  assert.ok(readme.includes("https://github.com/haruharu42/AIActionStudio-Updates/actions/workflows/pwa-preview-deploy.yml"));
  assert.ok(!readme.includes("haruharu42/AIArticleStudio-Updates"));
});
