import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(root, "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

const guardMigration =
  "supabase/migrations/20260910122000_phase9_pwa_invite_existing_entitlement_guard.sql";
const profileVariableFix =
  "supabase/migrations/20260910122500_phase9_pwa_invite_profile_variable_fix.sql";
const redemptionAudit =
  "supabase/migrations/20260925110123_pwa_invite_redemption_audit_v1.sql";

test("invite redemption cannot overwrite a still-valid or unlimited PWA entitlement", async () => {
  const sql = await readRepo(guardMigration);

  assert.match(sql, /create or replace function public\.redeem_pwa_invite/);
  assert.match(sql, /on conflict \(user_id, product_id\) where status = 'active'/);
  assert.match(sql, /where entitlement\.expires_at is not null\s+and entitlement\.expires_at <= now\(\)/);
  assert.match(sql, /if entitlement_id is null then\s+raise exception 'PWA entitlement already active'/);
  assert.match(sql, /insert into public\.pwa_invite_redemptions/);
  assert.match(sql, /use_count = use_count \+ 1/);
  assert.doesNotMatch(sql, /service[_-]?role|sb_secret_/i);
});

test("final invite RPC avoids PostgreSQL CURRENT_ROLE keyword collision", async () => {
  const sql = await readRepo(profileVariableFix);

  assert.match(sql, /profile_role text;/);
  assert.match(sql, /profile_state text;/);
  assert.match(sql, /into current_aas_id, profile_role, profile_state/);
  assert.match(sql, /profile_role <> 'user'/);
  assert.match(sql, /profile_state not in \('pending', 'active'\)/);
  assert.match(sql, /profile_state\s+from public\.user_entitlements/);
  assert.doesNotMatch(sql, /current_role text;/i);
  assert.doesNotMatch(sql, /service[_-]?role|sb_secret_/i);
});

test("PWA invite client maps an existing entitlement to a safe user-facing message", async () => {
  const api = await read("lib/phase9-invite.ts");

  assert.match(api, /entitlement already active/);
  assert.match(api, /有効なPWA利用権がすでにあります/);
  assert.doesNotMatch(api, /service[_-]?role|sb_secret_/i);
});


test("admin can audit access-code redemption without exposing private contact or billing data", async () => {
  const sql = await readRepo(redemptionAudit);
  const adminApi = await read("lib/pwa-admin-users.ts");

  assert.match(sql, /create or replace function public\.admin_list_pwa_invite_redemptions/);
  assert.match(sql, /private\.is_active_admin\(\)/);
  assert.match(sql, /profile\.aas_user_id/);
  assert.match(sql, /profile\.display_name/);
  assert.match(sql, /product\.product_code = 'AAS-PWA-BETA'/);
  assert.match(sql, /revoke all on function public\.admin_list_pwa_invite_redemptions\(uuid, integer\)[\s\S]*from public, anon/);
  assert.match(sql, /grant execute on function public\.admin_list_pwa_invite_redemptions\(uuid, integer\)[\s\S]*to authenticated/);
  assert.doesNotMatch(sql, /email|phone|billing_customer|card/i);
  assert.match(adminApi, /listPwaInviteRedemptions/);
});

test("PWA access-code page uses sales terminology and PWA-only device guidance", async () => {
  const [page, api, css] = await Promise.all([
    read("components/phase9-invite-page.tsx"),
    read("lib/phase9-invite.ts"),
    read("app/phase9-11.css"),
  ]);

  assert.match(page, /PWA利用コード/);
  assert.match(page, /利用コードを登録/);
  assert.match(page, /PC・スマホ・タブレットで共通/);
  assert.match(page, /const inFlight = useRef\(false\)/);
  assert.match(page, /if \(inFlight\.current\) return/);
  assert.match(page, /if \(!client\)[\s\S]*?アカウント接続を確認できません/);
  assert.match(page, /inFlight\.current = true/);
  assert.match(page, /inFlight\.current = false/);
  assert.match(page, /autoCapitalize="none"/);
  assert.match(page, /autoCorrect="off"/);
  assert.match(page, /spellCheck=\{false\}/);
  assert.match(page, /enterKeyHint="done"/);
  assert.match(css, /\.route-field input,[\s\S]*?font-size: 16px;/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.route-meta \{[\s\S]*?grid-template-columns: 1fr;/);
  assert.doesNotMatch(page, /Windows利用権/);
  assert.match(api, /この利用コードは使用できません/);
  assert.match(api, /access code redemption is disabled/);
  assert.match(api, /現在、利用コードの新規受付は停止しています/);
  assert.doesNotMatch(api, /この招待コードは/);
});
