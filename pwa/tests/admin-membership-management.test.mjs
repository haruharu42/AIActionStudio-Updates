import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const readAdminMembershipSource = () => [
  read("components/admin-membership-page.tsx"),
  read("components/admin-membership/admin-membership-static-sections.tsx"),
].join("\n");
const readRepo = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("membership presentation sections stay outside the mutation controller", () => {
  const page = read("components/admin-membership-page.tsx");
  const sections = read("components/admin-membership/admin-membership-static-sections.tsx");

  assert.match(page, /MembershipStatusSection/);
  assert.match(page, /MembershipAuditSection/);
  assert.match(page, /MembershipRecommendationsSection/);
  assert.match(sections, /export function MembershipStatusSection/);
  assert.match(sections, /export function MembershipAuditSection/);
  assert.match(sections, /export function MembershipRecommendationsSection/);
  assert.doesNotMatch(sections, /getSupabaseClient|\.rpc\(|setCreatorMembershipPlan|clearCreatorMembershipPlan|updateMembershipPlan|setMembershipPlanFeature/);
});

test("membership admin route is registered in the grouped admin hub", () => {
  const registry = read("lib/admin-sections.ts");
  const route = read("app/admin/membership/page.tsx");
  const page = readAdminMembershipSource();

  assert.match(registry, /id: "membership"/);
  assert.match(registry, /href: "\/admin\/membership"/);
  assert.match(registry, /メンバーシップ管理/);
  assert.match(route, /AdminMembershipPage/);
  assert.match(page, /noteメンバー特典の付与・取消、プラン別機能、参加URL/);
});

test("membership admin exposes note URL, feature matrix and user grant/revoke workflow", () => {
  const page = readAdminMembershipSource();

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
  const page = readAdminMembershipSource();
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
  const adminPage = readAdminMembershipSource();
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

test("membership admin exposes article library plan quotas without activating them implicitly", () => {
  const page = readAdminMembershipSource();
  const client = read("lib/admin-membership.ts");
  const quotaMigration = readRepo("supabase/migrations/20260929013207_article_library_plan_limits_v1.sql");
  const unlimitedMigration = readRepo("supabase/migrations/20260929013814_article_library_plan_limit_unlimited_guard.sql");
  const css = read("app/phase47-admin-usability.css");

  assert.match(client, /admin_list_creator_membership_plans_v3/);
  assert.match(client, /admin_get_article_library_quota_settings/);
  assert.match(client, /admin_update_article_library_quota_settings/);
  assert.match(client, /admin_update_creator_membership_plan_v2/);
  assert.match(client, /articleLibraryLimit/);
  assert.match(client, /articleLibraryUnlimited/);
  assert.match(page, /記事ライブラリ保存上限/);
  assert.match(page, /無料ユーザー/);
  assert.match(page, /保存数を無制限にする/);
  assert.match(page, /準備済み・未発効/);
  assert.match(page, /発効は公開前の安全確認後に行います/);
  assert.match(page, /saveArticleLibraryFreeLimit/);
  assert.match(page, /savePlanArticleLibraryQuota/);
  assert.match(css, /\.membership-library-quota-grid/);
  assert.match(css, /\.membership-library-unlimited/);

  assert.match(quotaMigration, /plan_limits_enabled boolean not null default false/);
  assert.match(quotaMigration, /when 'CREATOR_CLUB' then 15/);
  assert.match(quotaMigration, /when 'CREATOR_CLUB_PLUS' then 30/);
  assert.match(unlimitedMigration, /plan_code = 'CREATOR_CLUB_PRO'/);
  assert.match(unlimitedMigration, /article_library_unlimited/);
  assert.doesNotMatch(page, /admin_update_article_library_quota_settings|plan_limits_enabled\s*=\s*true/i);
});

test("article library quota activation requires aggregate readiness and AAL2 while keeping emergency stop available", () => {
  const page = readAdminMembershipSource();
  const client = read("lib/admin-membership.ts");
  const migration = readRepo("supabase/migrations/20260930021747_article_library_quota_activation_guard_v1.sql");
  const css = read("app/phase47-admin-usability.css");

  assert.match(migration, /admin_get_article_library_quota_readiness/);
  assert.match(migration, /users_over_future_limit/);
  assert.match(migration, /automated_checks_pass/);
  assert.match(migration, /admin_set_article_library_plan_limits_enabled/);
  assert.match(migration, /v_aal <> 'aal2'/);
  assert.match(migration, /lock table public\.articles in share mode/);
  assert.match(migration, /lock table public\.creator_membership_plans in share mode/);
  assert.match(migration, /lock table public\.user_entitlements in share mode/);
  assert.match(migration, /if p_enabled then[\s\S]*?aal2 required for article library quota activation/);
  assert.match(migration, /update public\.article_library_quota_settings[\s\S]*?plan_limits_enabled=p_enabled/);
  assert.match(migration, /revoke all on function public\.admin_set_article_library_plan_limits_enabled\(boolean\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.admin_set_article_library_plan_limits_enabled\(boolean\) to authenticated/);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_/i);

  assert.match(client, /ArticleLibraryQuotaReadiness/);
  assert.match(client, /ArticleLibraryQuotaReadinessIssue/);
  assert.match(client, /articleLibraryQuotaReadinessIssues/);
  for (const code of ["free_limit", "plan_count", "plan_config", "future_overage"]) {
    assert.match(client, new RegExp(`code: "${code}"`));
  }
  assert.match(client, /usersOverFutureLimit > 0/);
  assert.match(client, /maxOverage/);
  assert.match(client, /admin_get_article_library_quota_readiness/);
  assert.match(client, /admin_set_article_library_plan_limits_enabled/);
  assert.match(client, /aal2 required for article library quota activation/);
  assert.match(page, /自動確認 通過/);
  assert.match(page, /発効前に解消する項目/);
  assert.match(page, /自動確認のブロッカーはありません/);
  assert.match(page, /articleLibraryQuotaReadinessIssues\(articleLibraryReadiness\)/);
  assert.match(page, /将来上限の超過/);
  assert.match(page, /0名のみ発効可能/);
  assert.match(page, /プラン別上限を発効（MFA必須）/);
  assert.match(page, /従来上限へ戻す（緊急停止）/);
  assert.match(page, /管理者MFAを確認/);
  assert.match(page, /getAuthenticatorAssuranceLevel/);
  assert.match(page, /articleLibraryCurrentAal/);
  assert.match(page, /articleLibraryAalCheckFailed/);
  assert.match(page, /articleLibraryCurrentAal !== "aal2"/);
  assert.match(page, /MFA状態: AAL2認証済み/);
  assert.match(page, /MFA状態: AAL2未認証/);
  assert.match(page, /MFA認証状態がAAL2ではないため、プラン別保存上限を発効しませんでした/);
  assert.match(page, /disabled=\{[\s\S]*?articleLibraryCurrentAal !== "aal2"[\s\S]*?\}/);
  assert.match(page, /window\.confirm\(warning\)/);
  assert.match(css, /\.membership-library-readiness/);
  assert.match(css, /\.membership-library-readiness-blockers/);
  assert.match(css, /\.membership-library-readiness-blocker-list/);
  assert.match(css, /\.membership-library-readiness-grid/);
  assert.match(css, /\.membership-library-activation-actions/);
  assert.match(css, /\.membership-library-mfa-status/);
  assert.match(css, /\.membership-library-mfa-status\.ready/);
  assert.match(css, /\.membership-library-mfa-status\.action/);
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

