import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("public release notification upgrades the existing trigger contract without adding a second trigger", async () => {
  const migration = await readRepo("supabase/migrations/20261001062000_notify_users_on_public_release.sql");

  assert.match(migration, /create or replace function private\.notify_app_release_published/);
  assert.match(migration, /drop trigger if exists app_release_public_update_notification/);
  assert.match(migration, /drop function if exists private\.notify_published_app_release/);
  assert.match(migration, /new\.status = 'published'/);
  assert.match(migration, /'all'/);
  assert.match(migration, /'app-release-published:' \|\| new\.id::text/);
  assert.match(migration, /on conflict \(source_key\) do nothing/);
  assert.match(migration, /'\/\?update=' \|\| new\.id::text/);
  assert.doesNotMatch(migration, /create trigger app_release_public_update_notification/);
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
