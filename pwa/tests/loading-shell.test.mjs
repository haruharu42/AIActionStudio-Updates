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
