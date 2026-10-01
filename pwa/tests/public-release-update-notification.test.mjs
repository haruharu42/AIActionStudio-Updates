import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("publishing a PWA release creates one general-user update notification", async () => {
  const migration = await readRepo("supabase/migrations/20261001062000_notify_users_on_public_release.sql");

  assert.match(migration, /create or replace function private\.notify_published_app_release/);
  assert.match(migration, /after update of status on public\.app_releases/);
  assert.match(migration, /new\.status = 'published'/);
  assert.match(migration, /'all'/);
  assert.match(migration, /release-public:/);
  assert.match(migration, /on conflict \(source_key\) do nothing/);
  assert.match(migration, /'\/\?update=' \|\| new\.id::text/);
  assert.doesNotMatch(migration, /app_release_deployments/);
});

test("public update notification deep link matches the confirmation manager contract", async () => {
  const [migration, manager] = await Promise.all([
    readRepo("supabase/migrations/20261001062000_notify_users_on_public_release.sql"),
    readRepo("pwa/components/release-update-manager.tsx"),
  ]);

  assert.match(migration, /\?update=/);
  assert.match(manager, /params\.get\("update"\)/);
  assert.match(manager, /requestedReleaseId !== available\.id/);
});
