import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(root, "..");
const readPwa = (relative) => readFile(path.join(root, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("reference home owns creator presentation without duplicating global banners", async () => {
  const homeRoute = await readPwa("app/page.tsx");
  const home = await readPwa("components/phase18-beginner-home.tsx");
  const shell = await readPwa("components/aas-reference-shell.tsx");
  const mobileNav = await readPwa("components/shared-mobile-bottom-nav.tsx");
  const mobilePrefs = await readPwa("lib/mobile-nav-preference.ts");

  assert.doesNotMatch(homeRoute, /CreatorHud/);
  assert.doesNotMatch(homeRoute, /FreeTrialBanner/);
  assert.match(home, /getMyCreatorDashboard/);
  assert.match(home, /今日のミッション/);
  assert.match(home, /記事ライブラリ \/ noteマガジン/);
  assert.match(home, /getSupportNotificationSummary/);
  assert.match(home, /const hasHeaderNotification = Boolean\(dashboard\?\.claimableMissions\) \|\| hasSupportNotification/);
  assert.match(home, /hasUnreadNotifications=\{hasHeaderNotification\}/);
  assert.match(home, /ranking\.length \? "圏外" : "未集計"/);
  assert.match(mobileNav, /ホーム/);
  assert.match(mobilePrefs, /ランキング/);
  assert.match(mobilePrefs, /プロフィール/);
  assert.match(shell, /SharedMobileBottomNav/);
  assert.match(shell, /hasUnreadNotifications/);
});

test("reference home mission rows keep the text column unconstrained on mobile", async () => {
  const css = await readPwa("app/phase33-reference-ui.css");

  assert.match(css, /\.reference-mission-row > span:first-child\s*\{/);
  assert.match(css, /\.reference-mission-row > span:nth-child\(2\)\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.reference-mission-row\.done > span:first-child\s*\{/);
  assert.doesNotMatch(css, /\.reference-mission-row > span\s*\{/);
});

test("creator client uses v2 dashboard with a legacy compatibility fallback", async () => {
  const source = await readPwa("lib/creator-system.ts");
  assert.match(source, /client\.rpc\("get_my_creator_dashboard_v2"\)/);
  assert.match(source, /client\.rpc\("get_my_creator_dashboard"\)/);
  assert.match(source, /getMyCreatorMissions/);
  assert.match(source, /claimCreatorMissionReward/);
  assert.match(source, /listCreatorMembershipPlans/);
});

test("creator pages keep membership, missions and ranking separate and beginner-readable", async () => {
  const missions = await readPwa("app/missions/page.tsx");
  const membership = await readPwa("app/membership/page.tsx");
  const ranking = await readPwa("app/ranking/page.tsx");

  assert.match(missions, /getMyCreatorMissions/);
  assert.match(missions, /claimCreatorMissionReward/);
  assert.match(missions, /記事制作を進めるだけで達成できます/);
  assert.match(missions, /creator-quests\.module\.css/);

  assert.match(membership, /listCreatorMembershipPlans/);
  assert.match(membership, /getArticleStockSummary/);
  assert.match(membership, /記事ライブラリ保存枠/);
  assert.match(membership, /現在のアカウントに実際に適用されている保存枠/);
  assert.match(membership, /articleStockSummary\.currentArticles/);
  assert.match(membership, /articleStockSummary\.remainingArticles/);
  assert.match(membership, /articleStockSummary\.isUnlimited/);
  assert.match(membership, /getArticleStockSummary\(client\)\.catch\(\(\) => null\)/);
  assert.match(membership, /記事枠ボーナス/);
  assert.doesNotMatch(membership, /記事ストック上限/);
  assert.match(membership, /AASに登録されたnoteメンバーシッププラン/);
  assert.match(membership, /note購入状態の自動取得は別の連携機能/);
  assert.match(membership, /creator-quests\.module\.css/);

  assert.match(ranking, /getCreatorRanking/);
  assert.match(ranking, /完成記事数/);
  assert.match(ranking, /最初に条件を満たした時だけ集計/);
  assert.match(ranking, /referenceRankTabs/);
  assert.match(ranking, /queueMicrotask/);
  assert.match(ranking, /requestIdRef/);
  assert.match(ranking, /requestId !== requestIdRef\.current/);
  assert.match(ranking, /rows\.length \? "圏外" : "未集計"/);
});

test("membership migration is additive, tier-aware and preserves article RPC names", async () => {
  const migration = await readRepo("supabase/migrations/20260917202000_creator_membership_plans_missions_quota.sql");
  const flexibility = await readRepo("supabase/migrations/20260917202100_creator_membership_plan_tier_flexibility.sql");

  assert.match(migration, /AAS-NOTE-CREATOR-CLUB-PLUS/);
  assert.match(migration, /AAS-NOTE-CREATOR-CLUB-PRO/);
  assert.match(migration, /create table if not exists public\.creator_membership_plans/);
  assert.match(migration, /create table if not exists public\.creator_mission_definitions/);
  assert.match(migration, /private\.creator_article_quota_bonus/);
  assert.match(migration, /create or replace function public\.create_article\(p_article jsonb default '\{\}'::jsonb\)/i);
  assert.match(migration, /create or replace function public\.get_my_article_stock_summary\(\)/);
  assert.match(migration, /article_quota_bonus_every_levels integer not null default 5/);
  assert.match(migration, /article_quota_bonus_per_step integer not null default 10/);
  assert.match(flexibility, /drop index if exists public\.creator_membership_plans_active_tier_idx/);
  assert.match(flexibility, /creator_membership_plans_tier_lookup_idx/);

  assert.doesNotMatch(migration, /latest\.json/i);
  assert.doesNotMatch(migration, /Update\.ps1/i);
  assert.doesNotMatch(migration, /windows\/|app\/auth_ui\.py/i);
});

test("mission completion remains tied to first valid completed article", async () => {
  const migration = await readRepo("supabase/migrations/20260917202000_creator_membership_plans_missions_quota.sql");
  assert.match(migration, /creator_article_completions/);
  assert.match(migration, /on conflict \(article_id\) do nothing/i);
  assert.match(migration, /new\.status not in \('ready', 'waiting_publish', 'published'\)/);
  assert.match(migration, /body_chars < min_body_chars/);
  assert.match(migration, /progress_creator_missions\(new\.user_id, 'article_completed', 1\)/);
});

test("generation credits are stored as rewards without changing the existing usage limiter in this feature", async () => {
  const migration = await readRepo("supabase/migrations/20260917202000_creator_membership_plans_missions_quota.sql");
  const freeTrial = await readPwa("lib/free-trial.ts");

  assert.match(migration, /bonus_generation_credits/);
  assert.match(migration, /reward_generation_credits/);
  assert.doesNotMatch(migration, /create or replace function public\.consume_free_trial_usage/i);
  assert.match(freeTrial, /consume_free_trial_usage/);
});

test("admin can atomically register one verified Creator Club plan without touching PWA access", async () => {
  const migration = await readRepo("supabase/migrations/20260917202200_creator_membership_admin_management.sql");
  const client = await readPwa("lib/pwa-admin-users.ts");
  const controller = await readPwa("components/pwa-admin-users-page.tsx");
  const panels = await readPwa("components/admin-users/admin-user-panels.tsx");
  const activeAdminUi = `${controller}\n${panels}`;

  assert.match(migration, /admin_set_creator_membership_plan/);
  assert.match(migration, /admin_clear_creator_membership_plan/);
  assert.match(migration, /set status = 'revoked'/);
  assert.match(migration, /creator_membership_plans/);
  assert.doesNotMatch(migration, /AAS-PWA-BETA/);

  assert.match(client, /CREATOR_MEMBERSHIP_PLANS/);
  assert.match(client, /admin_set_creator_membership_plan/);
  assert.match(client, /admin_clear_creator_membership_plan/);
  assert.match(activeAdminUi, /note購入状態の自動取得は行わず/);
  assert.match(activeAdminUi, /Creator Clubを登録・変更/);
  assert.match(activeAdminUi, /Creator Clubを解除/);
  assert.doesNotMatch(activeAdminUi, /AAS-WIN-BETA|Windowsアプリ版/);
});

test("admin access panels show only currently usable PWA and Creator Club entitlements", async () => {
  const client = await readPwa("lib/pwa-admin-users.ts");

  assert.match(client, /function isCurrentEntitlement/);
  assert.match(client, /item\.status !== "active"/);
  assert.match(client, /expiresAt > Date\.now\(\)/);
  assert.match(client, /item\.productCode === PWA_PRODUCT && isCurrentEntitlement\(item\)/);
  assert.match(client, /CREATOR_MEMBERSHIP_PRODUCTS\.has\(item\.productCode\) && isCurrentEntitlement\(item\)/);
});


test("reference UI v2 keeps ranking metrics inline and profile/home cards readable at iPhone widths", async () => {
  const ranking = await readPwa("app/ranking/page.tsx");
  const profile = await readPwa("app/profile/page.tsx");
  const moduleCss = await readPwa("components/creator-system.module.css");
  const referenceCss = await readPwa("app/phase33-reference-ui.css");

  assert.match(ranking, /reference-page-inner reference-ranking-page/);
  assert.match(profile, /reference-page-inner reference-profile-page/);
  assert.match(moduleCss, /Ranking and profile UI v2: readable mobile density without changing RPC-backed data/);
  assert.match(moduleCss, /@media \(max-width: 640px\)[\s\S]*?\.referenceRankRow \{[\s\S]*?grid-template-columns: 30px 36px minmax\(0, 1fr\) auto/);
  assert.match(moduleCss, /@media \(max-width: 640px\)[\s\S]*?\.referenceToggleGrid \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(moduleCss, /@media \(max-width: 640px\)[\s\S]*?\.referenceDataGrid \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(referenceCss, /Home\/ranking\/profile UI v2: readable reference-scale cards on phone, tablet, and desktop/);
  assert.match(referenceCss, /\.reference-mission-row strong \{[\s\S]*?font-size: 12px/);
  assert.match(referenceCss, /\.reference-quick-step strong \{[\s\S]*?font-size: 10\.5px/);
});


test("profile avatars use one compressed WebP object per user instead of a URL input", async () => {
  const profile = await readPwa("app/profile/page.tsx");
  const helper = await readPwa("lib/profile-avatar.ts");
  const creator = await readPwa("lib/creator-system.ts");
  const css = await readPwa("components/creator-system.module.css");
  const migration = await readRepo("supabase/migrations/20260918064500_profile_avatar_storage.sql");

  assert.match(profile, /プロフィール画像/);
  assert.match(profile, /画像を選択/);
  assert.match(profile, /image\/jpeg,image\/png,image\/webp/);
  assert.match(profile, /prepareProfileAvatar/);
  assert.match(profile, /uploadProfileAvatar/);
  assert.doesNotMatch(profile, /プロフィール画像URL/);
  assert.doesNotMatch(profile, /placeholder="https:\/\/\.\.\."/);

  assert.match(helper, /PROFILE_AVATAR_MAX_STORED_BYTES = 500 \* 1024/);
  assert.match(helper, /PROFILE_AVATAR_MAX_EDGE = 512/);
  assert.match(helper, /canvas\.toBlob/);
  assert.match(helper, /"image\/webp"/);
  assert.match(helper, /\$\{user\.id\}\/avatar\.webp/);
  assert.match(helper, /upsert: true/);
  assert.match(creator, /resolveProfileAvatarUrl/);

  assert.match(migration, /'profile-avatars'/);
  assert.match(migration, /public,\s*file_size_limit,\s*allowed_mime_types/s);
  assert.match(migration, /true,\s*512000,\s*array\['image\/webp'\]/s);
  assert.match(migration, /name = \(select auth\.uid\(\)\)::text \|\| '\/avatar\.webp'/);
  assert.match(migration, /for insert\s+to authenticated/s);
  assert.match(migration, /for update\s+to authenticated/s);
  assert.match(migration, /for delete\s+to authenticated/s);

  assert.match(css, /Profile avatar upload: local preview, client-side compression, one stored image per user/);
  assert.doesNotMatch(`${profile}\n${helper}`, /service[_-]?role|sb_secret_/i);
});


test("profile ranking privacy cards keep checkboxes above text at phone widths", async () => {
  const profile = await readPwa("app/profile/page.tsx");
  const css = await readPwa("components/creator-system.module.css");

  assert.match(profile, /referenceSwitchCard[\s\S]*?<input type="checkbox"[\s\S]*?<span><strong>ランキングに参加する/);
  assert.match(profile, /referenceSwitchCard[\s\S]*?<input type="checkbox"[\s\S]*?<span><strong>記事数を公開/);
  assert.match(profile, /referenceSwitchCard[\s\S]*?<input type="checkbox"[\s\S]*?<span><strong>レベルを公開/);
  assert.match(css, /\.referenceSwitchCard \{[\s\S]*?flex-direction: column;[\s\S]*?align-items: stretch;/);
  assert.match(css, /\.referenceSwitchCard > span \{[\s\S]*?width: 100%;/);
  assert.match(css, /\.referenceSwitchCard input \{[\s\S]*?align-self: center;/);
});
