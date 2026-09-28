import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("Phase 64 exposes an admin-only Stable release queue", async () => {
  const migration = await readRepo("supabase/migrations/20260924221000_stable_release_queue_v1.sql");

  assert.match(migration, /admin_get_stable_release_queue/);
  assert.match(migration, /admin_prepare_stable_release/);
  assert.match(migration, /private\.is_active_admin/);
  assert.match(migration, /revoke all .* from public, anon/i);
  assert.match(migration, /grant execute .* to authenticated/i);
  assert.doesNotMatch(migration, /grant execute .* to anon/i);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|api[_-]?key/i);
});

test("Stable queue requires Fresh trial completion, source freshness, and a real Stable diff", async () => {
  const migration = await readRepo("supabase/migrations/20260924221000_stable_release_queue_v1.sql");

  assert.match(migration, /release_channel='fresh_first'/);
  assert.match(migration, /stable_available_at <= now\(\)/);
  assert.match(migration, /stable_available_at > now\(\)/);
  assert.match(migration, /source_checked_at >= now\(\) - interval '90 days'/);
  assert.match(migration, /source_checked_at < now\(\) - interval '90 days'/);
  assert.match(migration, /knowledge_stable_catalog/);
  assert.match(migration, /prompt_optimization_stable_catalog/);
  assert.match(migration, /is distinct from stable\.guidance/);
  assert.match(migration, /is distinct from stable\.rules/);
});

test("Stable preparation builds review JSON but does not publish it", async () => {
  const migration = await readRepo("supabase/migrations/20260924221000_stable_release_queue_v1.sql");

  assert.match(migration, /'knowledge_rules',knowledge_items/);
  assert.match(migration, /'prompt_optimizations',prompt_items/);
  assert.match(migration, /knowledge_refresh_requests/);
  assert.match(migration, /'stable'.*'processing'/s);
  assert.doesNotMatch(migration, /admin_publish_knowledge_refresh_bundle_v4\s*\(/);
  assert.doesNotMatch(migration, /insert into public\.knowledge_stable_catalog/);
  assert.doesNotMatch(migration, /insert into public\.prompt_optimization_stable_catalog/);
});

test("Phase 64 client and UI preserve manual review gates", async () => {
  const [client, panel, css] = await Promise.all([
    readPwa("lib/knowledge-auto-update.ts"),
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("app/phase26-knowledge.css"),
  ]);

  assert.match(client, /adminGetStableReleaseQueue/);
  assert.match(client, /adminPrepareStableRelease/);
  assert.match(client, /StableReleaseQueue/);
  assert.match(panel, /Fresh → Stable 昇格候補/);
  assert.match(panel, /Stableレビューを自動準備/);
  assert.match(panel, /adminPrepareStableRelease/);
  assert.match(panel, /変更点を確認/);
  assert.match(panel, /Stable昇格ゲート/);
  assert.match(panel, /JSON\.stringify\(prepared\.bundle, null, 2\)/);
  assert.match(css, /\.knowledge-stable-release-queue/);
  assert.match(css, /\.knowledge-stable-prepare/);
});
