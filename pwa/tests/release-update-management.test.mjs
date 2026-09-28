import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(root, "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("release migration stores per-user versions behind locked RPCs", async () => {
  const migration = await readRepo("supabase/migrations/20260919114658_pwa_release_update_management.sql");

  for (const table of ["app_releases", "app_release_channels", "user_release_state", "app_release_audit"]) {
    assert.match(migration, new RegExp("create table if not exists public\\." + table));
    assert.match(migration, new RegExp("alter table public\\." + table + " force row level security"));
    assert.match(migration, new RegExp("revoke all on table public\\." + table + " from anon, authenticated"));
  }

  for (const rpc of [
    "get_my_app_release_state",
    "accept_app_release",
    "admin_list_app_releases",
    "admin_create_app_release",
    "admin_publish_app_release",
    "admin_rollback_app_release",
  ]) {
    assert.match(migration, new RegExp("function public\\." + rpc));
  }

  assert.match(migration, /private\.is_active_admin\(\)/);
  assert.match(migration, /v_channel\.current_release_id <> p_release_id/);
  assert.match(migration, /where current_release_id = v_current/);
  assert.match(migration, /'0\.1\.0'/);
  assert.doesNotMatch(migration, /grant .* to anon/i);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|sk_(?:live|test)_|whsec_/i);
});

test("release client persists effective version for future feature gates", async () => {
  const client = await read("lib/app-release.ts");
  for (const rpc of [
    "get_my_app_release_state",
    "accept_app_release",
    "admin_list_app_releases",
    "admin_create_app_release",
    "admin_publish_app_release",
    "admin_rollback_app_release",
  ]) {
    assert.match(client, new RegExp(rpc));
  }
  assert.match(client, /APP_RELEASE_EFFECTIVE_KEY/);
  assert.match(client, /aasReleaseVersion/);
  assert.match(client, /aasReleaseBuild/);
  assert.match(client, /releaseVersionAtLeast/);
});

test("users only activate a waiting service worker after accepting an update", async () => {
  const [worker, manager] = await Promise.all([
    read("public/sw.js"),
    read("components/release-update-manager.tsx"),
  ]);

  const install = worker.match(/self\.addEventListener\("install",[\s\S]*?\n\}\);/);
  assert.ok(install);
  assert.doesNotMatch(install[0], /skipWaiting/);
  assert.match(worker, /AAS_ACTIVATE_RELEASE/);
  assert.match(worker, /self\.skipWaiting\(\)/);

  assert.match(manager, /acceptAppRelease/);
  assert.match(manager, /AAS_ACTIVATE_RELEASE/);
  assert.match(manager, /アップデートする/);
  assert.match(manager, /あとで/);
  assert.match(manager, /重要なアップデートがあります/);
  assert.match(manager, /is_admin_preview/);
});

test("admin release control provides candidate publish and rollback flows", async () => {
  const [page, sections, layout, css] = await Promise.all([
    read("components/admin-release-page.tsx"),
    read("lib/admin-sections.ts"),
    read("app/layout.tsx"),
    read("app/phase37-release-management.css"),
  ]);

  for (const label of [
    "管理者テスト版として登録",
    "アップデートを公開",
    "この版へ戻す",
    "任意アップデート",
    "必須アップデート",
  ]) {
    assert.match(page, new RegExp(label));
  }

  assert.match(page, /adminCreateAppRelease/);
  assert.match(page, /adminPublishAppRelease/);
  assert.match(page, /adminRollbackAppRelease/);
  assert.match(sections, /id: "releases"/);
  assert.match(sections, /href: "\/admin\/releases"/);
  assert.match(layout, /ReleaseUpdateManager/);
  assert.match(layout, /phase37-release-management\.css/);
  assert.match(css, /\.release-required-backdrop/);
  assert.match(css, /\.release-admin-page/);
});


