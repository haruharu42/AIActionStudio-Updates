import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("side-hustle prompt library is modular, searchable, copy-first, and uses external AI handoff", async () => {
  const [
    catalog,
    page,
    editor,
    toolbar,
    list,
    preferences,
    routing,
    featureBoundary,
    route,
    nav,
    layout,
  ] = await Promise.all([
    read("lib/action-prompt-catalog.ts"),
    read("components/action-prompt-library-page.tsx"),
    read("components/action-prompt-library/action-prompt-editor.tsx"),
    read("components/action-prompt-library/action-prompt-toolbar.tsx"),
    read("components/action-prompt-library/action-prompt-template-list.tsx"),
    read("lib/action-prompt-preferences.ts"),
    read("lib/action-prompt-routing.ts"),
    read("features/prompts/index.ts"),
    read("app/prompts/page.tsx"),
    read("lib/mobile-nav-preference.ts"),
    read("app/layout.tsx"),
  ]);

  for (const category of [
    "記事・コンテンツ",
    "SNS",
    "動画・YouTube",
    "画像・デザイン",
    "漫画・コミック",
    "アダアフィ",
    "アフィリエイト",
    "物販・販売",
    "クラウドソーシング",
    "スキル販売",
    "デジタル商品",
    "顧客対応・営業",
    "リサーチ",
    "業務効率化",
  ]) {
    assert.match(catalog, new RegExp(category));
  }

  assert.match(catalog, /入力されていない実績/);
  assert.match(page, /汎用プロンプトライブラリ/);
  assert.match(page, /専用ウィザード/);
  assert.match(page, /navigator\.clipboard\.writeText/);
  assert.match(page, /launchAiApp/);
  assert.match(page, /loadActionPromptCatalog/);
  assert.match(page, /mergeTemplates/);
  assert.match(page, /readActionPromptRouteSelection/);
  assert.match(page, /resolveActionPromptRouteTemplate/);
  assert.match(editor, /使用AI/);
  assert.match(editor, /recommendedActionPromptAi/);
  assert.match(editor, /入力をリセット/);
  assert.match(editor, /選択したAIも入力途中の内容と一緒に保存/);
  assert.match(toolbar, /お気に入り/);
  assert.match(list, /推奨/);
  assert.match(preferences, /aas-action-prompt-progress/);
  assert.match(preferences, /selectedAi/);
  assert.match(routing, /URLSearchParams/);
  assert.match(routing, /category/);
  assert.match(routing, /template/);
  assert.match(featureBoundary, /action-prompt-catalog/);
  assert.match(featureBoundary, /action-prompt-preferences/);
  assert.match(featureBoundary, /action-prompt-routing/);
  assert.match(featureBoundary, /action-prompt-service/);
  assert.match(page, /最近使った/);
  assert.match(route, /Phase15MemberGate/);
  assert.match(nav, /key: "prompts"/);
  assert.match(layout, /phase49-prompt-library\.css/);

  assert.doesNotMatch(
    [catalog, page, editor, toolbar, list, preferences, routing].join("\n"),
    /sb_secret_|service[_-]?role|sk_(?:live|test)_|whsec_/i,
  );
});

test("prompt library follows filtered selection and keeps desktop prompt panes independently scrollable", async () => {
  const [page, styles] = await Promise.all([
    read("components/action-prompt-library-page.tsx"),
    read("app/phase49-prompt-library.css"),
  ]);

  assert.match(page, /function filterActionPromptTemplates/);
  assert.match(page, /const changeCategory = \(nextCategory: string\)/);
  assert.match(page, /const changeQuery = \(nextQuery: string\)/);
  assert.match(page, /const toggleFavoritesOnly = \(\)/);
  assert.match(page, /keepSelectionInFilter/);
  assert.match(styles, /@media \(min-width: 900px\)/);
  assert.match(styles, /max-height: calc\(100dvh - 40px\)/);
  assert.match(styles, /scrollbar-gutter: stable/);
  assert.match(styles, /max-height: min\(52dvh, 520px\)/);
  assert.match(styles, /overscroll-behavior: contain/);
});

