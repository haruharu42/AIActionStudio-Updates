import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(root, "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const readArticleStepSource = async () => (await Promise.all([
  "components/article-create/article-create-steps.tsx",
  "components/article-create/article-create-generation-steps.tsx",
  "components/article-create/article-create-finish-steps.tsx",
  "components/article-create/article-create-step-shared.tsx",
].map((relative) => read(relative)))).join("\n");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

const migrationPath = "supabase/migrations/20260910112000_phase9_pwa_invites_admin.sql";

test("Phase 9 migration keeps invite codes behind authenticated RPC boundaries", async () => {
  const sql = await readRepo(migrationPath);
  assert.match(sql, /create table public\.pwa_invites/);
  assert.match(sql, /create table public\.pwa_invite_redemptions/);
  assert.match(sql, /create or replace function public\.redeem_pwa_invite/);
  assert.match(sql, /create or replace function public\.admin_create_pwa_invite/);
  assert.match(sql, /create or replace function public\.admin_list_pwa_invites/);
  assert.match(sql, /create or replace function public\.admin_revoke_pwa_invite/);
  assert.match(sql, /create or replace function public\.admin_list_user_entitlements/);
  assert.match(sql, /security definer/g);
  assert.match(sql, /set search_path = ''/g);
  assert.match(sql, /revoke all on table public\.pwa_invites from public, anon, authenticated/);
  assert.match(sql, /revoke all on table public\.pwa_invite_redemptions from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.redeem_pwa_invite\(text\)\s*to authenticated/);
  assert.match(sql, /product\.product_code = 'AAS-PWA-BETA'/);
  assert.match(sql, /current_role <> 'user'/);
  assert.match(sql, /current_status not in \('pending', 'active'\)/);
  assert.match(sql, /selected_invite\.entitlement_expires_at <= now\(\)/);
  assert.doesNotMatch(sql, /service[_-]?role/i);
});

test("Phase 9 invite route redeems entitlement without requiring existing PWA access", async () => {
  const api = await read("lib/phase9-invite.ts");
  const page = await read("components/phase9-invite-page.tsx");
  const route = await read("app/invite/page.tsx");
  assert.match(api, /"redeem_pwa_invite"/);
  assert.match(api, /p_invite_code/);
  assert.match(page, /useSharedAccessState\(\)/);
  assert.match(page, /profile\.status !== "pending" && profile\.status !== "active"/);
  assert.match(page, /redeemPwaInvite/);
  assert.doesNotMatch(page, /auth\.getUser\(\)|\.from\("profiles"\)|can_access_product/);
  assert.doesNotMatch(page, /アカウントを確認しています/);
  assert.match(route, /Phase9InvitePage/);
});

test("Phase 10 admin route uses the current PWA-only account entitlement and access-code modules", async () => {
  const api = await read("lib/pwa-admin-users.ts");
  const page = await read("components/pwa-admin-users-page.tsx");
  const userPanels = await read("components/admin-users/admin-user-panels.tsx");
  const accessCodes = await read("components/admin-users/admin-access-code-panel.tsx");
  const route = await read("app/admin/users/page.tsx");
  const adminLayout = await read("app/admin/layout.tsx");

  for (const rpc of [
    "admin_list_users",
    "admin_set_user_status",
    "admin_list_user_entitlements",
    "admin_grant_entitlement",
    "admin_revoke_entitlement",
    "admin_create_pwa_invite",
    "admin_list_pwa_invites",
    "admin_revoke_pwa_invite",
    "admin_list_pwa_invite_redemptions",
  ]) {
    assert.match(api, new RegExp(`\\"${rpc}\\"`));
  }

  assert.match(api, /export const PWA_PRODUCT = "AAS-PWA-BETA" as const/);
  assert.doesNotMatch(api, /AAS-WIN-BETA/);
  assert.match(page, /PWAユーザー利用管理/);
  assert.match(page, /AdminUserSelectionPanel/);
  assert.match(page, /AdminSelectedUserPanel/);
  assert.match(page, /AdminAccessCodePanel/);
  assert.match(userPanels, /PWA利用権/);
  assert.match(accessCodes, /販売用PWA利用コード/);
  assert.match(route, /PwaAdminUsersPage as Phase10AdminPage/);
  assert.match(adminLayout, /AdminRouteGuard/);
  assert.doesNotMatch(`${api}\n${page}\n${userPanels}\n${accessCodes}`, /sb_secret_|service[_-]?role/i);
});

