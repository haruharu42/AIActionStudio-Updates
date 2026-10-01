import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("tester update notifications open Production Canary instead of the public root", async () => {
  const page = await readRepo("pwa/components/notifications-page.tsx");

  assert.match(page, /AAS_CANARY_PWA_URL/);
  assert.match(page, /notification\.audience === "tester"/);
  assert.match(page, /notification\.category === "update"/);
  assert.match(page, /window\.location\.href = isTesterReleaseNotification/);
  assert.match(page, /\? AAS_CANARY_PWA_URL/);
  assert.doesNotMatch(page, /NEXT_PUBLIC_AAS_PREVIEW_URL|PREVIEW_PWA_URL/);
});

test("non-tester notifications keep their configured relative href", async () => {
  const page = await readRepo("pwa/components/notifications-page.tsx");
  assert.match(page, /: notification\.href/);
});