test("prompt library opens a selected card as a dedicated prompt view with a top switcher", async () => {
  const [page, styles] = await Promise.all([
    read("components/action-prompt-library-page.tsx"),
    read("app/phase49-prompt-library.css"),
  ]);

  assert.match(page, /viewMode, setViewMode/);
  assert.match(page, /viewMode === "library"/);
  assert.match(page, /プロンプトを切り替える/);
  assert.match(page, /switchPrompt\(event\.target\.value\)/);
  assert.match(page, /一覧から選び直す/);
  assert.match(page, /if \(openPrompt\) setViewMode\("prompt"\)/);
  assert.match(styles, /\.action-prompt-switcher/);
  assert.match(styles, /\.action-prompt-library-view \.action-prompt-list/);
  assert.match(styles, /\.action-prompt-detail \.action-prompt-editor/);
});

test("prompt library includes reusable manga and four-panel comic templates", async () => {
  const catalog = await read("lib/action-prompt-catalog.ts");

  for (const id of [
    "comic-4koma-creator",
    "comic-name-creator",
    "comic-one-page-creator",
    "comic-dialogue-creator",
  ]) {
    assert.match(catalog, new RegExp(`id: "${id}"`));
  }

  assert.match(catalog, /category: "漫画・コミック"/);
  assert.match(catalog, /四コマ漫画作成/);
  assert.match(catalog, /漫画ネーム作成/);
  assert.match(catalog, /1ページ漫画作成/);
  assert.match(catalog, /漫画セリフ作成/);
  assert.match(catalog, /キャラクターの見た目を全コマで統一/);
  assert.match(catalog, /既存作品・実在作家・既存キャラクター/);
});

test("every prompt receives shared accuracy rules plus category-specific reinforcement", async () => {
  const [catalog, guidance] = await Promise.all([
    read("lib/action-prompt-catalog.ts"),
    read("lib/action-prompt-category-guidance.ts"),
  ]);

  assert.match(catalog, /ACTION_PROMPT_ACCURACY_LAYER/);
  assert.match(catalog, /actionPromptCategoryGuidance/);
  assert.match(catalog, /未指定.*未知として扱い/);
  assert.match(catalog, /事実、推測、提案、例を混同しない/);
  assert.match(catalog, /完成前チェック/);
  assert.match(catalog, /内部の思考過程は出力せず/);
  assert.match(guidance, /CATEGORY_PROMPT_PROFILES/);
  assert.match(guidance, /DEFAULT_CATEGORY_PROMPT_PROFILE/);

  for (const category of [
    "記事・コンテンツ",
    "SNS",
    "動画・YouTube",
    "画像・デザイン",
    "漫画・コミック",
    "アダアフィ",
    "アフィリエイト",
    "物販・販売",
    "クラウドソーシング",
    "スキル販売",
    "デジタル商品",
    "顧客対応・営業",
    "リサーチ",
    "業務効率化",
  ]) {
    assert.match(guidance, new RegExp(`"${category}":`));
  }

  assert.match(guidance, /一次情報、公式資料、原典/);
  assert.match(guidance, /キャラクターは外見、衣装、配色/);
  assert.match(guidance, /タイトル、サムネイル\/カバー、冒頭、本文/);
  assert.match(guidance, /購入前に必要な素材、対象外、修正範囲/);
});

