import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("release readiness checks are admin gated, read-only and never dispatch", async () => {
  const worker = await readRepo("supabase/functions/pwa-release-deploy/index.ts");
  const start = worker.indexOf('if (action === "github_readiness")');
  const end = worker.indexOf('if (action === "status")', start);
  assert.ok(start > 0 && end > start);
  const diagnostic = worker.slice(start, end);
  assert.ok(diagnostic.indexOf("await listDeployments(request)") < diagnostic.indexOf('github("")'));
  assert.match(diagnostic, /github\(""\)/);
  assert.match(diagnostic, /github\(`\/actions\/workflows\/\$\{WORKFLOW\}`\)/);
  assert.match(diagnostic, /repositoryReadable: repositoryResponse\.ok/);
  assert.match(diagnostic, /workflowReadable: workflowResponse\.ok/);
  assert.match(diagnostic, /dispatchPermissionTested: false/);
  assert.doesNotMatch(diagnostic, /dispatches|serviceRpc|admin_request_app_release_deploy|method:\s*["']POST/);
  assert.equal((worker.match(/supportsGithubReadiness: true/g) ?? []).length, 2);
});

test("admin UI never renders diagnostics against unsupported deployed workers", async () => {
  const [client, page] = await Promise.all([
    readRepo("pwa/lib/release-deployment.ts"),
    readRepo("pwa/components/admin-release-page.tsx"),
  ]);
  assert.match(client, /supportsGithubReadiness: row\.supportsGithubReadiness === true/);
  assert.match(client, /export async function checkGithubReleaseReadiness/);
  assert.match(client, /action: "github_readiness"/);
  assert.match(client, /dispatchPermissionTested: false/);
  assert.match(page, /IS_PREVIEW_DEPLOYMENT && deploymentSnapshot\?\.supportsGithubReadiness/);
  assert.match(page, /GitHub公開連携を安全に確認/);
  assert.match(page, /公開実行権限: 未検証/);
  assert.match(page, /if \(busy \|\| !deploymentSnapshot\?\.supportsGithubReadiness\) return;/);
  assert.match(page, /if \(!publishVerificationReady\)/);
  assert.match(page, /currentSessionAal !== "aal2"/);
});