test("staged release rollout isolates admin preview, selected user testers, and public users", async () => {
  const [migration, client, gate, manager, previewStatus, home, page, nextConfig, previewWorkflow, publicWorkflow, layout, css] = await Promise.all([
    readRepo("supabase/migrations/20260919144016_pwa_staged_release_rollout.sql"),
    read("lib/app-release.ts"),
    read("components/release-audience-gate.tsx"),
    read("components/release-update-manager.tsx"),
    read("components/release-preview-home-status.tsx"),
    read("components/phase18-beginner-home.tsx"),
    read("components/admin-release-page.tsx"),
    read("next.config.ts"),
    readRepo(".github/workflows/pwa-preview-deploy.yml"),
    readRepo(".github/workflows/pwa-member-beta-deploy.yml"),
    read("app/layout.tsx"),
    read("app/phase37-release-management.css"),
  ]);

  assert.match(migration, /create table if not exists public\.app_release_testers/);
  assert.match(migration, /alter table public\.app_release_testers force row level security/);
  assert.match(migration, /revoke all on table public\.app_release_testers from anon, authenticated/);
  assert.match(migration, /AAS-000002/);
  assert.match(migration, /candidate_stage in \('admin','tester'\)/);
  assert.match(migration, /function public\.get_my_app_release_state\(p_audience text\)/);
  assert.match(migration, /'preview_allowed'/);
  assert.match(migration, /'is_release_tester'/);
  assert.match(migration, /'is_tester_preview'/);
  assert.match(migration, /function public\.admin_set_app_release_tester/);
  assert.match(migration, /function public\.admin_promote_app_release_to_testers/);
  assert.match(migration, /candidate must pass tester stage before publish/);
  assert.match(migration, /candidate_stage = 'tester'/);
  assert.doesNotMatch(migration, /grant .* to anon/i);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|sk_(?:live|test)_|whsec_/i);

  assert.match(client, /AppDeploymentAudience = "public" \| "preview"/);
  assert.match(client, /NEXT_PUBLIC_AAS_RELEASE_AUDIENCE/);
  assert.match(client, /adminPromoteAppReleaseToTesters/);
  assert.match(client, /adminSetAppReleaseTester/);
  assert.match(client, /p_audience: audience/);

  assert.match(gate, /preview_allowed/);
  assert.match(gate, /is_release_tester/);
  assert.match(gate, /ALWAYS_PUBLIC_PREVIEW_PATHS/);
  const publicPreviewPaths = gate.split("\n").find((line) => line.startsWith("const ALWAYS_PUBLIC_PREVIEW_PATHS = ")) ?? "";
  for (const route of ["/support", "/commercial-transactions"]) {
    assert.ok(publicPreviewPaths.includes(`"${route}"`), `missing signed-out preview route: ${route}`);
  }
  for (const route of ["/plans", "/billing", "/admin"]) {
    assert.equal(publicPreviewPaths.includes(`"${route}"`), false, `unexpected signed-out preview route: ${route}`);
  }
  assert.match(gate, /\/auth\/callback/);
  assert.match(gate, /pathname === "\/"/);
  assert.match(gate, /if \(gate\.kind === "loading"\) return null/);
  assert.doesNotMatch(gate, /候補版の利用権を確認しています/);
  assert.match(gate, /第1段階の管理者確認中/);
  assert.match(gate, /管理者が指定した一般ユーザーテスター/);
  assert.match(gate, /if \(!session\) \{[\s\S]*?setGate\(\{ kind: "signed_out" \}\)/);
  assert.doesNotMatch(gate, /if \(session\) setGate\(\{ kind: "loading" \}\)/);
  assert.match(layout, /ReleaseAudienceGate/);

  assert.match(manager, /is_admin_preview \|\| state\.is_tester_preview/);
  assert.match(manager, /HIDDEN_PREFIXES/);
  for (const route of ["/support", "/commercial-transactions"]) {
    assert.ok(manager.includes(`"${route}"`), `missing release-manager public route: ${route}`);
  }
  assert.ok(
    manager.indexOf("if (hiddenRoute(pathname) || !accessUserId || !client)") < manager.indexOf("loadMyAppReleaseState(client)"),
    "signed-out and public legal/support routes must skip release RPC before refresh is defined",
  );
  assert.match(manager, /useSharedAccessState\(\)/);
  assert.match(manager, /\}, \[accessUserId, client, pathname\]\);/);
  assert.doesNotMatch(manager, /client\.auth\.onAuthStateChange/);
  assert.match(manager, /return null/);
  assert.match(previewStatus, /useSharedAccessState\(\)/);
  assert.match(previewStatus, /if \(!accessUserId \|\| !client\)/);
  assert.doesNotMatch(previewStatus, /client\.auth\.onAuthStateChange/);
  assert.match(previewStatus, /is_admin_preview/);
  assert.match(previewStatus, /is_tester_preview/);
  assert.match(previewStatus, /管理者確認/);
  assert.match(previewStatus, /テスター確認/);
  assert.match(previewStatus, /className="release-preview-home-status"/);
  assert.match(home, /ReleasePreviewHomeStatus/);
  assert.match(css, /\.release-preview-home-status/);
  assert.doesNotMatch(css, /\.release-admin-preview\s*\{/);
  assert.doesNotMatch(css, /\.release-preview-home-status\s*\{[^}]*position:\s*fixed/);
  assert.match(page, /第2段階：指定テスターへ反映/);
  assert.match(page, /第3段階：全一般ユーザーへ公開承認/);
  assert.match(page, /AAS-000002/);
  assert.match(page, /PUBLISH_VERIFICATION_ITEMS/);
  assert.match(page, /全体公開前チェック/);
  assert.match(page, /最新PreviewとCIを確認/);
  assert.match(page, /指定テスターで主要導線を確認/);
  assert.match(page, /iPhone実機PWAを確認/);
  assert.match(page, /停止・ロールバック経路を確認/);
  assert.match(page, /publishVerificationReady/);
  assert.match(page, /disabled=\{busy \|\| !publishVerificationReady\}/);
  assert.match(page, /publishVerificationStorageKey/);
  assert.match(page, /window\.localStorage\.setItem/);
  assert.match(css, /\.release-publish-checklist/);
  assert.match(css, /\.release-publish-checklist label\.checked/);

  assert.match(nextConfig, /NEXT_PUBLIC_AAS_RELEASE_AUDIENCE/);
  assert.match(previewWorkflow, /NEXT_PUBLIC_AAS_RELEASE_AUDIENCE: preview/);
  assert.match(publicWorkflow, /NEXT_PUBLIC_AAS_RELEASE_AUDIENCE: public/);
});


