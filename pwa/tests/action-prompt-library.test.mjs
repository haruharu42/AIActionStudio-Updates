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
  const catalog = await read("lib/action-prompt-catalog.ts");

  assert.match(catalog, /ACTION_PROMPT_ACCURACY_LAYER/);
  assert.match(catalog, /CATEGORY_ACCURACY_GUIDANCE/);
  assert.match(catalog, /DEFAULT_CATEGORY_ACCURACY_GUIDANCE/);
  assert.match(catalog, /actionPromptAccuracyGuidance\(template\.category\)/);
  assert.match(catalog, /未指定.*未知として扱い/);
  assert.match(catalog, /事実、推測、提案、例を混同しない/);
  assert.match(catalog, /完成前チェック/);
  assert.match(catalog, /内部の思考過程は出力せず/);

  for (const category of [
    "記事・コンテンツ",
    "SNS",
    "動画・YouTube",
    "画像・デザイン",
    "漫画・コミック",
    "アフィリエイト",
    "物販・販売",
    "クラウドソーシング",
    "スキル販売",
    "デジタル商品",
    "顧客対応・営業",
    "リサーチ",
    "業務効率化",
  ]) {
    assert.match(catalog, new RegExp(`"${category}":`));
  }

  assert.match(catalog, /一次情報、公式資料、原典、公開日・更新日/);
  assert.match(catalog, /キャラクター設定表を基準/);
  assert.match(catalog, /タイトル、サムネイル文言、冒頭、動画本編/);
  assert.match(catalog, /提供範囲、納品物、必要素材、修正範囲/);
});

