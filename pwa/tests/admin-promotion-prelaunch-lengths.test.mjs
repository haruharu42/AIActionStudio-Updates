import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("admin promotion supports verified prelaunch test and release updates", async () => {
  const [lib, page, options] = await Promise.all([
    read("lib/admin-promotion.ts"),
    read("components/admin-promotion-page.tsx"),
    read("components/admin-promotion/admin-promotion-options.ts"),
  ]);

  assert.match(lib, /testingStatus: string/);
  assert.match(lib, /testingNotes: string/);
  assert.match(lib, /releasePlan: string/);
  assert.match(lib, /referenceUrl: string/);
  assert.match(lib, /buildAdminPreviewPromotionPrompt/);
  assert.match(lib, /販売前・テスト中の段階では/);
  assert.match(lib, /実際に確認していない成果・PV・売上・反応・レビュー・感想を作らない/);

  assert.match(options, /key: "preview"/);
  assert.match(options, /テスト・公開予告/);
  assert.match(page, /今回共有してよい確認済み内容/);
  assert.match(page, /公開・販売予定/);
  assert.match(page, /販売前モード/);
  assert.match(page, /useSharedAccessState\(\)/);
  assert.doesNotMatch(page, /loadAccessState/);
});

test("SNS promotion exposes per-platform length presets including paid X long posts", async () => {
  const [lib, page, fields] = await Promise.all([
    read("lib/admin-promotion.ts"),
    read("components/admin-promotion-page.tsx"),
    read("components/admin-promotion/admin-promotion-fields.tsx"),
  ]);

  assert.match(lib, /x-premium-25000/);
  assert.match(lib, /X Premium 最大 25,000文字/);
  assert.match(lib, /threads-attach-10000/);
  assert.match(lib, /Threadsの長文テキスト添付上限/);
  assert.match(lib, /youtube-max/);
  assert.match(lib, /概要欄 最大5,000文字/);
  assert.match(lib, /targetChars: number/);
  assert.match(lib, /目標文字数: 1案あたり約\$\{targetChars\}文字/);
  assert.match(lib, /各投稿本文は目標文字数を超えない/);

  assert.match(page, /from "@\/components\/admin-promotion\/admin-promotion-fields"/);
  assert.match(fields, /SNSごとの文字数設定/);
  assert.match(fields, /SOCIAL_PLATFORM_OPTIONS/);
  assert.match(fields, /その他・自由入力/);
  assert.match(fields, /sanitizeSocialTargetChars/);
  assert.match(fields, /Xは標準投稿とPremium長文/);
  assert.match(fields, /Threadsは通常投稿500文字と最大10,000文字/);
  assert.match(fields, /YouTube Shortsはタイトル100文字以内/);
});

test("campaign and preview prompts inherit the same SNS length plan", async () => {
  const [lib, page] = await Promise.all([
    read("lib/admin-promotion.ts"),
    read("components/admin-promotion-page.tsx"),
  ]);

  assert.match(lib, /type AdminSocialLengthPlan = Record<AdminSocialPlatform, number>/);
  assert.match(lib, /buildAdminCampaignPrompt[\s\S]*?socialLengthPlanBlock\(input\.socialLengths\)/);
  assert.match(lib, /buildAdminPreviewPromotionPrompt[\s\S]*?socialLengthPlanBlock\(input\.socialLengths\)/);
  assert.doesNotMatch(lib, /buildAdminArticlePromotionPrompt[\s\S]{0,2200}socialLengthPlanBlock\(input\.socialLengths\)/);

  assert.match(page, /buildAdminCampaignPrompt\(facts, \{ \.\.\.campaign, socialLengths \}\)/);
  assert.match(page, /buildAdminPreviewPromotionPrompt\(facts, \{ \.\.\.preview, socialLengths \}\)/);
  assert.match(page, /<SocialLengthSettings presetIds=\{socialPresetIds\} plan=\{socialLengths\}/);
});

test("promotion UI is channel-first and keeps advanced settings collapsed", async () => {
  const [page, channelBuilder, lib, css] = await Promise.all([
    read("components/admin-promotion-page.tsx"),
    read("components/admin-promotion/admin-promotion-channel-builder.tsx"),
    read("lib/admin-promotion.ts"),
    read("app/phase24-admin-promotion.css"),
  ]);

  assert.match(page, /AdminPromotionChannelBuilder/);
  assert.match(page, /詳細設定・キャンペーン・製品情報/);
  assert.doesNotMatch(page, /OPTIONAL ADJUSTMENT/);
  assert.doesNotMatch(page, /詳細調整（必要な場合だけ）/);
  assert.doesNotMatch(page, /目的別プリセット/);
  assert.doesNotMatch(page, /admin-promo-quick-start/);
  assert.doesNotMatch(page, /QUICK_PRESETS/);
  assert.doesNotMatch(css, /admin-promo-quick-(?:start|head|grid|note)/);
  assert.doesNotMatch(page, /AdminPromotionThreeStep/);
  assert.match(channelBuilder, /まず、投稿する場所を選ぶ/);
  assert.match(channelBuilder, /どこでプロモーションしますか？/);
  assert.match(channelBuilder, /note/);
  assert.match(channelBuilder, /brain/);
  assert.match(channelBuilder, /tips/);
  assert.match(channelBuilder, /threads/);
  assert.match(channelBuilder, /instagram/);
  assert.match(channelBuilder, /スクショ目安/);
  assert.match(page, /AI Action Studio（AAS）/);
  assert.doesNotMatch(lib, /AI Article Studio/);
  assert.match(lib, /productName: "AI Action Studio"/);
  assert.match(lib, /12種類の副業専用ウィザード/);
  assert.match(css, /\.admin-promo-channel-builder/);
  assert.match(css, /\.admin-promo-channel-overview/);
  assert.match(css, /\.admin-promo-advanced/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.admin-promo-channel-overview/);
});


