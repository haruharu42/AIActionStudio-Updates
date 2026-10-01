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

test("admin release control provides Preview Canary public promotion and rollback flows", async () => {
  const [page, sections, layout, css] = await Promise.all([
    read("components/admin-release-page.tsx"),
    read("lib/admin-sections.ts"),
    read("app/layout.tsx"),
    read("app/phase37-release-management.css"),
  ]);

  for (const label of [
    "管理者テスト版として登録",
    "第2段階：Production Canaryへ反映",
    "第3段階：Canary確認済みにする",
    "第4段階：全一般ユーザーへ公開",
    "この版へ戻す",
    "任意アップデート",
    "必須アップデート",
  ]) {
    assert.match(page, new RegExp(label));
  }

  assert.match(page, /adminCreateAppRelease/);
  assert.match(page, /requestCanaryPwaDeployment/);
  assert.match(page, /confirmCanaryDeployment/);
  assert.match(page, /requestPublicPwaDeployment/);
  assert.match(page, /adminRollbackAppRelease/);
  assert.match(page, /candidateCanaryDeployment\.source_sha/);
  assert.match(page, /同一artifact/);
  assert.match(sections, /id: "releases"/);
  assert.match(sections, /href: "\/admin\/releases"/);
  assert.match(layout, /ReleaseUpdateManager/);
  assert.match(layout, /phase37-release-management\.css/);
  assert.match(css, /\.release-required-backdrop/);
  assert.match(css, /\.release-admin-page/);
});

