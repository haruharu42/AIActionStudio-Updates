import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("Phase 12 specializes article prompts through the shared knowledge compiler without weakening editorial safety", async () => {
  const profiles = await read("lib/phase12-prompt-profiles.ts");
  const knowledge = await read("lib/knowledge-engine.ts");
  const creator = await read("lib/phase11-create.ts");

  assert.match(profiles, /compileKnowledgeContext/);
  assert.match(profiles, /KnowledgeTask/);
  assert.match(profiles, /性別だけから価値観・職業・生活状況を決めつけない/);
  for (const label of ["AI副業", "美容", "ガジェット", "生活・暮らし", "SNS運用", "note", "Tips", "Brain"]) {
    assert.match(knowledge, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(knowledge, /収益額・成功率・案件獲得を保証しない/);
  assert.match(knowledge, /有料コンテンツでは/);
  assert.match(knowledge, /未確認の価格、統計、ランキング、レビュー、最新仕様、成果を事実として補完しない/);
  assert.match(creator, /getPromptSpecialization/);
  assert.match(creator, /prompt_profile_version: 12/);
});

test("Phase 13 builds cover and inline prompt plans and stores them in the article workspace", async () => {
  const imagePrompts = await read("lib/phase13-image-prompts.ts");
  const creator = await read("lib/phase11-create.ts");
  const page = await read("components/phase13-image-page.tsx");
  const route = await read("app/images/page.tsx");

  assert.match(imagePrompts, /日本の現代的な2Dアニメ調/);
  assert.match(imagePrompts, /既存作品・特定作家・実在人物/);
  assert.match(imagePrompts, /IMAGE:\$\{number\}/);
  assert.match(imagePrompts, /coverEnabled/);
  assert.match(imagePrompts, /inlineEnabled/);
  assert.match(imagePrompts, /imageStyle/);
  assert.match(imagePrompts, /imageStylePrompt/);
  assert.match(imagePrompts, /contextParagraphs/);
  assert.match(imagePrompts, /before\.slice\(-3\)/);
  assert.match(imagePrompts, /after\.slice\(0, 3\)/);
  assert.match(imagePrompts, /【全画像共通条件】/);
  assert.match(imagePrompts, /【画像ごとの指示】/);
  assert.match(imagePrompts, /input\?: ImagePromptPlanInput/);
  assert.match(creator, /buildImagePromptPlan/);
  assert.match(await read("components/phase11-create-page.tsx"), /buildCombinedImagePrompt\(imagePrompts, imagePromptInput\)/);
  assert.match(creator, /prompt_plan: imagePrompts/);
  assert.match(creator, /image_prompt_version: 13/);
  assert.match(page, /buildImagePromptPlan/);
  assert.match(page, /アイキャッチ/);
  assert.match(page, /挿絵/);
  assert.match(page, /IMAGE_STYLE_OPTIONS/);
  assert.match(page, /画像の画風/);
  assert.match(page, /useSharedAccessState/);
  assert.doesNotMatch(page, /auth\.getUser\(\)|\.from\("profiles"\)/);
  assert.match(route, /Phase13ImagePromptPage/);
});

test("Phase 14 converts owned article content into X, Instagram and Threads prompt workflows", async () => {
  const api = await read("lib/phase14-sns.ts");
  const page = await read("components/phase14-sns-page.tsx");
  const route = await read("app/sns/page.tsx");

  assert.match(api, /"x" \| "instagram" \| "threads"/);
  assert.match(api, /記事にない実体験・実績・レビュー・成果を追加しない/);
  assert.match(api, /article\.workspace\.publishBody \|\| article\.body/);
  assert.match(page, /listCloudArticles/);
  assert.match(page, /getCloudArticleDetail/);
  assert.match(page, /buildSocialPrompt/);
  assert.match(page, /useSharedAccessState/);
  assert.doesNotMatch(page, /auth\.getUser\(\)|\.from\("profiles"\)/);
  assert.match(route, /Phase14SnsPage/);
  assert.doesNotMatch(`${api}\n${page}`, /sb_secret_|service[_-]?role/i);
});

test("Phase 15 keeps legacy fit logic safe while the public route uses the dedicated dropdown planner", async () => {
  const api = await read("lib/phase15-sidejob.ts");
  const page = await read("components/phase15-sidejob-page.tsx");
  const route = await read("app/sidejob/page.tsx");

  assert.match(api, /note \/ Tips \/ Brain コンテンツ販売/);
  assert.match(api, /SNS運用代行・投稿作成/);
  assert.match(api, /YouTube \/ TikTok \/ 配信クリエイター/);
  assert.match(api, /収益額・成功率・フォロワー数などを保証しない/);
  assert.match(api, /\.sort\(\(a, b\) => b\.score - a\.score/);
  assert.match(page, /適合スコアはAAS内の比較用/);
  assert.match(route, /SideHustleWizardPage/);
  assert.match(route, /slug="sidejob-planner"/);
  assert.doesNotMatch(route, /Phase15SideJobPage/);
});

test("Phase 16 records publication state with optimistic revision and no external auto-post", async () => {
  const api = await read("lib/phase16-publish.ts");
  const page = await read("components/phase16-publish-page.tsx");
  const route = await read("app/publish/page.tsx");

  assert.match(api, /update_article_with_workspace/);
  assert.match(api, /p_expected_revision: detail\.revision/);
  assert.match(api, /published_url/);
  assert.match(api, /scheduled_at/);
  assert.match(api, /published_at/);
  assert.match(page, /外部サービスへの自動投稿/);
  assert.match(route, /Phase16PublishPage/);
  assert.doesNotMatch(`${api}\n${page}`, /fetch\(["']https?:\/\//i);
});

test("Phase 17 reports only internal article metrics until external analytics are connected", async () => {
  const api = await read("lib/phase17-analytics.ts");
  const page = await read("components/phase17-analytics-page.tsx");
  const route = await read("app/analytics/page.tsx");

  assert.match(api, /get_my_article_stock_summary/);
  assert.match(api, /listCloudArticles/);
  assert.match(api, /publishedRate/);
  assert.match(page, /閲覧数・売上・SNS反応など外部サービスの実績値/);
  assert.match(route, /Phase17AnalyticsPage/);
});

test("tools hub exposes grouped supporting routes while article creation keeps its own integrated tools", async () => {
  const tools = await read("components/phase-tools-page.tsx");
  const toolCatalog = await read("features/tools/tool-catalog.ts");
  const toolsRoute = await read("app/tools/page.tsx");
  const shell = await read("components/phase18-beginner-home.tsx");
  const referenceShell = await read("components/aas-reference-shell.tsx");
  const mobileNav = await read("components/shared-mobile-bottom-nav.tsx");
  const mobilePrefs = await read("lib/mobile-nav-preference.ts");
  const rootPage = await read("app/page.tsx");
  const layout = await read("app/layout.tsx");
  const css = await read("app/phase12-17.css");
  const beginnerCss = await read("app/phase18-beginner.css");
  const dashboardCss = await read("app/phase19-dashboard.css");

  for (const href of ["/workflow", "/note-operations", "/account-design", "/sns", "/sns-plan", "/side-hustles/sidejob-planner", "/publish", "/analytics", "/inquiries"]) {
    assert.match(toolCatalog, new RegExp(`href: \\"${href.replace("/", "\\/")}\\"`));
  }
  for (const duplicateHref of ["/create", "/images", "/export"]) {
    assert.doesNotMatch(toolCatalog, new RegExp(`href: \\"${duplicateHref.replace("/", "\\/")}\\"`));
  }
  for (const group of ["記事・コンテンツ", "SNS・動画・集客", "販売・収益化", "受託・案件獲得", "リサーチ・業務効率化", "運営・アカウント", "公開・分析", "サポート"]) {
    assert.match(toolCatalog, new RegExp(group));
  }
  assert.match(tools, /MEMBER_TOOL_GROUPS/);
  assert.match(tools, /useSharedAccessState\(\)/);
  assert.doesNotMatch(tools, /loadAccessState/);
  assert.doesNotMatch(tools, /getSupabaseClient\(\)/);
  assert.match(toolsRoute, /PhaseToolsPage/);
  assert.match(rootPage, /Phase18BeginnerHome/);
  assert.match(shell, /Phase7App/);
  assert.match(shell, /if \(state\.kind === "loading"\) return <BeginnerAccessFallback \/>;/);
  assert.match(shell, /if \(state\.kind === "unavailable"\) return <BeginnerAccessFallback unavailable \/>;/);
  assert.doesNotMatch(shell, /state\.kind !== "ready" \|\| !client\) return <Phase7App \/>/);
  assert.match(shell, /href="\/tools"/);
  assert.match(shell, /href="\/images"/);
  assert.match(shell, /href="\/sns"/);
  assert.match(mobileNav, /ホーム/);
  for (const label of ["作成", "ライブラリ", "ランキング", "プロフィール", "SNS"]) {
    assert.match(mobilePrefs, new RegExp(label));
  }
  assert.match(referenceShell, /href="\/settings"/);
  assert.match(referenceShell, /SharedMobileBottomNav/);
  assert.match(layout, /phase12-17\.css/);
  assert.match(layout, /phase18-beginner\.css/);
  assert.match(layout, /phase19-dashboard\.css/);
  assert.match(layout, /"aas-phase": "56"/);
  assert.match(layout, /"aas-release-stage": process\.env\.NEXT_PUBLIC_AAS_RELEASE_AUDIENCE \?\? "development"/);
  assert.doesNotMatch(layout, /phase8-local/);
  assert.match(css, /\.tool-grid/);
  assert.match(css, /\.analytics-grid/);
  assert.match(css, /\.image-prompt-list/);
  assert.match(beginnerCss, /\.beginner-bottom-nav/);
  assert.match(beginnerCss, /\.beginner-action-grid/);
  assert.match(dashboardCss, /\.beginner-mobile-nav/);
  assert.match(dashboardCss, /\.beginner-desktop-sidebar/);
});

test("service worker fetches current UI assets before cache fallback and purges older cache generations", async () => {
  const sw = await read("public/sw.js");

  assert.match(sw, /aas-pwa-phase56-runtime-v12-mirea-generated/);
  assert.match(sw, /FRESH_BRANDING_ASSETS\.has\(url\.pathname\)[\s\S]*networkFirst\(request\)/);
  assert.match(sw, /new Request\(request, \{ cache: "no-store" \}\)/);
  assert.match(sw, /keys\.filter\(\(key\) => key !== CACHE_NAME\)/);
  assert.match(sw, /if \(request\.mode === "navigate"\)[\s\S]*fetch\(freshRequest\(request\)\)/);
  assert.match(sw, /if \(url\.pathname\.startsWith\("\/_next\/static\/"\)\)[\s\S]*networkFirst\(request\)/);
  assert.match(sw, /async function networkFirst\(request\)[\s\S]*fetch\(freshRequest\(request\)\)[\s\S]*cache\.match\(request\)/);
  assert.match(sw, /url\.pathname\.startsWith\("\/auth\/callback"\)/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(sw, /url\.searchParams\.has\("access_token"\)/);
  assert.match(sw, /url\.searchParams\.has\("refresh_token"\)/);
  assert.doesNotMatch(sw.match(/const APP_SHELL = \[[\s\S]*?\];/)?.[0] ?? "", /["']\/["']/);
});

test("package includes the Phase 12-17 contract test and keeps dependency pins unchanged", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  assert.match(packageJson.scripts.test, /node --test --test-concurrency=1/);
  assert.equal(packageJson.dependencies.next, "16.3.8");
  assert.equal(packageJson.dependencies.react, "19.2.8");
  assert.equal(packageJson.dependencies["@supabase/supabase-js"], "2.112.3");
  assert.equal(packageJson.devDependencies.vinext, "1.0.0-beta.9");
  assert.equal(packageJson.overrides.sharp, "0.35.4");
});


test("Phase 14 restores user-scoped SNS composer work without consuming another generation", async () => {
  const [page, progress] = await Promise.all([
    read("components/phase14-sns-page.tsx"),
    read("lib/phase14-sns-progress.ts"),
  ]);

  assert.match(progress, /aas:pwa:sns-composer:v1/);
  assert.match(progress, /snsComposerStorageKey\(userId: string\)/);
  assert.match(progress, /window\.localStorage\.getItem/);
  assert.match(progress, /window\.localStorage\.setItem/);
  assert.match(progress, /generatedPrompt\.slice\(0, 120000\)/);
  assert.match(progress, /generatedFingerprint\.slice\(0, 4000\)/);
  assert.match(progress, /PLATFORMS\.includes/);
  assert.match(progress, /GOALS\.includes/);

  assert.match(page, /readSnsComposerProgress\(userId\)/);
  assert.match(page, /writeSnsComposerProgress\(userId/);
  assert.match(page, /getCloudArticleDetail\(client, userId, restored\.articleId\)/);
  assert.match(page, /progressOwnerRef\.current = userId/);
  assert.match(page, /setHydratedUserId\(userId\)/);
  assert.match(page, /hydratedUserId !== userId/);
  assert.match(page, /restoredProgressRef\.current = Boolean\(restored\)/);
  assert.match(page, /window\.addEventListener\("pagehide"/);
  assert.match(page, /window\.addEventListener\("beforeunload"/);
  assert.match(page, /document\.addEventListener\("visibilitychange"/);
  assert.match(page, /AppLoadingScreen message="SNS投稿作成を準備しています/);
  assert.match(page, /AppLoadingScreen message="SNS投稿作成の作業状態を復元しています/);
  assert.doesNotMatch(page, /accessState\.kind === "loading"\) return null/);
  assert.match(page, /再読み込みからの復元では追加消費しません/);
});


test("SNS launch planner restores account-scoped in-progress choices across reloads", async () => {
  const [page, progress] = await Promise.all([
    read("components/phase15-sns-plan-page.tsx"),
    read("lib/phase15-sns-plan-progress.ts"),
  ]);

  assert.match(progress, /aas:pwa:sns-launch-plan:v1/);
  assert.match(progress, /snsLaunchPlanStorageKey\(userId: string\)/);
  assert.match(progress, /window\.localStorage\.getItem/);
  assert.match(progress, /window\.localStorage\.setItem/);
  assert.match(progress, /Math\.max\(1, Math\.min\(21/);
  assert.match(progress, /niche: progress\.input\.niche\.slice\(0, 500\)/);

  assert.match(page, /useSharedAccessState\(\)/);
  assert.match(page, /<Phase15SnsPlanContent key=\{userId\} userId=\{userId\}/);
  assert.match(page, /readSnsLaunchPlanProgress\(userId\)/);
  assert.match(page, /writeSnsLaunchPlanProgress\(userId/);
  assert.match(page, /window\.addEventListener\("pagehide"/);
  assert.match(page, /window\.addEventListener\("beforeunload"/);
  assert.match(page, /document\.addEventListener\("visibilitychange"/);
  assert.match(page, /persistProgress\(\);[\s\S]*?navigator\.clipboard\.writeText/);
  assert.match(page, /AppLoadingScreen message="前回のSNSアカウント設計を確認しています/);
  assert.match(page, /AASアカウントごとに端末保存/);
});
