import {
  PROMOTION_METHOD_OPTIONS,
  SALES_CHANNEL_OPTIONS,
  SALES_PRODUCT_OPTIONS,
  type Mode,
  type PromotionMethodKey,
  type SalesChannelKey,
  type SalesProductKey,
} from "@/components/admin-promotion/admin-promotion-options";
import type { AdminArticlePromotionInput, AdminSocialPlatform } from "@/lib/admin-promotion";

export type PromotionThreeStepSelection = {
  salesProduct: SalesProductKey;
  salesChannel: SalesChannelKey;
  promotionMethod: PromotionMethodKey;
};

export type PromotionThreeStepPlan = {
  mode: Mode;
  prelaunch: boolean;
  saleUnconfirmed: boolean;
  productLabel: string;
  channelLabel: string;
  methodLabel: string;
  factsPatch: {
    productName: string;
    editions: string;
    releaseStage: string;
  };
  articlePatch?: Partial<AdminArticlePromotionInput>;
  socialPatch?: {
    platform: AdminSocialPlatform;
    phase: string;
    purpose: string;
    focus: string;
    cta: string;
    variants: number;
  };
  campaignPatch?: {
    campaignName: string;
    phase: string;
    goal: string;
    channels: string;
    offer: string;
    cta: string;
  };
  previewPatch?: {
    updateType: string;
    testedPlatform: string;
    channels: string;
    cta: string;
  };
};

export function buildPromotionThreeStepPlan(
  selection: PromotionThreeStepSelection,
  releaseStage: string,
): PromotionThreeStepPlan {
  const { salesProduct, salesChannel, promotionMethod } = selection;
  const productLabel = SALES_PRODUCT_OPTIONS.find((item) => item.key === salesProduct)?.label ?? "AAS PWA版";
  const channelLabel = SALES_CHANNEL_OPTIONS.find((item) => item.key === salesChannel)?.label ?? "note";
  const methodLabel = PROMOTION_METHOD_OPTIONS.find((item) => item.key === promotionMethod)?.label ?? "販促";
  const salesCta = salesChannel === "direct"
    ? "公式ページへ誘導"
    : salesChannel === "social"
      ? "プロフィールへ誘導"
      : "販売URLへ誘導";
  const articlePlatform: AdminArticlePromotionInput["platform"] = salesChannel === "brain"
    ? "brain"
    : salesChannel === "tips"
      ? "tips"
      : "note";
  const campaignChannels = salesChannel === "brain"
    ? "Brain, X"
    : salesChannel === "tips"
      ? "Tips, X"
      : salesChannel === "social"
        ? "X, Instagram, Threads, TikTok, YouTube Shorts"
        : "note, X, Instagram, Threads";
  const sellingConfirmed = releaseStage === "先行販売" || releaseStage === "正式販売";
  const saleUnconfirmed = !sellingConfirmed;
  const prelaunch = salesProduct === "prelaunch" || promotionMethod === "preview" || saleUnconfirmed;
  const factsPatch = {
    productName: "AI Action Studio",
    editions: "PWA版のみ",
    releaseStage: prelaunch ? releaseStage || "内部テスト" : releaseStage,
  };

  if (promotionMethod === "article") {
    return {
      mode: "article",
      prelaunch,
      saleUnconfirmed,
      productLabel,
      channelLabel,
      methodLabel,
      factsPatch,
      articlePatch: {
        platform: articlePlatform,
        phase: prelaunch ? "公開前予告" : "販売開始後",
        purpose: prelaunch ? "公開前の予告" : "新規紹介・販売",
        focus: productLabel,
        cta: prelaunch ? "公開予定を知らせる" : salesCta,
      },
    };
  }

  if (promotionMethod === "social") {
    return {
      mode: "social",
      prelaunch,
      saleUnconfirmed,
      productLabel,
      channelLabel,
      methodLabel,
      factsPatch,
      socialPatch: {
        platform: "x",
        phase: prelaunch ? "公開前予告" : "販売開始後",
        purpose: prelaunch ? "公開予定の案内" : "販売開始告知",
        focus: productLabel,
        cta: prelaunch ? "フォローして続報を待ってもらう" : salesCta,
        variants: 3,
      },
    };
  }

  if (promotionMethod === "campaign") {
    return {
      mode: "campaign",
      prelaunch,
      saleUnconfirmed,
      productLabel,
      channelLabel,
      methodLabel,
      factsPatch,
      campaignPatch: {
        campaignName: productLabel + (prelaunch ? " 公開予告" : " 販促"),
        phase: prelaunch ? "公開前予告" : "販売開始後",
        goal: prelaunch ? "公開前の期待形成" : "販売開始・認知拡大",
        channels: campaignChannels,
        offer: prelaunch ? "公開予定のみ・販売未開始" : "通常販売",
        cta: prelaunch ? "公開予定を知らせる" : salesCta,
      },
    };
  }

  return {
    mode: "preview",
    prelaunch: true,
    saleUnconfirmed,
    productLabel,
    channelLabel,
    methodLabel,
    factsPatch: {
      ...factsPatch,
      releaseStage: releaseStage || "内部テスト",
    },
    previewPatch: {
      updateType: salesProduct === "prelaunch" ? "正式公開予告" : "公開予定の案内",
      testedPlatform: salesChannel === "note" || salesChannel === "brain" || salesChannel === "tips"
        ? channelLabel
        : "PWA版",
      channels: campaignChannels,
      cta: "フォローして続報を待ってもらう",
    },
  };
}

export function threeStepPromotionMessage(
  selection: PromotionThreeStepSelection,
  plan: PromotionThreeStepPlan,
): string {
  return "作成画面を準備しました: "
    + plan.productLabel + " / " + plan.channelLabel + " / " + plan.methodLabel
    + "。下の内容を確認し、生成用プロンプトをコピーしてください。"
    + (plan.saleUnconfirmed && selection.salesProduct !== "prelaunch"
      ? " 販売中の確認がないため販売前表現で設定しています（安全のため）。"
      : "");
}
