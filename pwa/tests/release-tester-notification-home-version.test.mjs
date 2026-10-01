import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("release promotion creates one tester notification after the admin-to-tester transition", async () => {
  const migration = await readRepo("supabase/migrations/20261001051000_notify_release_testers_on_promotion.sql");

  const alreadyTester = migration.indexOf("if v_channel.candidate_stage = 'tester' then");
  const notificationInsert = migration.indexOf("insert into public.app_notifications");

  assert.ok(alreadyTester > 0);
  assert.ok(notificationInsert > alreadyTester);
  assert.match(migration, /'tester',\s*\n\s*v_admin/);
  assert.match(migration, /テスター確認を開始しました/);
  assert.match(migration, /Preview PWAで主要導線と通知センターを確認してください/);
  assert.doesNotMatch(migration, /app_release_deployments/);
});

test("Home header shows the effective release version in the upper-right controls", async () => {
  const [shell, home, css] = await Promise.all([
    readRepo("pwa/components/aas-reference-shell.tsx"),
    readRepo("pwa/components/phase18-beginner-home.tsx"),
    readRepo("pwa/app/phase53-crystal-ui.css"),
  ]);

  assert.match(shell, /APP_RELEASE_STATE_EVENT/);
  assert.match(shell, /readEffectiveRelease/);
  assert.match(shell, /showVersion = false/);
  assert.match(shell, /className="aas-reference-version"/);
  assert.match(shell, /releaseVersion \? `v\$\{releaseVersion\}` : "v--"/);

  assert.ok((home.match(/<AasReferenceHeader showVersion/g) ?? []).length >= 4);
  assert.match(css, /\.aas-reference-version/);
});
