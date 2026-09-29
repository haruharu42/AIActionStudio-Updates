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
    promptCss,
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
    read("app/phase49-prompt-library.css"),
  ]);

  for (const category of [
    "記事・コンテンツ",
    "SNS",
    "動画・YouTube",
    "画像・デザイン",
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
  assert.match(page, /filtered\.some\(\(template\) => template\.id === selectedId\)/);
  assert.match(page, /const next = filtered\[0\]/);
  assert.match(page, /setSelectedId\(next\.id\)/);
  assert.match(promptCss, /@media \(min-width: 900px\)[\s\S]*\.action-prompt-editor \{[\s\S]*max-height: calc\(100dvh - 40px\);[\s\S]*overflow-y: auto;/);
  assert.match(promptCss, /\.action-prompt-output textarea \{[\s\S]*height: 310px;[\s\S]*overflow-y: auto;/);
  assert.match(route, /Phase15MemberGate/);
  assert.match(nav, /key: "prompts"/);
  assert.match(layout, /phase49-prompt-library\.css/);

  assert.doesNotMatch(
    [catalog, page, editor, toolbar, list, preferences, routing].join("\n"),
    /sb_secret_|service[_-]?role|sk_(?:live|test)_|whsec_/i,
  );
});
