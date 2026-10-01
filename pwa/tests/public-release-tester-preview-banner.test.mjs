import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("public PWA shows a Production Canary handoff only to active release testers", async () => {
  const manager = await readRepo("pwa/components/release-update-manager.tsx");

  assert.match(manager, /appDeploymentAudience\(\) === "public"/);
  assert.match(manager, /state\.is_release_tester === true/);
  assert.match(manager, /state\.candidate_stage === "tester"/);
  assert.match(manager, /テスト版があります/);
  assert.match(manager, /Production Canaryで最新候補版を確認できます/);
  assert.match(manager, /Production Canaryを確認/);
  assert.match(manager, /AAS_CANARY_PWA_URL/);
  assert.match(manager, /window\.location\.href = AAS_CANARY_PWA_URL/);
  assert.doesNotMatch(manager, /NEXT_PUBLIC_AAS_PREVIEW_URL|PREVIEW_PWA_URL/);
});

test("published updates take priority over the tester Canary handoff", async () => {
  const manager = await readRepo("pwa/components/release-update-manager.tsx");

  const noAvailableIndex = manager.indexOf("if (!available || dismissedReleaseId === available.id)");
  const testerBannerIndex = manager.indexOf("testerPreviewAvailable && <TesterCanaryBanner />");
  const confirmationIndex = manager.indexOf("const confirmationOpen");

  assert.ok(noAvailableIndex >= 0);
  assert.ok(testerBannerIndex > noAvailableIndex);
  assert.ok(testerBannerIndex < confirmationIndex);
  assert.equal(manager.slice(confirmationIndex).includes("testerPreviewAvailable && <TesterCanaryBanner />"), false);
});
