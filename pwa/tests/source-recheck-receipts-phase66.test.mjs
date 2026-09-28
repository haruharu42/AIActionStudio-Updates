import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("Phase 66 persists admin-only source recheck receipts", async () => {
  const migration = await readRepo("supabase/migrations/20260925002000_source_recheck_receipts_v1.sql");

  assert.match(migration, /create table if not exists public\.knowledge_source_recheck_receipts/);
  assert.match(migration, /outcome in \('unchanged','changed','unreachable','removed'\)/);
  assert.match(migration, /checked_by uuid not null references auth\.users/);
  assert.match(migration, /completed_cycle boolean not null default false/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.knowledge_source_recheck_receipts from public, anon, authenticated/);
  assert.doesNotMatch(migration, /grant .*knowledge_source_recheck_receipts.* to anon/i);
});

test("freshness advances only after every current source URL is checked unchanged", async () => {
  const migration = await readRepo("supabase/migrations/20260925002000_source_recheck_receipts_v1.sql");

  assert.match(migration, /receipt\.checked_at > coalesce\(baseline_checked_at/);
  assert.match(migration, /count\(\*\) filter \(where latest_outcome='unchanged'\)/);
  assert.match(migration, /checked_sources = total_sources/);
  assert.match(migration, /set source_checked_at=now\(\),updated_at=now\(\)/);
  assert.match(migration, /set completed_cycle=true/);
  assert.match(migration, /source URL is not registered on this item/);
});

test("changed or unavailable sources keep freshness old and open a Fresh follow-up", async () => {
  const migration = await readRepo("supabase/migrations/20260925002000_source_recheck_receipts_v1.sql");

  assert.match(migration, /outcome_value in \('changed','unreachable','removed'\)/);
  assert.match(migration, /request\.channel='fresh'/);
  assert.match(migration, /insert into public\.knowledge_refresh_requests/);
  assert.match(migration, /Source recheck requires follow-up/);
  assert.doesNotMatch(migration, /if outcome_value in \('changed','unreachable','removed'\)[\s\S]{0,1200}source_checked_at=now\(\)/);
});

test("PWA client and admin UI expose explicit source verification outcomes", async () => {
  const [client, panel, css] = await Promise.all([
    readPwa("lib/knowledge-auto-update.ts"),
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("app/phase26-knowledge.css"),
  ]);

  assert.match(client, /SourceRecheckOutcome = "unchanged" \| "changed" \| "unreachable" \| "removed"/);
  assert.match(client, /adminRecordSourceRecheckReceipt/);
  assert.match(client, /adminListSourceRecheckReceipts/);
  assert.match(panel, /公式ページを実際に確認し/);
  assert.match(panel, />変更なし</);
  assert.match(panel, />変更あり</);
  assert.match(panel, />取得不可</);
  assert.match(panel, /最近の根拠再確認履歴/);
  assert.match(panel, /全根拠URLを「変更なし」で確認しました/);
  assert.match(css, /\.knowledge-source-receipt-row/);
  assert.match(css, /\.knowledge-source-receipt-history/);
});

test("receipt RPCs require an active admin and do not expose privileged secrets", async () => {
  const migration = await readRepo("supabase/migrations/20260925002000_source_recheck_receipts_v1.sql");

  assert.match(migration, /private\.is_active_admin/);
  assert.match(migration, /grant execute on function public\.admin_record_knowledge_source_recheck_receipt/);
  assert.match(migration, /grant execute on function public\.admin_list_knowledge_source_recheck_receipts/);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|api[_-]?key/i);
});
