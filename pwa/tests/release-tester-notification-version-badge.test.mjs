import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("header shows effective release version instead of only a build hash", async () => {
  const shell = await readRepo("pwa/components/aas-reference-shell.tsx");
  assert.match(shell, /function HeaderReleaseVersion/);
  assert.match(shell, /readEffectiveRelease\(\)\?\.version/);
  assert.match(shell, /APP_RELEASE_STATE_EVENT/);
  assert.match(shell, /\{version \? `v\$\{version\}` : `build \$\{AAS_BUILD_SHA\}`\}/);
});

test("tester promotion emits one tester notification and backfills the active tester candidate", async () => {
  const migration = await readRepo("supabase/migrations/20261001053000_notify_release_testers_on_candidate_promotion.sql");
  assert.match(migration, /create or replace function public\.admin_promote_app_release_to_testers/);
  assert.match(migration, /'tester'/);
  assert.match(migration, /'release-tester:' \|\| v_release\.id::text/);
  assert.match(migration, /on conflict\(source_key\) do nothing/);
  assert.match(migration, /c\.candidate_stage = 'tester'/);
  assert.match(migration, /r\.status = 'candidate'/);
  assert.doesNotMatch(migration, /app_release_deployments/);
});
