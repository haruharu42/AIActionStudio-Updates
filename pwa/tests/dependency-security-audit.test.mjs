import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));

test("Cloudflare tooling resolves undici to the patched 7.29.1 release", async () => {
  const [packageJson, packageLock] = await Promise.all([
    readFile(path.join(pwaRoot, "package.json"), "utf8").then(JSON.parse),
    readFile(path.join(pwaRoot, "package-lock.json"), "utf8").then(JSON.parse),
  ]);

  assert.equal(packageJson.overrides?.undici, "7.29.1");
  assert.equal(packageLock.packages?.["node_modules/undici"]?.version, "7.29.1");
  assert.equal(
    packageLock.packages?.["node_modules/undici"]?.integrity,
    "sha512-RYONW2MeafgYlkVOKYKkA/Ag7BmXqgIWCa8t1m0JcxrQg9pI9lEqRhAOruOBCbAohOa/gkCF+iPi9hrgvTzu6Q==",
  );
});


test("all PWA deployment paths block moderate dependency advisories", async () => {
  const repoRoot = path.resolve(pwaRoot, "..");
  for (const relative of [
    ".github/workflows/pwa-preview-deploy.yml",
    ".github/workflows/pwa-member-beta-deploy.yml",
    ".github/workflows/pwa-admin-canary-release.yml",
    ".github/workflows/pwa-admin-public-release.yml",
  ]) {
    const workflow = await readFile(path.join(repoRoot, relative), "utf8");
    assert.match(workflow, /npm audit --audit-level=moderate/);
    assert.doesNotMatch(workflow, /npm audit --audit-level=high/);
  }
});
