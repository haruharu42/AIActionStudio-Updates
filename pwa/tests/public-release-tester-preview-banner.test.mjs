import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("public PWA shows a Preview handoff banner only to active release testers", async () => {
  const manager = await readRepo("pwa/components/release-update-manager.tsx");

  assert.match(manager, /appDeploymentAudience\(\) === "public"/);
  assert.match(manager, /state\.is_release_tester === true/);
  assert.match(manager, /state\.candidate_stage === "tester"/);
  assert.match(manager, /テスト版があります/);
  assert.match(manager, /テスト版を確認/);
  assert.match(manager, /NEXT_PUBLIC_AAS_PREVIEW_URL/);
  assert.match(manager, /window\.location\.href = PREVIEW_PWA_URL/);
});

test("published updates take priority over the tester Preview handoff", async () => {
  const manager = await readRepo("pwa/components/release-update-manager.tsx");

  const noAvailableIndex = manager.indexOf("if (!available || dismissedReleaseId === available.id)");
  const testerBannerIndex = manager.indexOf("testerPreviewAvailable && <TesterPreviewBanner />");
  const finalReturnIndex = manager.indexOf("const confirmationOpen");

  assert.ok(noAvailableIndex >= 0);
  assert.ok(testerBannerIndex > noAvailableIndex);
  assert.ok(testerBannerIndex < finalReturnIndex);
  assert.equal(manager.slice(finalReturnIndex).includes("testerPreviewAvailable && <TesterPreviewBanner />"), false);
});