test("all 14 prompt categories use full dedicated prompt profiles", async () => {
  const [catalog, guidance] = await Promise.all([
    read("lib/action-prompt-catalog.ts"),
    read("lib/action-prompt-category-guidance.ts"),
  ]);

  assert.match(catalog, /actionPromptCategoryGuidance/);
  assert.match(catalog, /category: template\.category, title: template\.title, sideHustle: template\.sideHustle/);
  assert.match(guidance, /CATEGORY_PROMPT_PROFILES/);
  assert.match(guidance, /【専門ロール】/);
  assert.match(guidance, /【入力の解釈】/);
  assert.match(guidance, /【必須の出力設計】/);
  assert.match(guidance, /【専門品質基準】/);
  assert.match(guidance, /【カテゴリ専用の最終検証】/);

  for (const category of [
    "記事・コンテンツ",
    "SNS",
    "動画・YouTube",
    "画像・デザイン",
    "漫画・コミック",
    "アダアフィ",
    "アフィリエイト",
    "物販・販売",
    "クラウドソーシング",
    "スキル販売",
    "デジタル商品",
    "顧客対応・営業",
    "リサーチ",
    "業務効率化",
  ]) {
    assert.match(guidance, new RegExp(`"${category}": \\\{`));
  }

  assert.match(guidance, /people-first/);
  assert.match(guidance, /最初の30秒/);
  assert.match(guidance, /Hook→Body→Close/);
  assert.match(guidance, /固定設定ブロック/);
  assert.match(guidance, /一次情報、公式資料、原典/);
  assert.match(guidance, /プロジェクト、コンペ、タスク/);
  assert.match(guidance, /購入前に必要な素材、対象外、修正範囲/);
});



test("all prompt templates receive researched category rules and template-specific guidance", async () => {
  const [catalog, research, dedicated] = await Promise.all([
    read("lib/action-prompt-catalog.ts"),
    read("lib/action-prompt-research-guidance.ts"),
    read("lib/action-prompt-template-guidance.ts"),
  ]);

  assert.match(catalog, /actionPromptResearchGuidance/);
  assert.match(catalog, /actionPromptTemplateGuidance/);
  assert.match(catalog, /id: template\.id/);

  for (const category of [
    "記事・コンテンツ",
    "SNS",
    "動画・YouTube",
    "画像・デザイン",
    "漫画・コミック",
    "アダアフィ",
    "アフィリエイト",
    "物販・販売",
    "クラウドソーシング",
    "スキル販売",
    "デジタル商品",
    "顧客対応・営業",
    "リサーチ",
    "業務効率化",
  ]) {
    assert.match(research, new RegExp('"' + category + '":'));
  }

  for (const id of [
    "note-article-plan",
    "paid-content-value",
    "x-post-series",
    "instagram-caption",
    "youtube-plan",
    "youtube-script",
    "image-prompt",
    "comic-4koma-creator",
    "comic-name-creator",
    "comic-one-page-creator",
    "comic-dialogue-creator",
    "affiliate-research",
    "product-listing",
    "crowdwork-proposal",
    "market-research",
    "work-efficiency",
    "blog-seo-brief",
    "threads-post-series",
    "short-video-script",
    "youtube-thumbnail-copy",
    "affiliate-comparison-outline",
    "flea-market-listing",
    "skill-market-service-page",
    "digital-product-outline",
    "client-outreach-message",
    "fact-check-research",
    "repeatable-sop",
  ]) {
    assert.match(dedicated, new RegExp('"' + id + '":'));
  }

  assert.match(research, /people-first/);
  assert.match(research, /Who \/ How \/ Why/);
  assert.match(research, /冒頭30秒/);
  assert.match(research, /Hook→Body→Close/);
  assert.match(research, /Creation \/ Engagement \/ Reach \/ Monetization \/ Guidelines/);
  assert.match(research, /プロジェクト形式.*コンペ形式.*タスク形式/);
  assert.match(research, /ココナラ等ではカテゴリ・提供内容/);
  assert.match(dedicated, /【テンプレート専用設計】/);
});


