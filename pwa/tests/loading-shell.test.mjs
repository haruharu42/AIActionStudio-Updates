import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("auth and personalization loading states never render a blank app shell", async () => {
  const [loading, releaseGate, accessProvider] = await Promise.all([
    read("components/app-loading-screen.tsx"),
    read("components/release-audience-gate.tsx"),
    read("components/access-state-provider.tsx"),
  ]);

  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /role="status"/);
  assert.match(loading, /aria-live="polite"/);
  assert.match(releaseGate, /AppLoadingScreen/);
  assert.doesNotMatch(releaseGate, /gate\.kind === "loading"\) return null/);
  assert.match(accessProvider, /runtimeProfilePending \? <AppLoadingScreen/);
  assert.doesNotMatch(accessProvider, /runtimeProfilePending \? null : children/);
});


test("article export and image planning never render a blank screen while access is loading", async () => {
  const [articleExport, imagePage] = await Promise.all([
    read("components/article-export-page.tsx"),
    read("components/phase13-image-page.tsx"),
  ]);

  assert.match(articleExport, /AppLoadingScreen/);
  assert.match(articleExport, /記事出力を準備しています/);
  assert.doesNotMatch(articleExport, /accessState\.kind === "loading"\) return null/);

  assert.match(imagePage, /AppLoadingScreen/);
  assert.match(imagePage, /画像生成計画を準備しています/);
  assert.doesNotMatch(imagePage, /accessState\.kind === "loading"\) return null/);
});
