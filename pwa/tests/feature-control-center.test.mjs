import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const read = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("feature control migration is server-authoritative, RLS locked, and tester-aware", async () => {
  const migration = await readRepo("supabase/migrations/20260925005852_app_feature_control_center_v1.sql");

  assert.match(migration, /create table if not exists public\.app_feature_controls/);
  assert.match(migration, /create table if not exists public\.app_feature_control_audit/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all on table public\.app_feature_controls from public, anon, authenticated/);
  assert.match(migration, /rollout_stage in \('admin','tester','public'\)/);
  assert.match(migration, /maintenance_mode boolean not null default false/);
  assert.match(migration, /public\.app_release_testers/);
  assert.match(migration, /private\.can_use_app_feature/);
  assert.match(migration, /private\.is_active_admin\(\)/);
  assert.match(migration, /admin-only feature cannot be released to users/);
  assert.match(migration, /maintenance_tester/);
  assert.doesNotMatch(migration, /grant .* to anon/i);
  assert.doesNotMatch(migration, /sb_secret_|sk_(?:live|test)_|whsec_/i);
});

test("feature registry covers current user features, all 12 side hustles, and admin tools", async () => {
  const migration = await readRepo("supabase/migrations/20260925005852_app_feature_control_center_v1.sql");

  for (const key of [
    "article-create", "prompt-library", "workflow", "article-library", "note-operations",
    "images", "sns", "sns-plan", "account-design", "publish", "analytics", "export",
    "ranking", "profile", "missions", "membership", "tools", "manual", "settings",
    "inquiries", "billing", "plans",
    "sidejob-content-sales", "sidejob-sns-management", "sidejob-youtube-video",
    "sidejob-affiliate", "sidejob-resale", "sidejob-crowdsourcing", "sidejob-skill-sales",
    "sidejob-digital-product", "sidejob-outreach", "sidejob-research",
    "sidejob-workflow-efficiency", "sidejob-planner",
    "admin-dashboard", "admin-users", "admin-membership", "admin-free-trial",
    "admin-sales", "admin-promotion", "admin-development-prompts", "admin-prompts",
    "admin-knowledge", "admin-releases", "admin-features", "admin-security",
    "admin-infrastructure", "admin-operations", "admin-inquiries",
  ]) {
    assert.ok(migration.includes("'" + key + "'"), key);
  }
});

test("side-hustle roadmap hub is registered in feature control without changing current public availability", async () => {
  const migration = await readRepo("supabase/migrations/20260929142710_side_hustle_roadmaps_feature_control_v1.sql");

  assert.match(migration, /'sidejob-roadmaps'/);
  assert.match(migration, /'\/side-hustle-roadmaps'/);
  assert.match(migration, /'public'/);
  assert.match(migration, /on conflict\(feature_key\) do update/);
  assert.doesNotMatch(migration, /rollout_stage=excluded\.rollout_stage/);
  assert.doesNotMatch(migration, /maintenance_mode=excluded\.maintenance_mode/);
});

test("feature control client normalizes server state and resolves the most specific route", async () => {
  const client = await read("lib/feature-control.ts");

  assert.match(client, /get_my_app_feature_controls/);
  assert.match(client, /admin_list_app_feature_controls/);
  assert.match(client, /admin_update_app_feature_control/);
  assert.match(client, /FeatureRolloutStage = "admin" \| "tester" \| "public"/);
  assert.match(client, /featureForPath/);
  assert.match(client, /routePrefix/);
  assert.match(client, /routePrefix\?\.length/);
});

test("global feature gate keeps admins available, blocks normal users, and refreshes maintenance state", async () => {
  const [gate, layout] = await Promise.all([
    read("components/feature-access-gate.tsx"),
    read("app/layout.tsx"),
  ]);

  assert.match(gate, /activeAdmin/);
  assert.match(gate, /isReleaseTester/);
  assert.match(gate, /maintenanceMode/);
  assert.match(gate, /現在メンテナンス中です/);
  assert.match(gate, /現在テスト公開中です/);
  assert.match(gate, /setInterval/);
  assert.match(gate, /60_000/);
  assert.match(gate, /EMERGENCY_ADMIN_PATHS/);
  assert.match(gate, /"\/admin\/features"/);
  assert.match(gate, /"\/admin\/releases"/);
  assert.match(gate, /"\/admin\/operations"/);
  assert.match(gate, /useAppFeatureAccess/);

  assert.match(layout, /FeatureAccessGate/);
  assert.match(layout, /phase54-feature-control\.css/);
  assert.match(layout, /<FeatureAccessGate>/);
});

