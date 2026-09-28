import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");
const readArticleStepSource = async () => (await Promise.all([
  "components/article-create/article-create-steps.tsx",
  "components/article-create/article-create-generation-steps.tsx",
  "components/article-create/article-create-finish-steps.tsx",
  "components/article-create/article-create-step-shared.tsx",
].map((relative) => read(relative)))).join("\n");

test("article output uses only the owned publish body and creates a safe Markdown filename", async () => {
  const api = await read("lib/article-export.ts");
  const page = await read("components/article-export-page.tsx");
  const route = await read("app/export/page.tsx");

  assert.match(api, /workspace\.publishBody \|\| detail\.body/);
  assert.match(api, /normalize\("NFKC"\)/);
  assert.match(page, /getCloudArticleDetail/);
  assert.match(page, /articleExportMarkdown/);
  assert.match(page, /navigator\.clipboard\.writeText/);
  assert.match(page, /new Blob/);
  assert.match(page, /text\/markdown/);
  assert.match(page, /anchor\.download/);
  assert.match(route, /ArticleExportPage/);
  assert.doesNotMatch(`${api}\n${page}`, /service[_-]?role|sb_secret_/i);
});

test("paid article pricing stays compatible with positive-price validation", async () => {
  const api = await read("lib/phase11-create.ts");
  const page = await read("components/phase11-create-page.tsx");
  const stepUi = await readArticleStepSource();
  const migration = await read("../supabase/migrations/20260910142500_articles_paid_price_consistency.sql");

  assert.match(api, /draft\.price <= 0/);
  assert.match(api, /有料記事は1以上の整数価格を設定してください/);
  assert.match(page, /const setArticleType = \(value: ArticleType\)/);
  assert.match(page, /value === "free"\s*\? null/);
  assert.match(stepUi, /PAID_ARTICLE_PRICE_OPTIONS/);
  assert.match(stepUi, /paidArticlePriceSelectionValue/);
  assert.match(stepUi, /<option value="custom">自由入力<\/option>/);
  assert.match(stepUi, /type="number" min=\{1\} step=\{1\} value=\{draft\.price \?\? 980\}/);
  assert.match(page, /current\.price : 980/);
  assert.match(migration, /articles_paid_price_positive_check/);
  assert.match(migration, /price is not null and price > 0/);
});

test("magazine creation is dropdown-first, validated and persisted without a new database contract", async () => {
  const planner = await read("lib/magazine-planner.ts");
  const plannerUi = await read("components/article-create/magazine-planner.tsx");
  const page = await read("components/phase11-create-page.tsx");
  const steps = await readArticleStepSource();
  const draftHelpers = await read("lib/article-create-draft.ts");
  const api = await read("lib/phase11-create.ts");
  const progress = await read("lib/phase11-wizard-progress.ts");

  for (const label of ["対象読者", "記事数（目安）", "マガジンの方向性", "公開スタイル", "収益化レベル", "記事の並び方"]) {
    assert.match(plannerUi, new RegExp(label));
  }
  assert.match(planner, /suggestMagazinePlans/);
  assert.match(planner, /parseMagazinePlanDraft/);
  assert.match(planner, /MAGAZINE_PURPOSE_OPTIONS/);
  assert.match(planner, /customAudience/);
  assert.match(planner, /customDirection/);
  assert.match(planner, /customPublishingStyle/);
  assert.match(planner, /customMonetizationLevel/);
  assert.match(planner, /customOrderStrategy/);
  assert.match(plannerUi, /マガジン名と記事タイトルを生成する/);
  assert.match(plannerUi, /このマガジンを使用する/);
  assert.match(plannerUi, /その他（自由入力）/);
  assert.match(plannerUi, /その他のジャンル/);
  assert.match(plannerUi, /その他のサブジャンル/);
  assert.match(plannerUi, /その他のテーマ・キーワード/);
  assert.match(plannerUi, /その他の対象読者/);
  assert.match(plannerUi, /その他のマガジンの方向性/);
  assert.match(plannerUi, /その他の記事数/);
  assert.match(plannerUi, /その他の公開スタイル/);
  assert.match(plannerUi, /その他の収益化レベル/);
  assert.match(plannerUi, /その他の記事の並び方/);
  assert.match(plannerUi, /その他の補足・目的/);
  assert.match(plannerUi, /条件が変更されました。マガジン構成をもう一度生成してください。/);
  for (const label of ["記事の種類", "画像設定", "記事条件", "タイトル", "本文", "内容確認", "保存・タグ"]) {
    assert.match(draftHelpers, new RegExp(label));
  }
  assert.match(page, /ARTICLE_CREATE_STEPS\.map/);
  assert.doesNotMatch(page, /displayStepForInternalStep|ARTICLE_CREATE_UI_STEPS/);
  assert.match(steps, /マガジンモード/);
  assert.match(steps, /disabled=\{draft\.magazineEnabled\}/);
  assert.match(page, /magazinePlan\.name\.trim\(\)/);
  assert.match(api, /pwa_magazine_plan/);
  assert.match(api, /custom_audience/);
  assert.match(api, /custom_direction/);
  assert.match(api, /custom_publishing_style/);
  assert.match(api, /custom_monetization_level/);
  assert.match(api, /custom_order_strategy/);
  assert.match(api, /withNoteMagazineWorkspace/);
  assert.match(api, /マガジン構成案を選択してから記事を保存してください/);
  assert.match(progress, /parseMagazinePlanDraft/);
  assert.match(progress, /magazinePlan/);
  assert.doesNotMatch(`${planner}\n${plannerUi}`, /service[_-]?role|sb_secret_|create table|alter table/i);
});

