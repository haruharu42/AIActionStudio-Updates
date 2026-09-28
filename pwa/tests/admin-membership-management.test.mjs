import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const readRepo = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("membership admin route is registered in the grouped admin hub", () => {
  const registry = read("lib/admin-sections.ts");
  const route = read("app/admin/membership/page.tsx");
  const page = read("components/admin-membership-page.tsx");

  assert.match(registry, /id: "membership"/);
  assert.match(registry, /href: "\/admin\/membership"/);
  assert.match(registry, /メンバーシップ管理/);
  assert.match(route, /AdminMembershipPage/);
  assert.match(page, /noteメンバー特典の付与・取消、プラン別機能、参加URL/);
});

test("membership admin exposes note URL, feature matrix and user grant/revoke workflow", () => {
  const page = read("components/admin-membership-page.tsx");

  for (const label of [
    "noteメンバーシップ基本設定",
    "noteメンバーシップURL",
    "3プランの料金・表示設定",
    "プランごとの利用可能機能",
    "ユーザーへメンバー特典を付与",
    "メンバー特典を取り消す",
    "7日以内に期限",
    "クラウド容量",
    "メンバー特典の変更履歴",
  ]) {
    assert.match(page, new RegExp(label));
  }

  assert.match(page, /setCreatorMembershipPlan/);
  assert.match(page, /clearCreatorMembershipPlan/);
  assert.match(page, /window\.confirm/);
  assert.match(page, /note-membership-admin/);
  assert.match(page, /AAS ID または表示名/);
  assert.match(page, /configReady/);
  assert.match(page, /新しいメンバーシップ設定DBはまだ未適用です/);
  assert.match(page, /Creator Club特典の付与・変更・取消は利用できます/);
  assert.match(page, /https:\/\/note\.com\//);
  assert.doesNotMatch(page, /service[_-]?role|sb_secret_/i);
});

test("membership feature management is server gated and ready for cloud image storage", () => {
  const migration = readRepo("supabase/migrations/20260924034928_membership_management_center.sql");
  const adminClient = read("lib/admin-membership.ts");
  const accessClient = read("lib/membership-access.ts");

  for (const feature of [
    "cloud_image_storage",
    "cross_device_image_sync",
    "fresh_knowledge",
    "priority_templates",
    "member_missions",
    "plus_missions",
    "pro_missions",
    "article_quota_bonus",
  ]) {
    assert.match(migration, new RegExp(feature));
  }

  assert.match(migration, /private\.is_active_admin\(\)/);
  assert.match(migration, /has_creator_membership_feature/);
  assert.match(migration, /get_creator_membership_public_settings/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all on table public\.creator_membership_settings from public, anon, authenticated/);
  assert.match(migration, /revoke all on table public\.creator_membership_features from public, anon, authenticated/);
  assert.match(migration, /revoke all on table public\.creator_membership_plan_features from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.has_creator_membership_feature\(text\) to authenticated/);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_/i);

  assert.match(adminClient, /admin_get_creator_membership_settings/);
  assert.match(adminClient, /admin_update_creator_membership_settings/);
  assert.match(adminClient, /admin_set_creator_membership_plan_feature/);
  assert.match(accessClient, /get_creator_membership_public_settings/);
  assert.match(accessClient, /has_creator_membership_feature/);
});

test("membership operations expose active assignments, expiry watch and DB audit without weakening admin checks", () => {
  const migration = readRepo("supabase/migrations/20260924034934_membership_operations_and_public_features.sql");
  const page = read("components/admin-membership-page.tsx");
  const client = read("lib/admin-membership.ts");

  assert.match(migration, /creator_membership_admin_actions/);
  assert.match(migration, /audit_creator_membership_entitlement_change/);
  assert.match(migration, /after insert or update on public\.user_entitlements/);
  assert.match(migration, /admin_list_creator_membership_assignments/);
  assert.match(migration, /admin_list_creator_membership_actions/);
  assert.match(migration, /private\.is_active_admin\(\)/);
  assert.match(migration, /revoke all on table public\.creator_membership_admin_actions from public, anon, authenticated/);
  assert.match(migration, /list_creator_membership_feature_matrix/);
  assert.match(migration, /where \(select auth\.uid\(\)\) is not null/);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_/i);

  assert.match(client, /listMembershipAssignments/);
  assert.match(client, /listMembershipAuditActions/);
  assert.match(page, /現在のメンバー状況/);
  assert.match(page, /7日以内に期限/);
  assert.match(page, /メンバー特典の変更履歴/);
  assert.match(page, /assignmentPlanCounts/);
  assert.match(page, /expiringSoon/);
});

