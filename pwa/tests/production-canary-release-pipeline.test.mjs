import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("shared public artifact detects the stable Production Canary hostname at runtime", async () => {
  const release = await readRepo("pwa/lib/app-release.ts");

  assert.match(release, /AAS_PRODUCTION_CANARY_HOSTNAME/);
  assert.match(release, /ai-article-studio-pwa-canary\.ai-article-studio\.workers\.dev/);
  assert.match(release, /window\.location\.hostname === AAS_PRODUCTION_CANARY_HOSTNAME/);
  assert.match(release, /appDeploymentTier\(\) === "public" \? "public" : "preview"/);
});

test("Preview and Production Canary tester consent are stored separately", async () => {
  const gate = await readRepo("pwa/components/release-audience-gate.tsx");

  assert.match(gate, /"aas\.tester-" \+ deploymentTier \+ "\.accepted\."/);
  assert.match(gate, /PRODUCTION CANARY/);
  assert.match(gate, /Production Canary版を適用しますか？/);
  assert.match(gate, /Canary版を適用/);
  assert.match(gate, /公開環境と同じProduction設定/);
  assert.match(gate, /audience === null/);
});

test("public tester handoff and tester update notifications point to Production Canary", async () => {
  const [manager, notifications] = await Promise.all([
    readRepo("pwa/components/release-update-manager.tsx"),
    readRepo("pwa/components/notifications-page.tsx"),
  ]);

  assert.match(manager, /AAS_CANARY_PWA_URL/);
  assert.match(manager, /Production Canaryで最新候補版を確認できます/);
  assert.match(manager, /window\.location\.href = AAS_CANARY_PWA_URL/);
  assert.doesNotMatch(manager, /PREVIEW_PWA_URL/);

  assert.match(notifications, /AAS_CANARY_PWA_URL/);
  assert.match(notifications, /notification\.audience === "tester"/);
  assert.match(notifications, /\? AAS_CANARY_PWA_URL/);
  assert.doesNotMatch(notifications, /PREVIEW_PWA_URL/);
});

test("release database requires a successful verified Canary before public deployment", async () => {
  const migration = await readRepo("supabase/migrations/20261001103000_production_canary_release_pipeline.sql");

  assert.match(migration, /deployment_kind text not null default 'public'/);
  assert.match(migration, /deployment_kind in \('canary','public'\)/);
  assert.match(migration, /admin_request_app_release_canary_deploy/);
  assert.match(migration, /service_finalize_app_release_canary_deployment/);
  assert.match(migration, /admin_confirm_app_release_canary/);
  assert.match(migration, /d\.deployment_kind = 'canary'/);
  assert.match(migration, /d\.verified_at is not null/);
  assert.match(migration, /source_canary_deployment_id/);
  assert.match(migration, /verified production canary required before public deploy/);
  assert.match(migration, /direct publish disabled; use verified production canary deployment pipeline/);
  assert.match(migration, /to service_role/);
  assert.match(migration, /to authenticated/);
});

test("Canary workflow builds once and stores the exact release bundle", async () => {
  const workflow = await readRepo(".github/workflows/pwa-admin-canary-release.yml");

  assert.match(workflow, /NEXT_PUBLIC_AAS_RELEASE_AUDIENCE: public/);
  assert.match(workflow, /AAS_CLOUDFLARE_WORKER_NAME: ai-article-studio-pwa/);
  assert.match(workflow, /Build and regression tests once for Canary and Public/);
  assert.match(workflow, /ai-article-studio-pwa-canary/);
  assert.match(workflow, /release-bundle\.tgz/);
  assert.match(workflow, /sha256sum -c release-bundle\.tgz\.sha256/);
  assert.match(workflow, /actions\/upload-artifact@/);
  assert.match(workflow, /aas-release-bundle-/);
});

test("public workflow promotes the Canary artifact without rebuilding", async () => {
  const workflow = await readRepo(".github/workflows/pwa-admin-public-release.yml");

  assert.match(workflow, /canary_run_id/);
  assert.match(workflow, /actions\/download-artifact@/);
  assert.match(workflow, /aas-release-bundle-/);
  assert.match(workflow, /sha256sum -c release-bundle\.tgz\.sha256/);
  assert.match(workflow, /Deploy exact Canary-tested artifact to general-public Worker/);
  assert.doesNotMatch(workflow, /npm test/);
  assert.doesNotMatch(workflow, /npm run build/);
  assert.doesNotMatch(workflow, /vinext build/);
  assert.doesNotMatch(workflow, /Fast-forward main/);
});

test("release deploy Edge Function dispatches and finalizes Canary and Public separately", async () => {
  const worker = await readRepo("supabase/functions/pwa-release-deploy/index.ts");

  assert.match(worker, /CANARY_WORKFLOW = "pwa-admin-canary-release\.yml"/);
  assert.match(worker, /PUBLIC_WORKFLOW = "pwa-admin-public-release\.yml"/);
  assert.match(worker, /action === "start_canary"/);
  assert.match(worker, /admin_request_app_release_canary_deploy/);
  assert.match(worker, /service_finalize_app_release_canary_deployment/);
  assert.match(worker, /canary_run_id/);
  assert.match(worker, /p_target_sha: sourceSha/);
  assert.doesNotMatch(worker, /public_tree_does_not_match_approved_preview/);
});

test("admin release UI exposes four guarded release stages", async () => {
  const page = await readRepo("pwa/components/admin-release-page.tsx");

  assert.match(page, /①Preview管理者確認/);
  assert.match(page, /②Production Canaryへ反映/);
  assert.match(page, /③公開テスター確認済み/);
  assert.match(page, /④全一般ユーザーへ公開/);
  assert.match(page, /requestCanaryPwaDeployment/);
  assert.match(page, /confirmCanaryDeployment/);
  assert.match(page, /requestPublicPwaDeployment/);
  assert.match(page, /Production Canary確認チェック/);
  assert.match(page, /同一artifact/);
  assert.doesNotMatch(page, /adminPromoteAppReleaseToTesters/);
});
