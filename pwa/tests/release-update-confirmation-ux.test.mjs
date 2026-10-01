import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("public release update asks for confirmation before accepting", async () => {
  const manager = await readRepo("pwa/components/release-update-manager.tsx");

  assert.match(manager, /アップデートしますか？/);
  assert.match(manager, /setConfirmingReleaseId\(available\.id\)/);
  assert.match(manager, /const next = await acceptAppRelease\(client, release\.id\)/);

  const openIndex = manager.indexOf("setConfirmingReleaseId(available.id)");
  const acceptIndex = manager.indexOf("acceptAppRelease(client, release.id)");
  assert.ok(openIndex > 0);
  assert.ok(acceptIndex > 0);
});

test("update notification deep link can open the confirmation for the matching release", async () => {
  const manager = await readRepo("pwa/components/release-update-manager.tsx");

  assert.match(manager, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(manager, /params\.get\("update"\)/);
  assert.match(manager, /requestedReleaseId !== available\.id/);
  assert.match(manager, /window\.history\.replaceState/);
});

test("successful public update shows one-time completion feedback after reload", async () => {
  const manager = await readRepo("pwa/components/release-update-manager.tsx");

  assert.match(manager, /aas\.release\.update-success/);
  assert.match(manager, /sessionStorage\.setItem/);
  assert.match(manager, /sessionStorage\.removeItem/);
  assert.match(manager, /へアップデートしました/);
});

test("Preview and Production Canary require separate explicit tester consent for each candidate", async () => {
  const gate = await readRepo("pwa/components/release-audience-gate.tsx");

  assert.match(gate, /テスト版を適用しますか？/);
  assert.match(gate, /Production Canary版を適用しますか？/);
  assert.match(gate, /"aas\.tester-" \+ deploymentTier \+ "\.accepted\."/);
  assert.match(gate, /acceptedTesterReleaseId !== testerRelease\.id/);
  assert.match(gate, /Canary版を適用/);
  assert.match(gate, /あとで確認/);
});

test("release confirmation UX has mobile-friendly styles", async () => {
  const css = await readRepo("pwa/app/phase37-release-management.css");

  assert.match(css, /\.release-confirm-actions/);
  assert.match(css, /\.release-update-success/);
  assert.match(css, /\.release-tester-consent-card/);
  assert.match(css, /@media \(max-width: 680px\)/);
});
