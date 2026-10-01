import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("release manager refreshes update availability while the PWA stays open", async () => {
  const manager = await readRepo("pwa/components/release-update-manager.tsx");

  assert.match(manager, /let refreshing = false/);
  assert.match(manager, /lastRefreshAt/);
  assert.match(manager, /now - lastRefreshAt < 30_000/);
  assert.match(manager, /window\.setInterval\(refreshWhenVisible, 5 \* 60_000\)/);
  assert.match(manager, /window\.addEventListener\("focus", refreshWhenVisible\)/);
  assert.match(manager, /window\.addEventListener\("online", refreshWhenVisible\)/);
  assert.match(manager, /document\.addEventListener\("visibilitychange", refreshWhenVisible\)/);
  assert.match(manager, /document\.visibilityState === "hidden"/);
  assert.match(manager, /void refresh\(true\)/);
});

test("release manager cleans up background refresh listeners", async () => {
  const manager = await readRepo("pwa/components/release-update-manager.tsx");

  assert.match(manager, /window\.clearInterval\(interval\)/);
  assert.match(manager, /window\.removeEventListener\("focus", refreshWhenVisible\)/);
  assert.match(manager, /window\.removeEventListener\("online", refreshWhenVisible\)/);
  assert.match(manager, /document\.removeEventListener\("visibilitychange", refreshWhenVisible\)/);
});