test("SNS launch planning covers account setup, content pillars, monetization and improvement without invented results", async () => {
  const api = await read("lib/phase15-sns-plan.ts");
  const page = await read("components/phase15-sns-plan-page.tsx");
  const route = await read("app/sns-plan/page.tsx");

  assert.match(api, /"x" \| "instagram" \| "threads"/);
  assert.match(api, /表示名候補5案/);
  assert.match(api, /自己紹介文候補5案/);
  assert.match(api, /投稿の柱を3〜5本/);
  assert.match(api, /無料コンテンツ→信頼形成→商品\/記事\/相談への導線/);
  assert.match(api, /30日後に確認する改善指標/);
  assert.match(api, /売上・フォロワー数・レビューを創作しない/);
  assert.match(api, /成果を保証せず/);
  assert.match(page, /SNSアカウント立ち上げ設計/);
  assert.match(page, /設計プロンプトをコピー/);
  assert.match(route, /Phase15MemberGate/);
  assert.match(route, /Phase15SnsPlanPage/);
});

test("Phase 15 member tools require the same PWA access gate as the rest of the product", async () => {
  const gate = await read("components/phase15-member-gate.tsx");
  const sideJobRoute = await read("app/sidejob/page.tsx");
  const snsPlanRoute = await read("app/sns-plan/page.tsx");
  const tools = await read("components/phase-tools-page.tsx");
  const toolCatalog = await read("features/tools/tool-catalog.ts");

  assert.match(gate, /useSharedAccessState\(\)/);
  assert.doesNotMatch(gate, /loadAccessState|getSupabaseClient/);
  assert.match(gate, /state\.kind === "ready"/);
  assert.match(gate, /state\.kind === "loading"\) return null/);
  assert.match(gate, /state\.kind === "entitlement_denied"/);
  assert.match(sideJobRoute, /Phase15MemberGate/);
  assert.match(snsPlanRoute, /Phase15MemberGate/);
  assert.doesNotMatch(tools, /const publicTools/);
  assert.match(tools, /MEMBER_TOOL_GROUPS/);
  assert.match(toolCatalog, /export const MEMBER_TOOL_GROUPS/);
  assert.match(tools, /\{ready && \(/);
});

test("tools hub keeps supporting workflows grouped and leaves article-integrated tools out of the list", async () => {
  const tools = await read("components/phase-tools-page.tsx");
  const toolCatalog = await read("features/tools/tool-catalog.ts");
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(toolCatalog, /href: "\/sns-plan"/);
  assert.match(toolCatalog, /SNSアカウント設計/);
  assert.match(toolCatalog, /SNS・動画・集客/);
  assert.match(toolCatalog, /公開・分析/);
  assert.match(toolCatalog, /販売・収益化/);
  assert.match(toolCatalog, /受託・案件獲得/);
  assert.doesNotMatch(toolCatalog, /href: "\/export"/);
  assert.doesNotMatch(toolCatalog, /href: "\/images"/);
  assert.doesNotMatch(toolCatalog, /href: "\/create"/);
  assert.match(tools, /MEMBER_TOOL_GROUPS/);
  assert.match(packageJson.scripts.test, /node --test --test-concurrency=1/);
});


test("article creator UI v2 keeps the eight-step rail readable and preserves two-column mobile planning", async () => {
  const css = await read("app/phase33-reference-ui.css");
  const plannerUi = await read("components/article-create/magazine-planner.tsx");

  assert.match(plannerUi, /マガジンタイトル一括生成/);
  assert.match(css, /Article creator UI v2: eight-step progress, readable type, and 390-430px two-column layout/);
  assert.match(css, /grid-template-columns: repeat\(8, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.reference-create-shell \.article-kind-grid,[\s\S]*?\.reference-create-shell \.magazine-dropdown-grid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*?\.reference-create-shell \.article-kind-grid,[\s\S]*?\.reference-create-shell \.magazine-dropdown-grid \{[\s\S]*?grid-template-columns: 1fr/);
});


test("article image generation exposes batch and individual prompts and forbids temporary chat", async () => {
  const prompts = await read("lib/phase13-image-prompts.ts");
  const steps = await readArticleStepSource();

  assert.match(prompts, /画像生成では一時チャットは使用不可です。通常チャットを使用してください。/);
  assert.match(prompts, /buildCombinedImagePrompt/);
  assert.match(prompts, /IMAGE_CHAT_USAGE_RULE/);
  assert.match(steps, /画像生成プロンプト（一括・個別）/);
  assert.match(steps, /個別に画像を作成/);
  assert.match(steps, /個別作成プロンプト/);
  assert.match(steps, /画像生成では一時チャットは使用不可/);
  assert.match(steps, /imagePrompts\.map/);
});