test("embedded article library obeys the same feature availability control", async () => {
  const home = await read("components/phase18-beginner-home.tsx");

  assert.match(home, /useAppFeatureAccess\("article-library"\)/);
  assert.match(home, /articleLibraryAccess\.loading/);
  assert.match(home, /!articleLibraryAccess\.allowed/);
  assert.match(home, /記事ライブラリは現在メンテナンス中です/);
});

test("admin feature center is compact by default and provides rollout plus maintenance controls", async () => {
  const [page, route, css] = await Promise.all([
    read("components/admin-feature-control-page.tsx"),
    read("app/admin/features/page.tsx"),
    read("app/phase54-feature-control.css"),
  ]);

  assert.match(route, /AdminFeatureControlPage/);
  assert.match(page, /全機能管理センター/);
  assert.match(page, /管理者のみ/);
  assert.match(page, /AAS-000002等でテスト/);
  assert.match(page, /全一般ユーザー/);
  assert.match(page, /メンテナンスモード/);
  assert.match(page, /一般ユーザーを停止し、管理者・指定テスターだけで確認/);
  assert.match(page, /<details className="feature-control-group"/);
  assert.doesNotMatch(page, /<details[^>]* open/);
  assert.match(page, /window\.confirm/);
  assert.match(page, /adminUpdateAppFeatureControl/);
  assert.match(css, /\.feature-control-group/);
  assert.match(css, /\.feature-stage-actions/);
  assert.match(css, /@media \(max-width: 650px\)/);
});

test("feature control routes Notification Center public promotion through dedicated approval", async () => {
  const [migration, client] = await Promise.all([
    readRepo("supabase/migrations/20260930044500_notification_public_rollout_readiness_guard_v1.sql"),
    read("lib/feature-control.ts"),
  ]);

  assert.match(migration, /p_feature_key = 'notifications'/);
  assert.match(migration, /notification public promotion must use dedicated approval/);
  assert.match(migration, /admin_promote_notification_feature_public/);
  assert.match(migration, /admin_get_notification_readiness\(\)/);
  assert.match(migration, /automated_checks_pass/);
  assert.match(migration, /aal2 required for notification public promotion/);
  assert.match(migration, /all notification manual checks are required/);
  assert.match(migration, /update public\.app_feature_controls/);
  assert.match(migration, /insert into public\.app_feature_control_audit/);
  assert.match(client, /通知センターの全体公開は「通知管理」の最終承認から実行してください/);
});

test("release management and admin navigation link to the feature control center", async () => {
  const [releasePage, sections, nav] = await Promise.all([
    read("components/admin-release-page.tsx"),
    read("lib/admin-sections.ts"),
    read("lib/mobile-nav-preference.ts"),
  ]);

  assert.match(releasePage, /href="\/admin\/features"/);
  assert.match(releasePage, /機能単位の公開・メンテナンス/);
  assert.match(sections, /id: "features"/);
  assert.match(sections, /href: "\/admin\/features"/);
  assert.match(nav, /"adminFeatures"/);
  assert.match(nav, /href: "\/admin\/features"/);
});


test("staged rollout guard requires tester validation before public promotion", async () => {
  const [client, page, migration] = await Promise.all([
    read("lib/feature-control.ts"),
    read("components/admin-feature-control-page.tsx"),
    read("../supabase/migrations/20260928061527_feature_rollout_stage_guard_v1.sql"),
  ]);

  assert.match(client, /validateFeatureRolloutTransition/);
  assert.match(client, /currentStage === "admin" && targetStage === "public"/);
  assert.match(client, /activeTesterCount < 1/);
  assert.match(client, /管理者のみから全一般ユーザーへ直接公開はできません/);

  assert.match(page, /validateFeatureRolloutTransition/);
  assert.match(page, /snapshot\?\.testerCount \?\? 0/);
  assert.match(page, /先にテスト段階へ進めてください/);
  assert.match(page, /先にactiveなテストユーザーを登録してください/);

  assert.match(migration, /v_feature\.rollout_stage = 'admin' and p_rollout_stage = 'public'/);
  assert.match(migration, /tester rollout stage required before public release/);
  assert.match(migration, /active release tester required for staged rollout/);
  assert.match(migration, /public\.app_release_testers/);
  assert.match(migration, /p\.role = 'user'/);
  assert.match(migration, /p\.status = 'active'/);
  assert.match(migration, /private\.is_active_admin\(\)/);
  assert.match(migration, /revoke all on function public\.admin_update_app_feature_control\(text,text,boolean,text\) from public, anon/);
  assert.match(migration, /grant execute on function public\.admin_update_app_feature_control\(text,text,boolean,text\) to authenticated/);
});
