import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("release Worker targets renamed GitHub repository without changing existing public URL", async () => {
  const worker = await readRepo("supabase/functions/pwa-release-deploy/index.ts");
  assert.match(worker, /const REPO = "haruharu42\\/AIActionStudio-Updates";/);
  assert.doesNotMatch(worker, /haruharu42\\/AIArticleStudio-Updates/);
  assert.match(worker, /const WORKFLOW = "pwa-admin-public-release\\.yml";/);
  assert.match(worker, /AAS_GITHUB_RELEASE_TOKEN/);
  assert.match(worker, /const PUBLIC_URL = "https:\\/\\/ai-article-studio-pwa\\.ai-article-studio\\.workers\\.dev\\/";/);
  assert.match(worker, /const DEFAULT_PREVIEW_BRANCH = "main";/);
  assert.match(worker, /"preview\\/current"/);
});

test("renamed release target retains approved workflow-dispatch safety checks", async () => {
  const [worker, workflow] = await Promise.all([
    readRepo("supabase/functions/pwa-release-deploy/index.ts"),
    readRepo(".github/workflows/pwa-admin-public-release.yml"),
  ]);
  assert.match(worker, /github\\(\`\\/actions\\/workflows\\/\\$\\{WORKFLOW\\}\\/dispatches\`/);
  assert.match(worker, /if \\(dispatch\\.status !== 204\\)/);
  assert.match(workflow, /workflow_dispatch:/);
  for (const input of ["request_id", "release_id", "source_branch", "source_sha"]) {
    assert.match(workflow, new RegExp("^      " + input + ":", "m"));
  }
  assert.match(workflow, /Only main or preview\\/current may be promoted/);
  assert.match(workflow, /git merge-base --is-ancestor/);
  assert.match(workflow, /Admin public release Cloudflare contract: PASS/);
});
