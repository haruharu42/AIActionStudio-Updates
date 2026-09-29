import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("AI Action Studio branding is used on the active PWA shell", async () => {
  const [layout, shell, legacyShell, manifest, home, offline, serviceWorker] = await Promise.all([
    read("app/layout.tsx"),
    read("components/aas-reference-shell.tsx"),
    read("components/phase6-app.tsx"),
    read("public/manifest.webmanifest"),
    read("components/phase18-beginner-home.tsx"),
    read("public/offline.html"),
    read("public/sw.js"),
  ]);

  assert.match(layout, /AI Action Studio/);
  assert.match(layout, /AIで副業を、もっと簡単に。/);
  assert.match(shell, /AI Action Studio/);
  assert.match(shell, /AIで副業を、もっと簡単に。/);
  assert.match(legacyShell, /AI ACTION/);
  assert.match(legacyShell, /AIで副業を、/);
  assert.doesNotMatch(legacyShell, /AI ARTICLE/);
  assert.match(manifest, /AI Action Studio/);
  assert.match(offline, /AI Action Studio｜オフライン/);
  assert.doesNotMatch(offline, /AI記事スタジオ|AI Article Studio/);
  assert.match(offline, /addEventListener\("online"/);
  assert.match(serviceWorker, /aas-pwa-phase56-runtime-v12-axia-generated/);
  assert.doesNotMatch(serviceWorker, /phase17-prod-v2/);
  assert.match(home, /ActionStudioHomeHero/);
  assert.match(home, /ActionStudioQuickActions/);
});

test("home keeps quick actions while side-hustle discovery lives in the genre-grouped feature list", async () => {
  const [hub, tools, catalog, home, css, layout] = await Promise.all([
    read("components/action-studio-home-hub.tsx"),
    read("components/phase-tools-page.tsx"),
    read("features/tools/tool-catalog.ts"),
    read("components/phase18-beginner-home.tsx"),
    read("app/phase48-action-studio.css"),
    read("app/layout.tsx"),
  ]);

  for (const label of [
    "今日はAIで何を進めますか？",
    "よく使う機能",
    "記事生成",
    "SNS投稿",
    "画像生成",
    "プロンプトライブラリ",
    "副業機能",
    "記事ライブラリ",
  ]) {
    assert.match(hub, new RegExp(label));
  }

  assert.doesNotMatch(hub, /<h3>副業から探す<\/h3>/);
  assert.doesNotMatch(hub, /const sideHustles/);
  assert.match(hub, /href: "\/tools"/);

  for (const genre of [
    "記事・コンテンツ",
    "SNS・動画・集客",
    "販売・収益化",
    "受託・案件獲得",
    "リサーチ・業務効率化",
    "運営・アカウント",
    "公開・分析",
    "サポート",
  ]) {
    assert.match(catalog, new RegExp(genre));
  }

  for (const sideHustle of [
    "note運営アシスタント",
    "記事・ブログ・コンテンツ販売",
    "SNS運用・集客",
    "YouTube・ショート動画",
    "アフィリエイト",
    "物販・フリマ販売",
    "クラウドソーシング",
    "スキル販売",
    "デジタル商品・教材販売",
    "営業・案件獲得",
    "リサーチ・事実確認",
    "業務効率化・SOP化",
    "AI副業プランナー",
  ]) {
    assert.match(catalog, new RegExp(sideHustle));
  }

  assert.match(tools, /MEMBER_TOOL_GROUPS/);
  assert.match(tools, /FEATURE GENRE/);
  assert.match(tools, /副業ジャンルと用途ごとに機能をまとめています/);
  assert.match(home, /<ActionStudioHomeHero \/>/);
  assert.match(home, /<ActionStudioQuickActions showAdmin=\{activeAdmin\} \/>/);
  assert.ok(home.indexOf('className="reference-creator-card"') < home.indexOf("記事ライブラリ / noteマガジン"));
  assert.ok(home.indexOf("記事ライブラリ / noteマガジン") < home.indexOf("<ActionStudioHomeHero />"));
  assert.ok(home.indexOf("<ActionStudioHomeHero />") < home.indexOf("週間ランキング"));
  assert.ok(home.indexOf("週間ランキング") < home.indexOf("<ActionStudioQuickActions"));
  assert.match(layout, /phase48-action-studio\.css/);
  assert.match(layout, /phase53-crystal-ui\.css/);
  assert.match(layout, /className="aas-crystal-theme"/);
  assert.match(css, /\.action-studio-card-grid/);
});
