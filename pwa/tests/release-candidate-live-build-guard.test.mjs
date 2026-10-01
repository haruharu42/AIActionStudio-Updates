import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("candidate creation verifies the currently served Preview build before writing a release", async () => {
  const page = await readRepo("pwa/components/admin-release-page.tsx");

  assert.match(page, /async function loadLivePreviewBuildSha/);
  assert.match(page, /fetch\("\/\?aas-build-check=" \+ Date\.now\(\)/);
  assert.match(page, /cache: "no-store"/);
  assert.match(page, /meta\[name="aas-build-sha"\]/);
  assert.match(page, /const liveBuildSha = await loadLivePreviewBuildSha\(\)/);
  assert.match(page, /if \(liveBuildSha !== PREVIEW_BUILD_SHA\)/);
  assert.match(page, /この画面は古いPreview Buildです/);

  const guardIndex = page.indexOf("const liveBuildSha = await loadLivePreviewBuildSha()");
  const createIndex = page.indexOf("adminCreateAppRelease(getSupabaseClient()");
  assert.ok(guardIndex > 0);
  assert.ok(createIndex > guardIndex);
});