test("legacy three-step promotion setup remains available but is no longer the primary UI", async () => {
  const [page, component, planner, options] = await Promise.all([
    read("components/admin-promotion-page.tsx"),
    read("components/admin-promotion/admin-promotion-three-step.tsx"),
    read("lib/admin-promotion-three-step.ts"),
    read("components/admin-promotion/admin-promotion-options.ts"),
  ]);

  assert.doesNotMatch(page, /AdminPromotionThreeStep/);
  assert.match(component, /3ステップで作成開始/);
  assert.match(planner, /buildPromotionThreeStepPlan/);
  assert.match(planner, /sellingConfirmed/);
  assert.match(planner, /saleUnconfirmed = !sellingConfirmed/);
  assert.match(options, /AAS内Stripe（設定時のみ）/);
  assert.match(options, /PWA 7日利用パス（設定時のみ）/);
  assert.match(options, /PWA 月額プラン（設定時のみ）/);
});


test("promotion articles return manual screenshot placement instructions without image capture", async () => {
  const [lib, page, channelBuilder, screenshotTool, css] = await Promise.all([
    read("lib/admin-promotion.ts"),
    read("components/admin-promotion-page.tsx"),
    read("components/admin-promotion/admin-promotion-channel-builder.tsx"),
    read("components/admin-promotion/admin-promotion-screenshot-tool.tsx"),
    read("app/phase24-admin-promotion.css"),
  ]);

  assert.match(lib, /buildAdminScreenshotCapturePrompt/);
  assert.match(lib, /スクリーンショット画像を取得・生成しない/);
  assert.match(lib, /ブラウザ操作、ログイン、GitHub確認、Preview画面の取得は行わない/);
  assert.match(lib, /\[スクショ①をここに挿入\]/);
  assert.match(lib, /スクリーンショット撮影指示/);
  assert.match(lib, /不要なら0枚でもよい/);
  assert.match(lib, /ユーザー本人がスクリーンショットを撮影する前提/);
  assert.doesNotMatch(page, /AdminPromotionScreenshotTool/);
  assert.match(page, /AdminPromotionChannelBuilder/);
  assert.match(channelBuilder, /スクリーンショットは自分で撮影/);
  assert.match(screenshotTool, /記事用スクショ撮影指示/);
  assert.match(screenshotTool, /撮影は自分で行う/);
  assert.match(screenshotTool, /画像取得用ではありません/);
  assert.match(css, /\.admin-promo-channel-builder/);
  assert.match(css, /\.admin-promo-channel-overview/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.admin-promo-channel-overview/);
});


test("promotion page keeps static choices in a dedicated options module", async () => {
  const [page, options] = await Promise.all([
    read("components/admin-promotion-page.tsx"),
    read("components/admin-promotion/admin-promotion-options.ts"),
  ]);

  assert.match(page, /from "@\/components\/admin-promotion\/admin-promotion-options"/);
  assert.doesNotMatch(page, /^const PURPOSE_OPTIONS =/m);
  assert.doesNotMatch(page, /^const AUDIENCE_OPTIONS =/m);
  assert.doesNotMatch(page, /^const SALES_PRODUCT_OPTIONS:/m);
  assert.match(options, /export const PURPOSE_OPTIONS/);
  assert.match(options, /export const AUDIENCE_OPTIONS/);
  assert.match(options, /export const SALES_PRODUCT_OPTIONS/);
  assert.match(options, /export const SCREENSHOT_PUBLICATION_OPTIONS/);
  assert.match(options, /export const DEFAULT_SOCIAL_PRESET_IDS/);
});


test("manual screenshot helper remains isolated and is not rendered in the beginner flow", async () => {
  const [page, screenshotTool] = await Promise.all([
    read("components/admin-promotion-page.tsx"),
    read("components/admin-promotion/admin-promotion-screenshot-tool.tsx"),
  ]);

  assert.doesNotMatch(page, /AdminPromotionScreenshotTool/);
  assert.doesNotMatch(page, /screenshotTarget/);
  assert.doesNotMatch(page, /screenshotPublication/);
  assert.match(screenshotTool, /useState<AdminScreenshotTarget>/);
  assert.match(screenshotTool, /buildAdminScreenshotCapturePrompt/);
  assert.match(screenshotTool, /MANUAL SCREENSHOT GUIDE/);
});


test("channel-specific promotion prompts are isolated by publication", async () => {
  const [page, builder, channelLib] = await Promise.all([
    read("components/admin-promotion-page.tsx"),
    read("components/admin-promotion/admin-promotion-channel-builder.tsx"),
    read("lib/admin-promotion-channel.ts"),
  ]);

  assert.match(page, /AdminPromotionChannelBuilder/);
  assert.match(builder, /ADMIN_PROMOTION_CHANNELS/);
  assert.match(builder, /buildAdminChannelPromotionPrompt/);
  assert.match(channelLib, /buildNotePromotionPrompt/);
  assert.match(channelLib, /buildBrainPromotionPrompt/);
  assert.match(channelLib, /buildTipsPromotionPrompt/);
  assert.match(channelLib, /buildXPromotionPrompt/);
  assert.match(channelLib, /buildThreadsPromotionPrompt/);
  assert.match(channelLib, /buildInstagramPromotionPrompt/);
  assert.match(channelLib, /\[スクショ①をここに挿入\]/);
  assert.match(channelLib, /添付画像1/);
  assert.match(channelLib, /カルーセル何枚目か/);
  assert.match(channelLib, /スクリーンショット画像そのものは取得・生成しない/);
});