test("staged release rollout isolates Preview admin Production Canary testers and public users", async () => {
  const [legacyMigration, canaryMigration, client, gate, manager, page, previewWorkflow, canaryWorkflow, publicWorkflow, layout, css] = await Promise.all([
    readRepo("supabase/migrations/20260919144016_pwa_staged_release_rollout.sql"),
    readRepo("supabase/migrations/20261001103000_production_canary_release_pipeline.sql"),
    read("lib/app-release.ts"),
    read("components/release-audience-gate.tsx"),
    read("components/release-update-manager.tsx"),
    read("components/admin-release-page.tsx"),
    readRepo(".github/workflows/pwa-preview-deploy.yml"),
    readRepo(".github/workflows/pwa-admin-canary-release.yml"),
    readRepo(".github/workflows/pwa-admin-public-release.yml"),
    read("app/layout.tsx"),
    read("app/phase37-release-management.css"),
  ]);

  assert.match(legacyMigration, /create table if not exists public\.app_release_testers/);
  assert.match(legacyMigration, /AAS-000002/);
  assert.match(legacyMigration, /candidate_stage in \('admin','tester'\)/);
  assert.match(legacyMigration, /function public\.get_my_app_release_state\(p_audience text\)/);
  assert.match(legacyMigration, /'is_release_tester'/);

  assert.match(canaryMigration, /deployment_kind in \('canary','public'\)/);
  assert.match(canaryMigration, /admin_request_app_release_canary_deploy/);
  assert.match(canaryMigration, /admin_confirm_app_release_canary/);
  assert.match(canaryMigration, /verified production canary required before public deploy/);
  assert.match(canaryMigration, /direct publish disabled/);

  assert.match(client, /AppDeploymentTier = "public" \| "preview" \| "canary"/);
  assert.match(client, /AAS_PRODUCTION_CANARY_HOSTNAME/);
  assert.match(client, /appDeploymentAudience/);
  assert.match(client, /adminSetAppReleaseTester/);
  assert.match(client, /p_audience: audience/);

  assert.match(gate, /preview_allowed/);
  assert.match(gate, /is_release_tester/);
  assert.match(gate, /appDeploymentTier/);
  assert.match(gate, /Production Canary版を適用しますか？/);
  assert.match(gate, /"aas\.tester-" \+ deploymentTier/);
  assert.match(gate, /公開環境を確認しています/);
  assert.match(layout, /ReleaseAudienceGate/);

  assert.match(manager, /state\.is_release_tester === true/);
  assert.match(manager, /state\.candidate_stage === "tester"/);
  assert.match(manager, /AAS_CANARY_PWA_URL/);
  assert.match(manager, /Production Canary/);

  assert.match(page, /①Preview管理者確認/);
  assert.match(page, /②Production Canaryへ反映/);
  assert.match(page, /③公開テスター確認済み/);
  assert.match(page, /④全一般ユーザーへ公開/);
  assert.match(page, /AAS-000002/);
  assert.match(page, /PUBLISH_VERIFICATION_ITEMS/);
  assert.match(page, /Production Canary確認チェック/);
  assert.match(page, /requestCanaryPwaDeployment/);
  assert.match(page, /confirmCanaryDeployment/);
  assert.match(page, /requestPublicPwaDeployment/);
  assert.match(page, /currentSessionAal !== "aal2"/);
  assert.match(page, /candidateCanaryDeployment\.source_sha/);
  assert.match(page, /同一artifact/);
  assert.match(page, /管理者MFAで再認証/);
  assert.match(page, /publishVerificationStorageKey/);
  assert.match(css, /\.release-publish-checklist/);

  assert.match(previewWorkflow, /NEXT_PUBLIC_AAS_RELEASE_AUDIENCE: preview/);
  assert.match(canaryWorkflow, /NEXT_PUBLIC_AAS_RELEASE_AUDIENCE: public/);
  assert.match(canaryWorkflow, /ai-article-studio-pwa-canary/);
  assert.match(publicWorkflow, /Download exact Canary-tested release bundle/);
  assert.doesNotMatch(publicWorkflow, /NEXT_PUBLIC_AAS_RELEASE_AUDIENCE: public/);
  assert.doesNotMatch(publicWorkflow, /npm test|npm run build|vinext build/);
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
  assert.ok(gate.includes('const ALWAYS_PUBLIC_PREVIEW_PATHS = ["/auth/callback", "/login", "/logout"'));
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


test("public release publish requires current admin AAL2 while rollback remains an emergency admin operation", async () => {
  const [migration, client, page] = await Promise.all([
    readRepo("supabase/migrations/20260928042314_pwa_release_publish_aal2_v1.sql"),
    read("lib/app-release.ts"),
    read("components/admin-release-page.tsx"),
  ]);

  assert.match(migration, /v_aal text := coalesce\(\(select auth\.jwt\(\)->>'aal'\), 'aal1'\)/);
  assert.match(migration, /if v_aal <> 'aal2' then[\s\S]*?aal2 required for public release publish/);
  assert.match(migration, /candidate must pass tester stage before publish/);
  assert.match(migration, /active release tester required before publish/);
  assert.doesNotMatch(migration, /admin_rollback_app_release/);
  assert.match(client, /aal2 required for public release publish/);
  assert.match(client, /全体公開には現在の管理者セッションでMFA認証（AAL2）が必要/);
  assert.match(page, /getAuthenticatorAssuranceLevel/);
  assert.match(page, /currentSessionAal !== "aal2"/);
  assert.match(page, /管理者MFAで再認証/);
  assert.match(page, /adminRollbackAppRelease/);
});


test("interactive admins cannot bypass the guarded public deployment pipeline", async () => {
  const migration = await readRepo("supabase/migrations/20260928143200_disable_direct_public_release_publish.sql");
  assert.match(migration, /revoke execute on function public\.admin_publish_app_release\(uuid\) from authenticated/);
  assert.match(migration, /grant execute on function public\.admin_publish_app_release\(uuid\) to service_role/);
  assert.match(migration, /Interactive admin clients must use the Preview-to-public deployment pipeline/);
});

test("admin deployment pipeline couples public release to the exact verified Production Canary artifact", async () => {
  const [canaryMigration, edgeFunction, client, page, canaryWorkflow, publicWorkflow, previewWorkflow] = await Promise.all([
    readRepo("supabase/migrations/20261001103000_production_canary_release_pipeline.sql"),
    readRepo("supabase/functions/pwa-release-deploy/index.ts"),
    read("lib/release-deployment.ts"),
    read("components/admin-release-page.tsx"),
    readRepo(".github/workflows/pwa-admin-canary-release.yml"),
    readRepo(".github/workflows/pwa-admin-public-release.yml"),
    readRepo(".github/workflows/pwa-preview-deploy.yml"),
  ]);

  assert.match(canaryMigration, /admin_request_app_release_canary_deploy/);
  assert.match(canaryMigration, /aal2 required for production canary deploy/);
  assert.match(canaryMigration, /candidate build does not match approved preview sha/);
  assert.match(canaryMigration, /service_finalize_app_release_canary_deployment/);
  assert.match(canaryMigration, /admin_confirm_app_release_canary/);
  assert.match(canaryMigration, /d\.verified_at is not null/);
  assert.match(canaryMigration, /source_canary_deployment_id/);
  assert.match(canaryMigration, /verified production canary required before public deploy/);
  assert.match(canaryMigration, /public target sha must equal verified canary source sha/);
  assert.match(canaryMigration, /direct publish disabled/);

  assert.match(edgeFunction, /AAS_GITHUB_RELEASE_TOKEN/);
  assert.match(edgeFunction, /CANARY_WORKFLOW/);
  assert.match(edgeFunction, /PUBLIC_WORKFLOW/);
  assert.match(edgeFunction, /admin_request_app_release_canary_deploy/);
  assert.match(edgeFunction, /admin_request_app_release_deploy/);
  assert.match(edgeFunction, /service_finalize_app_release_canary_deployment/);
  assert.match(edgeFunction, /service_finalize_app_release_deployment/);
  assert.match(edgeFunction, /canary_run_id/);
  assert.doesNotMatch(edgeFunction, /AAS_GITHUB_RELEASE_TOKEN\s*=\s*["']/);

  assert.match(client, /requestCanaryPwaDeployment/);
  assert.match(client, /confirmCanaryDeployment/);
  assert.match(client, /requestPublicPwaDeployment/);
  assert.match(client, /AAS_CANARY_PWA_URL/);

  assert.match(page, /第2段階：Production Canaryへ反映/);
  assert.match(page, /第3段階：Canary確認済みにする/);
  assert.match(page, /第4段階：全一般ユーザーへ公開/);
  assert.match(page, /candidateCanaryDeployment\.source_sha/);
  assert.match(page, /再ビルドは行わず/);

  assert.match(canaryWorkflow, /Checkout exact approved Preview SHA/);
  assert.match(canaryWorkflow, /Build and regression tests once for Canary and Public/);
  assert.match(canaryWorkflow, /Upload exact Canary-tested release bundle/);
  assert.match(canaryWorkflow, /release-bundle\.tgz\.sha256/);

  assert.match(publicWorkflow, /canary_run_id/);
  assert.match(publicWorkflow, /Download exact Canary-tested release bundle/);
  assert.match(publicWorkflow, /Verify and extract exact Canary artifact/);
  assert.match(publicWorkflow, /Deploy exact Canary-tested artifact to general-public Worker/);
  assert.doesNotMatch(publicWorkflow, /git push origin/);
  assert.doesNotMatch(publicWorkflow, /npm test|npm run build|vinext build/);

  assert.doesNotMatch(previewWorkflow, /\n\s*- preview\/current\s*\n/);
  assert.match(previewWorkflow, /Automatic Preview deploy is restricted to main/);
  assert.match(previewWorkflow, /workflow_dispatch:/);
});

