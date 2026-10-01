import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("stage 2 explains why Production Canary cannot be started", async () => {
  const page = await readRepo("pwa/components/admin-release-page.tsx");

  assert.match(page, /const canaryStage2Blocker/);
  assert.match(page, /現在の管理者セッションはAAL2未認証です/);
  assert.match(page, /管理者セッションのMFA認証レベルを確認しています/);
  assert.match(page, /Production Canaryテスターが設定されていません/);
  assert.match(page, /候補版buildと現在のPreview Buildが一致していません/);
  assert.match(page, /管理者MFAで再認証 →/);
});

test("stage 2 button uses the blocker for disabled state and tooltip", async () => {
  const page = await readRepo("pwa/components/admin-release-page.tsx");

  assert.match(page, /disabled=\{Boolean\(canaryStage2Blocker\)\}/);
  assert.match(page, /title=\{canaryStage2Blocker \|\| "Production Canaryへ反映できます"\}/);
});