test("prompt library includes adult affiliate templates with compliance guardrails", async () => {
  const [catalog, category, research, dedicated] = await Promise.all([
    read("lib/action-prompt-catalog.ts"),
    read("lib/action-prompt-category-guidance.ts"),
    read("lib/action-prompt-research-guidance.ts"),
    read("lib/action-prompt-template-guidance.ts"),
  ]);

  const ids = [
    "adult-affiliate-offer-research",
    "adult-affiliate-seo-brief",
    "adult-affiliate-x-plan",
    "adult-affiliate-lp-flow",
    "adult-affiliate-compliance-check",
    "adult-affiliate-conversion-review",
    "adult-affiliate-content-calendar",
    "adult-affiliate-site-architecture",
  ];
  for (const id of ids) {
    assert.match(catalog, new RegExp('id": "' + id + '"|id: "' + id + '"'));
    assert.match(dedicated, new RegExp('"' + id + '":'));
  }

  assert.match(catalog, /"category": "アダアフィ"|category: "アダアフィ"/);
  assert.match(category, /"アダアフィ":/);
  assert.match(research, /"アダアフィ":/);
  assert.match(research, /適切な内容警告/);
  assert.match(research, /未成年をターゲットにできず/);
  assert.match(research, /広告であることが明瞭/);
  assert.match(catalog, /規約回避/);
  assert.match(catalog, /18歳以上/);
});

test("thin prompt categories are expanded into production-ready dedicated workflows", async () => {
  const [catalog, dedicated] = await Promise.all([
    read("lib/action-prompt-catalog.ts"),
    read("lib/action-prompt-template-guidance.ts"),
  ]);

  const ids = [
    "image-thumbnail-prompt",
    "image-character-consistency",
    "image-article-illustration-set",
    "crowdwork-requirements-analysis",
    "crowdwork-delivery-message",
    "skill-market-offer-design",
    "skill-market-faq",
    "digital-product-sales-page",
    "digital-product-update-plan",
    "client-discovery-questions",
    "client-proposal-structure",
    "customer-support-reply",
  ];

  for (const id of ids) {
    assert.match(catalog, new RegExp('id: "' + id + '"'));
    assert.match(dedicated, new RegExp('"' + id + '":'));
  }

  for (const phrase of [
    "安全余白",
    "一貫性チェックリスト",
    "挿入推奨位置",
    "応募可否を自分で判断",
    "購入前チェックリスト",
    "未確認で追記が必要",
    "改訂履歴",
    "初回ヒアリング",
    "見積前に未確定",
    "確認できていない責任",
  ]) {
    assert.match(catalog + "\n" + dedicated, new RegExp(phrase));
  }

  const categoryCount = (category) =>
    (catalog.match(new RegExp('(?:category: |"category": )"' + category + '"', "g")) ?? []).length;

  assert.ok(categoryCount("画像・デザイン") >= 4);
  assert.ok(categoryCount("クラウドソーシング") >= 3);
  assert.ok(categoryCount("スキル販売") >= 3);
  assert.ok(categoryCount("デジタル商品") >= 3);
  assert.ok(categoryCount("顧客対応・営業") >= 4);
});



test("prompt library keeps a separate in-progress draft for every template and restores it when switching back", async () => {
  const [page, preferences] = await Promise.all([
    read("components/action-prompt-library-page.tsx"),
    read("lib/action-prompt-preferences.ts"),
  ]);

  assert.match(preferences, /type StoredActionPromptDraft/);
  assert.match(preferences, /drafts\?: Record<string, StoredActionPromptDraft>/);
  assert.match(preferences, /function parseStoredDrafts/);
  assert.match(preferences, /const previous = readActionPromptProgress\(userId\)/);
  assert.match(preferences, /drafts\[progress\.selectedId\]/);
  assert.match(preferences, /JSON\.stringify\(\{ \.\.\.progress, drafts \}\)/);

  assert.match(page, /stored\?\.drafts\?\.\[template\.id\]\?\.values/);
  assert.match(page, /function selectedAiForTemplate/);
  assert.match(page, /stored\?\.drafts\?\.\[template\.id\]\?\.selectedAi/);
  assert.match(page, /if \(selected && userId\) \{[\s\S]*?writeActionPromptProgress/);
  assert.match(page, /const stored = readActionPromptProgress\(userId\)/);
  assert.match(page, /setValues\(valuesForTemplate\(template, stored\)\)/);
  assert.match(page, /setSelectedAi\(selectedAiForTemplate\(template, stored\)\)/);
});
