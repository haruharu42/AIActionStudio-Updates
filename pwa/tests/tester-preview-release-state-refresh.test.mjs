import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("tester Preview gate refreshes candidate state while the app stays open", async () => {
  const gate = await readRepo("pwa/components/release-audience-gate.tsx");

  assert.match(gate, /let refreshing = false/);
  assert.match(gate, /lastRefreshAt/);
  assert.match(gate, /now - lastRefreshAt < 30_000/);
  assert.match(gate, /window\.setInterval\(refreshWhenVisible, 5 \* 60_000\)/);
  assert.match(gate, /window\.addEventListener\("focus", refreshWhenVisible\)/);
  assert.match(gate, /window\.addEventListener\("online", refreshWhenVisible\)/);
  assert.match(gate, /document\.addEventListener\("visibilitychange", refreshWhenVisible\)/);
  assert.match(gate, /void refresh\(true\)/);
});

test("tester Preview gate cleans up release refresh listeners", async () => {
  const gate = await readRepo("pwa/components/release-audience-gate.tsx");

  assert.match(gate, /window\.clearInterval\(interval\)/);
  assert.match(gate, /window\.removeEventListener\("focus", refreshWhenVisible\)/);
  assert.match(gate, /window\.removeEventListener\("online", refreshWhenVisible\)/);
  assert.match(gate, /document\.removeEventListener\("visibilitychange", refreshWhenVisible\)/);
});