test("user membership page shows admin-configured note URL and only enabled managed benefits", () => {
  const page = read("app/membership/page.tsx");
  const access = read("lib/membership-access.ts");
  const css = read("components/creator-quests.module.css");

  assert.match(page, /getCreatorMembershipPublicSettings/);
  assert.match(page, /listCreatorMembershipFeatureMatrix/);
  assert.match(page, /noteメンバーシップを見る/);
  assert.match(page, /featuresByPlan/);
  assert.match(page, /if \(!item\.enabled\) continue/);
  assert.match(page, /このプランで利用できる機能/);
  assert.match(page, /formatMembershipPrice/);
  assert.match(page, /monthlyPriceYen/);
  assert.match(access, /get_creator_membership_public_settings/);
  assert.match(access, /list_creator_membership_feature_matrix/);
  assert.match(css, /membershipJoinCard/);
  assert.match(css, /membershipFeatureList/);
});

test("membership plan pricing is admin-editable and exposed to the user plan comparison", () => {
  const migration = readRepo("supabase/migrations/20260924034939_membership_plan_pricing_and_features.sql");
  const adminPage = read("components/admin-membership-page.tsx");
  const adminClient = read("lib/admin-membership.ts");
  const creatorClient = read("lib/creator-system.ts");
  const userPage = read("app/membership/page.tsx");

  assert.match(migration, /monthly_price_yen/);
  assert.match(migration, /description text not null default ''/);
  assert.match(migration, /admin_update_creator_membership_plan/);
  assert.match(migration, /admin_list_creator_membership_plans_v2/);
  assert.match(migration, /list_my_creator_membership_plans_v2/);
  assert.match(migration, /private\.is_active_admin\(\)/);
  assert.match(migration, /between 0 and 1000000/);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_/i);

  assert.match(adminClient, /updateMembershipPlan/);
  assert.match(adminClient, /admin_list_creator_membership_plans_v2/);
  assert.match(adminClient, /pricingManaged/);
  assert.match(adminPage, /3プランの料金・表示設定/);
  assert.match(adminPage, /月額料金（税込・円）/);
  assert.match(adminPage, /自由に割り振り/);
  assert.match(adminPage, /このプラン設定を保存/);
  assert.match(creatorClient, /list_my_creator_membership_plans_v2/);
  assert.match(creatorClient, /monthlyPriceYen/);
  assert.match(userPage, /料金未設定/);
  assert.match(userPage, /note側の月額料金/);
  assert.match(userPage, /このプランで利用できる機能/);
});

test("membership defaults make cloud image storage a member-only capability across active plans", () => {
  const migration = readRepo("supabase/migrations/20260924034928_membership_management_center.sql");

  assert.match(migration, /'CREATOR_CLUB', 'cloud_image_storage', true/);
  assert.match(migration, /'CREATOR_CLUB_PLUS', 'cloud_image_storage', true/);
  assert.match(migration, /'CREATOR_CLUB_PRO', 'cloud_image_storage', true/);
  assert.match(migration, /'CREATOR_CLUB', 'plus_missions', false/);
  assert.match(migration, /'CREATOR_CLUB_PLUS', 'plus_missions', true/);
  assert.match(migration, /'CREATOR_CLUB_PRO', 'pro_missions', true/);
});

test("membership management foreign keys have covering indexes", () => {
  const migration = readRepo("supabase/migrations/20260924035045_membership_management_fk_indexes.sql");

  assert.match(migration, /creator_membership_admin_actions_actor_idx/);
  assert.match(migration, /creator_membership_plan_features_feature_idx/);
  assert.match(migration, /creator_membership_plan_features_updated_by_idx/);
  assert.match(migration, /creator_membership_settings_updated_by_idx/);
  assert.doesNotMatch(migration, /drop table|drop column|truncate|delete from/i);
});