test("Phase 11 article creator separates access, controller, draft logic and step UI", async () => {
  const api = await read("lib/phase11-create.ts");
  const page = await read("components/phase11-create-page.tsx");
  const stepUi = await readArticleStepSource();
  const draftHelpers = await read("lib/article-create-draft.ts");
  const accessControl = await read("lib/access-control.ts");
  const progress = await read("lib/phase11-wizard-progress.ts");
  const route = await read("app/create/page.tsx");
  const options = await read("lib/phase18-content-options.ts");

  assert.match(api, /"create_article_with_workspace"/);
  assert.match(api, /"can_access_product"/);
  assert.match(api, /PWA_PRODUCT_CODE/);
  assert.match(api, /request_json/);
  assert.match(api, /workspace_json/);
  assert.match(api, /image_plan_json/);
  assert.match(api, /source_body/);
  assert.match(api, /publish_body/);
  assert.match(api, /wizard_version: 11/);
  assert.match(api, /article_quota_exceeded/);
  assert.match(api, /ユーザーが入力していない実体験・実績・レビュー/);
  assert.match(api, /競合記事の文章をコピー・近似模倣しない/);
  assert.match(api, /Markdown見出し/);
  assert.match(api, /H1（#）は使わない/);
  assert.match(api, /\*\*太字\*\*/);
  assert.match(api, /完成記事の本文だけを返す/);
  assert.match(api, /stripLeadingArticleTitle/);
  assert.match(api, /publicationBodyForCopy/);
  assert.match(api, /publicationEditorLink/);
  assert.match(api, /https:\/\/note\.com\/new/);
  assert.match(api, /https:\/\/tips\.jp\//);
  assert.match(api, /https:\/\/brain-market\.com\//);
  assert.match(api, /<!-- IMAGE:01 -->/);
  assert.match(api, /<!-- PAID_AREA -->/);
  assert.match(api, /【ここから有料エリア】/);
  assert.match(api, /【挿絵\$\{Number\(order\)\}をここに挿入】/);
  assert.match(api, /image_style/);
  assert.doesNotMatch(api, /service[_-]?role|sb_secret_/i);

  for (const label of ["使用AI選択", "記事の種類", "画像設定", "記事条件", "タイトル", "本文", "内容確認", "保存・タグ"]) {
    assert.match(draftHelpers, new RegExp(label));
  }
  assert.match(page, /createArticleFromWizard/);
  assert.match(page, /ARTICLE_CREATE_STEPS/);
  assert.match(page, /AiSelectionStep/);
  assert.match(page, /GenerationMethodStep/);
  assert.match(page, /ArticleConditionsStep/);
  assert.match(page, /TitleStep/);
  assert.match(page, /BodyStep/);
  assert.match(page, /PreviewStep/);
  assert.match(page, /SaveStep/);
  assert.match(page, /ARTICLE_CREATE_STEPS\.map/);
  assert.doesNotMatch(page, /ARTICLE_CREATE_UI_STEPS/);
  assert.match(page, /投稿アカウントプリセット/);
  assert.doesNotMatch(page, /ArticlePresetPanel|applyWorkspacePresetToArticleDraft/);
  assert.doesNotMatch(page, /GENRE_OPTIONS|AGE_GROUP_OPTIONS|GENDER_OPTIONS|TARGET_LENGTH_OPTIONS|launchAiApp/);

  assert.match(stepUi, /GENRE_OPTIONS/);
  assert.match(stepUi, /subgenreOptionsFor/);
  assert.match(stepUi, /AGE_GROUP_OPTIONS/);
  assert.match(stepUi, /GENDER_OPTIONS/);
  assert.match(stepUi, /TARGET_LENGTH_OPTIONS/);
  assert.match(stepUi, /launchAiApp/);
  assert.match(stepUi, /key: "chatgpt", label: "ChatGPT"/);
  assert.match(stepUi, /key: "claude", label: "Claude"/);
  assert.match(stepUi, /key: "gemini", label: "Gemini"/);
  assert.match(stepUi, /CopyAndOpenAiButton/);
  assert.match(stepUi, /launchAiApp\(appKey\)/);
  assert.match(api, /記事タイトル候補を5個作成してください/);
  assert.match(api, /parseTitleCandidates/);
  assert.match(api, /必ず5個だけ/);
  assert.match(stepUi, /タイトルを5候補から選んでください/);
  assert.match(stepUi, /AIが生成した5候補をまとめて貼り付け/);
  assert.match(stepUi, /parseTitleCandidates/);
  assert.match(stepUi, /AIで生成したタイトルをここへ貼り付け/);
  assert.match(stepUi, /AI用タイトルプロンプト/);
  assert.doesNotMatch(stepUi, />記事テーマ</);
  assert.match(stepUi, /タグ（任意・投稿前に設定）/);
  assert.match(stepUi, /サブジャンル/);
  assert.match(stepUi, /対象年齢/);
  assert.match(stepUi, /対象性別/);
  assert.match(stepUi, /文字数の目安/);
  assert.match(stepUi, /IMAGE_STYLE_OPTIONS/);
  assert.match(stepUi, /画像の画風/);
  assert.match(stepUi, /アニメ風・漫画風・イラスト風/);
  assert.match(stepUi, /クリップボードから5候補を貼り付け/);
  assert.match(stepUi, /クリップボードから本文を貼り付け/);
  assert.match(stepUi, /コピーしました ✓/);
  assert.match(stepUi, /カーソル位置に有料エリアを追加/);
  assert.match(stepUi, /挿絵の差し込み位置がそろっています/);
  assert.match(options, /IMAGE_STYLE_OPTIONS/);
  assert.match(options, /value: "anime"/);
  assert.match(options, /value: "manga"/);
  assert.match(options, /value: "illustration"/);
  assert.match(options, /value: "watercolor"/);
  assert.match(options, /value: "photo"/);
  assert.match(options, /PAID_ARTICLE_PRICE_OPTIONS/);
  assert.match(options, /value: 980/);
  assert.match(options, /value: 1480/);
  assert.match(options, /value: 1980/);
  assert.match(options, /value: 2480/);
  assert.match(options, /value: 3480/);
  assert.match(options, /value: 4980/);
  assert.match(options, /value: 49800/);
  assert.match(stepUi, /自由入力/);
  assert.match(stepUi, /AASの入力用プリセット/);
  assert.match(page, /price: value === "free" \? null : current\.price !== null && current\.price > 0 \? current\.price : 980/);
  assert.doesNotMatch(stepUi, />タイトル候補を生成<|>タイトル候補を作り直す</);
  assert.doesNotMatch(page, /generateTitleCandidates|titleQuotaInFlightRef|titlePromptAuthorized|suggestLocalTitles/);
  assert.doesNotMatch(stepUi, /OPENAI_LINKS\.chatgpt/);

  assert.match(draftHelpers, /DEFAULT_ARTICLE_DRAFT/);
  assert.match(draftHelpers, /initialDraftFromLocation/);
  assert.match(draftHelpers, /home-quick-setup/);
  assert.match(draftHelpers, /parseArticleTags/);
  assert.match(draftHelpers, /validateArticleCreateStep/);
  assert.match(draftHelpers, /parseStoredArticleDraft/);

  assert.match(page, /useSharedAccessState/);
  assert.doesNotMatch(page, /loadCoreAccessState/);
  assert.match(page, /loadWritingProfile/);
  assert.match(page, /saveWritingProfile/);
  assert.match(page, /setRuntimeWritingProfile/);
  assert.match(page, /AiSelectionStep/);
  assert.match(stepUi, /STEP 1 · 使用AI選択/);
  assert.match(stepUi, /STEP 2 · 種類の選択/);
  assert.doesNotMatch(page, /\.from\("profiles"\)|can_access_product/);
  assert.match(accessControl, /\.from\("profiles"\)/);
  assert.match(accessControl, /"can_access_product"/);
  assert.match(accessControl, /PWA_PRODUCT_CODE/);

  assert.match(page, /loadArticleWizardProgress/);
  assert.match(page, /saveArticleWizardProgress/);
  assert.match(page, /clearArticleWizardProgress/);
  assert.match(page, /persistWizardProgress/);
  assert.match(page, /pagehide/);
  assert.match(page, /beforeunload/);
  assert.match(page, /visibilitychange/);
  assert.match(page, /document\.visibilityState === "hidden"/);
  assert.match(page, /onBeforeExternalLaunch=\{persistWizardProgress\}/);
  assert.match(page, /titleCandidatesText/);
  assert.match(page, /buildImagePromptPlan/);
  assert.match(page, /buildCombinedImagePrompt/);
  assert.match(page, /combinedImagePrompt/);
  assert.match(stepUi, /onBeforeExternalLaunch/);
  assert.match(stepUi, /画像生成プロンプト（一括・個別）/);
  assert.match(stepUi, /画像プロンプトをコピー/);
  assert.match(stepUi, /生成した本文だけをここへ貼り付け/);
  assert.match(stepUi, /stripLeadingArticleTitle/);
  assert.match(stepUi, /個別に画像を作成/);
  assert.match(stepUi, /まとめて画像プロンプトをコピー/);
  assert.match(stepUi, /画像生成では一時チャットは使用不可/);
  assert.match(stepUi, /完成本文を装飾付きコピー/);
  assert.match(stepUi, /装飾付きでコピーしました ✓/);
  assert.match(stepUi, /有料記事を仕上げる/);
  assert.match(stepUi, /【ここから有料エリア】/);
  assert.match(stepUi, /Tipsの有料エリア境界/);
  assert.match(stepUi, /Brain側の現在の販売・公開設定/);
  assert.match(stepUi, /実際に設定できる価格帯・手数料・販売条件/);
  assert.match(stepUi, /【挿絵1をここに挿入】/);
  assert.match(stepUi, /copyNoteRichText/);
  assert.match(stepUi, /投稿先を開く/);
  assert.match(stepUi, /imagePrompts/);
  assert.match(stepUi, /onBeforeExternalLaunch\(\); launchAiApp\(app\.key\)/);
  assert.match(page, /setStep\(saved\.step\)/);
  assert.match(page, /前回の作業内容を復元しました/);
  assert.match(progress, /aas:pwa:article-wizard-progress:v1:/);
  assert.match(progress, /window\.localStorage/);
  assert.match(progress, /STORAGE_VERSION = 2/);
  assert.match(progress, /parsed\.version === 1[\s\S]*?\+ 1/);
  assert.match(progress, /updatedAt/);
  assert.match(progress, /titleCandidatesText/);
  assert.match(progress, /parseStoredArticleDraft/);
  assert.doesNotMatch(progress, /as unknown as ArticleCreationDraft/);
  assert.doesNotMatch(progress, /service[_-]?role|sb_secret_/i);
  assert.match(options, /AI副業/);
  assert.match(options, /生活・暮らし/);
  assert.match(route, /Phase11CreatePage/);
  assert.doesNotMatch(route, /CreateAiSetup/);
});

test("root uses the approved beginner dashboard across mobile and desktop", async () => {
  const rootPage = await read("app/page.tsx");
  const beginnerHome = await read("components/phase18-beginner-home.tsx");
  const referenceShell = await read("components/aas-reference-shell.tsx");
  const mobilePrefs = await read("lib/mobile-nav-preference.ts");
  const layout = await read("app/layout.tsx");
  const css = await read("app/phase18-beginner.css");
  const dashboardCss = await read("app/phase19-dashboard.css");
  const deviceCss = await read("app/phase20-device-e2e.css");

  assert.match(rootPage, /Phase18BeginnerHome/);
  assert.doesNotMatch(rootPage, /Phase9To11QuickNav/);
  assert.match(beginnerHome, /Phase7App/);
  assert.match(beginnerHome, /記事作成/);
  assert.match(beginnerHome, /記事ライブラリ/);
  assert.match(beginnerHome, /画像作成/);
  assert.match(beginnerHome, /SNS投稿/);
  assert.match(beginnerHome, /AI_APP_LINKS/);
  assert.match(beginnerHome, /quickCreateHref/);
  assert.match(beginnerHome, /listCloudArticles/);
  assert.match(beginnerHome, /href="\/sns"/);
  assert.match(beginnerHome, /href="\/images"/);
  assert.match(referenceShell, /SharedMobileBottomNav/);
  assert.match(mobilePrefs, /ランキング/);
  assert.match(mobilePrefs, /プロフィール/);
  assert.match(layout, /phase18-beginner\.css/);
  assert.match(layout, /phase19-dashboard\.css/);
  assert.match(layout, /phase20-device-e2e\.css/);
  assert.match(layout, /openai-links\.css/);
  assert.match(layout, /"aas-phase": "56"/);
  assert.match(layout, /"aas-release-stage": process\.env\.NEXT_PUBLIC_AAS_RELEASE_AUDIENCE \?\? "development"/);
  assert.doesNotMatch(layout, /phase8-local/);
  assert.match(css, /\.beginner-shell/);
  assert.match(css, /\.beginner-bottom-nav/);
  assert.match(dashboardCss, /\.beginner-dashboard-frame/);
  assert.match(dashboardCss, /grid-template-columns: 210px minmax\(0, 1fr\) 300px/);
  assert.match(dashboardCss, /repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(deviceCss, /\.beginner-library-main \.library-page/);
  assert.match(deviceCss, /background: #f7faff/);
  assert.match(deviceCss, /\.beginner-creator-page \.wizard-steps/);
  assert.match(deviceCss, /repeat\(7, minmax\(0, 1fr\)\)/);
});

test("package runs the Phase 9-11 contract test without changing dependency versions", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  assert.match(packageJson.scripts.test, /node --test --test-concurrency=1/);
  assert.equal(packageJson.dependencies.next, "16.3.4");
  assert.equal(packageJson.dependencies.react, "19.2.8");
  assert.equal(packageJson.devDependencies.vinext, "1.0.0-beta.9");
});