test("account switching stays available on prerelease denial and clears cached release state", async () => {
  const [gate, session, release, settings, access, logoutPage] = await Promise.all([
    read("components/release-audience-gate.tsx"),
    read("lib/auth-session.ts"),
    read("lib/app-release.ts"),
    read("components/pwa-settings-page.tsx"),
    read("components/phase6-app.tsx"),
    read("app/logout/page.tsx"),
  ]);

  assert.match(gate, /ログアウトして別のアカウントでログイン/);
  assert.match(gate, /href="\/logout"/);
  assert.match(gate, /ALWAYS_PUBLIC_PREVIEW_PATHS = \["\/auth\/callback", "\/logout"/);
  assert.match(gate, /auth\.getSession\(\)/);
  assert.match(gate, /sessionError \|\| !session/);
  assert.match(gate, /clearEffectiveRelease\(\)/);

  assert.match(session, /auth\.signOut\(\{ scope: "local" \}\)/);
  assert.match(session, /finally/);
  assert.match(session, /AUTH_STORAGE_PREFIX = "aas-pwa-auth"/);
  assert.match(session, /localStorage\.removeItem\(key\)/);
  assert.match(session, /clearEffectiveRelease\(\)/);
  assert.match(session, /aas-pwa-google-consent/);

  assert.match(release, /export function clearEffectiveRelease/);
  assert.match(release, /localStorage\.removeItem\(APP_RELEASE_EFFECTIVE_KEY\)/);
  assert.match(release, /aasReleaseVersion/);
  assert.match(release, /aasReleaseBuild/);

  assert.match(logoutPage, /signOutCurrentBrowser/);
  assert.match(logoutPage, /clearLocalAuthArtifacts/);
  assert.match(logoutPage, /clearEffectiveRelease/);
  assert.match(logoutPage, /window\.location\.replace\("\/"\)/);

  assert.match(settings, /signOutCurrentBrowser/);
  assert.match(settings, /window\.location\.replace\("\/"\)/);
  assert.match(settings, />ログアウト</);
  assert.match(access, /signOutCurrentBrowser/);
  assert.match(access, /window\.location\.replace\("\/"\)/);
});


test("preview release identity is subtle and rendered only by the home screen", async () => {
  const [manager, status, home, layout, css] = await Promise.all([
    read("components/release-update-manager.tsx"),
    read("components/release-preview-home-status.tsx"),
    read("components/phase18-beginner-home.tsx"),
    read("app/layout.tsx"),
    read("app/phase37-release-management.css"),
  ]);

  assert.match(layout, /<ReleaseUpdateManager \/>/);
  assert.match(manager, /Preview identity is shown only inside the home screen/);
  assert.doesNotMatch(manager, /className="release-admin-preview"/);
  assert.match(home, /<ReleasePreviewHomeStatus \/>/);
  assert.equal((home.match(/<ReleasePreviewHomeStatus \/>/g) ?? []).length, 1);
  assert.match(status, /<span>TEST<\/span>/);
  assert.match(status, /v\{state\.effective_release\.version\}/);
  assert.doesNotMatch(status, /一般ユーザーにはまだ|他の一般ユーザーにはまだ/);
  assert.match(css, /border-radius:\s*999px/);
  assert.match(css, /opacity:\s*\.86/);
  assert.match(css, /box-shadow:\s*none/);
});
