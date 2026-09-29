import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const readRepo = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("promotion center stores final copy and screenshots in AAS cloud", () => {
  const migration = readRepo("supabase/migrations/20260929130500_promotion_content_assets_v1.sql");
  const client = read("lib/admin-promotion-content.ts");
  const workspace = read("components/admin-promotion/admin-promotion-content-workspace.tsx");
  const builder = read("components/admin-promotion/admin-promotion-channel-builder.tsx");

  assert.match(migration, /promotion_content_drafts/);
  assert.match(migration, /promotion_content_assets/);
  assert.match(migration, /'promotion-assets'/);
  assert.match(migration, /private\.is_active_admin\(\)/);
  assert.match(migration, /storage\.objects/);
  assert.match(migration, /admin_prepare_promotion_content_asset/);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_/i);

  assert.match(client, /client\.storage\.from\(bucket\)\.upload/);
  assert.match(client, /admin_save_promotion_content_draft/);
  assert.match(client, /admin_finalize_promotion_content_asset/);
  assert.match(client, /admin_begin_delete_promotion_content_asset/);

  assert.match(builder, /AdminPromotionContentWorkspace/);
  assert.match(workspace, /AAS本体へ保存/);
  assert.match(workspace, /装飾付きでコピー/);
  assert.match(workspace, /スクショを追加/);
  assert.match(workspace, /カーソル位置へ挿入/);
});

test("promotion rich copy embeds screenshot data at saved markers", () => {
  const rich = read("lib/promotion-rich-text.ts");
  const noteRich = read("lib/note-rich-text.ts");

  assert.match(rich, /PROMO_SCREENSHOT/);
  assert.match(rich, /<figure data-aas-promotion-screenshot/);
  assert.match(rich, /<img src=/);
  assert.match(rich, /blobToDataUrl/);
  assert.match(rich, /copyRichHtmlContent/);

  assert.match(noteRich, /export async function copyRichHtmlContent/);
  assert.match(noteRich, /"text\/html"/);
  assert.match(noteRich, /"text\/plain"/);
});
