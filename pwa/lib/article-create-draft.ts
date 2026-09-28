import type {
  ArticleCreationContext,
  ArticleCreationDraft,
  NoteMembershipArticleKind,
} from "@/lib/phase11-create";
import {
  AGE_GROUP_OPTIONS,
  GENDER_OPTIONS,
  isImageStyleValue,
  subgenreOptionsFor,
} from "@/lib/phase18-content-options";

export const ARTICLE_CREATE_STEPS = [
  "使用AI選択",
  "記事の種類",
  "画像設定",
  "記事条件",
  "タイトル",
  "本文",
  "内容確認",
  "保存・タグ",
] as const;

export const DEFAULT_ARTICLE_DRAFT: ArticleCreationDraft = {
  generationMode: "prompt_export",
  theme: "",
  title: "",
  publicationTarget: "note",
  articleType: "free",
  genre: "AI副業",
  subgenre: "AIおまかせ",
  ageGroup: "30代",
  gender: "AIおまかせ",
  targetLength: 5000,
  price: null,
  affiliateEnabled: false,
  magazineEnabled: false,
  tags: [],
  coverEnabled: true,
  inlineEnabled: false,
  inlineCount: 2,
  imageStyle: "auto",
  body: "",
  saveStatus: "writing",
};

export function createInitialArticleDraft(
  params?: URLSearchParams | null,
): ArticleCreationDraft {
  const next: ArticleCreationDraft = {
    ...DEFAULT_ARTICLE_DRAFT,
    tags: [...DEFAULT_ARTICLE_DRAFT.tags],
  };
  if (!params) return next;

  const theme = params.get("theme");
  if (theme) next.theme = theme.slice(0, 1000);

  const title = params.get("title");
  if (title) next.title = title.slice(0, 500);

  const publicationTarget = params.get("publicationTarget");
  if (publicationTarget === "note" || publicationTarget === "tips" || publicationTarget === "brain" || publicationTarget === "blog") {
    next.publicationTarget = publicationTarget;
  }

  const articleType = params.get("articleType");
  if (articleType === "free" || articleType === "paid") {
    next.articleType = articleType;
    next.price = articleType === "paid" ? 980 : null;
  }

  const genre = params.get("genre");
  if (genre) next.genre = genre.slice(0, 120);

  const subgenre = params.get("subgenre");
  if (subgenre) {
    next.subgenre = subgenre.slice(0, 120);
  } else {
    const allowedSubgenres = subgenreOptionsFor(next.genre);
    if (!allowedSubgenres.includes(next.subgenre)) {
      next.subgenre = allowedSubgenres[0] ?? "AIおまかせ";
    }
  }

  const ageGroup = params.get("ageGroup");
  if (ageGroup && AGE_GROUP_OPTIONS.some((option) => option === ageGroup)) {
    next.ageGroup = ageGroup;
  }

  const gender = params.get("gender");
  if (gender && GENDER_OPTIONS.some((option) => option === gender)) {
    next.gender = gender;
  }

  const targetLength = Number(params.get("targetLength"));
  if (Number.isSafeInteger(targetLength) && targetLength >= 500 && targetLength <= 50000) {
    next.targetLength = targetLength;
  }

  const imageStyle = params.get("imageStyle");
  if (imageStyle && isImageStyleValue(imageStyle)) {
    next.imageStyle = imageStyle;
  }

  const inlineCount = Number(params.get("inlineCount"));
  if (Number.isSafeInteger(inlineCount) && inlineCount >= 1 && inlineCount <= 10) {
    next.inlineEnabled = true;
    next.inlineCount = inlineCount;
  } else if (params.get("inlineCount") === "0") {
    next.inlineEnabled = false;
  }

  return next;
}

export function initialDraftFromLocation(): ArticleCreationDraft {
  if (typeof window === "undefined") return createInitialArticleDraft();
  return createInitialArticleDraft(new URLSearchParams(window.location.search));
}

export function articleCreationContextFromParams(
  params?: URLSearchParams | null,
): ArticleCreationContext {
  if (!params || params.get("from") !== "note-membership") {
    return { source: null, noteMembershipArticleKind: null };
  }
  const rawKind = params.get("membershipArticleKind");
  const kind: NoteMembershipArticleKind =
    rawKind === "member" || rawKind === "announcement" || rawKind === "qa"
      ? rawKind
      : null;
  return {
    source: "note-membership",
    noteMembershipArticleKind: kind,
  };
}

export function initialArticleCreationContextFromLocation(): ArticleCreationContext {
  if (typeof window === "undefined") {
    return { source: null, noteMembershipArticleKind: null };
  }
  return articleCreationContextFromParams(new URLSearchParams(window.location.search));
}

export function initialMessageFromLocation(): string {
  if (typeof window === "undefined") return "";
  const source = new URLSearchParams(window.location.search).get("from");
  if (source === "home-quick-setup") {
    return "ホームで選んだ基本設定を引き継ぎました。順番に確認しながら進めてください。";
  }
  if (source === "series-plan") {
    return "シリーズ計画からタイトル・無料/有料設定を引き継ぎました。アカウント設定も必要に応じて反映します。";
  }
  if (source === "note-membership") {
    return "noteメンバーシップ運営からテーマを引き継ぎました。メンバー限定公開の設定はnote側で行います。AASの有料記事エリアとは別扱いです。";
  }
  if (source === "note-operations") {
    return "note運営カレンダーからタイトル・テーマ・無料/有料・詳細ジャンル・サブジャンル・文字数目安を引き継ぎました。内容を確認してそのまま記事作成へ進めます。";
  }
  return "";
}

export function parseArticleTags(tagsText: string): string[] {
  return tagsText
    .split(/[,、\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function withArticleTags(
  draft: ArticleCreationDraft,
  tagsText: string,
): ArticleCreationDraft {
  return { ...draft, tags: parseArticleTags(tagsText) };
}

export function validateArticleCreateStep(
  step: number,
  draft: ArticleCreationDraft,
): string | null {
  if (step === 2 && draft.inlineEnabled && (
    !Number.isSafeInteger(draft.inlineCount)
    || draft.inlineCount < 1
    || draft.inlineCount > 10
  )) {
    return "挿絵枚数は1〜10枚で指定してください。";
  }
  if (step === 3 && (!draft.genre.trim() || draft.genre === "その他")) {
    return "「その他」を選んだ場合はジャンル名を入力してください。";
  }
  if (step === 3 && (!draft.subgenre.trim() || draft.subgenre === "その他")) {
    return "「その他」を選んだ場合はサブジャンル名を入力してください。";
  }
  if (step === 3 && (
    !Number.isSafeInteger(draft.targetLength)
    || draft.targetLength < 500
    || draft.targetLength > 50000
  )) {
    return "文字数目安は500〜50000文字で指定してください。";
  }
  if (step === 3 && draft.articleType === "paid" && (
    draft.price === null
    || !Number.isSafeInteger(draft.price)
    || draft.price <= 0
  )) {
    return "有料記事は1以上の整数価格を設定してください。";
  }
  if (step === 4 && (!draft.title.trim() || draft.title.trim().length > 500)) {
    return "タイトルを1〜500文字で入力してください。候補を選ぶか、タイトルを直接入力してください。";
  }
  if (step === 5) {
    const body = draft.body;
    const paidMarkers = body.match(/<!--\s*PAID_AREA\s*-->/gi) ?? [];
    if (draft.articleType === "paid" && body.trim() && paidMarkers.length === 0) {
      return "有料記事には有料エリア開始位置が必要です。本文に「<!-- PAID_AREA -->」を入れてください。";
    }
    if (draft.articleType === "paid" && paidMarkers.length > 1) {
      return "有料エリア開始位置は本文に1か所だけ設定してください。";
    }
    if (draft.articleType === "free" && paidMarkers.length > 0) {
      return "無料記事には有料エリア開始位置を入れないでください。";
    }

    const markerOrders = [...body.matchAll(/<!--\s*IMAGE:0*(\d+)\s*-->/gi)]
      .map((match) => Number(match[1]))
      .filter((order) => Number.isSafeInteger(order));

    if (!draft.inlineEnabled && markerOrders.length > 0) {
      return "挿絵をOFFにしているため、本文の挿絵マーカーを削除してください。";
    }

    if (draft.inlineEnabled) {
      for (let order = 1; order <= draft.inlineCount; order += 1) {
        const occurrences = markerOrders.filter((value) => value === order).length;
        if (occurrences === 0) {
          return `挿絵${order}の差し込み位置が本文にありません。「<!-- IMAGE:${String(order).padStart(2, "0")} -->」を入れてください。`;
        }
        if (occurrences > 1) {
          return `挿絵${order}の差し込み位置が重複しています。各挿絵マーカーは1か所だけにしてください。`;
        }
      }
      const unexpected = markerOrders.find((order) => order < 1 || order > draft.inlineCount);
      if (unexpected !== undefined) {
        return `設定枚数に含まれない挿絵${unexpected}のマーカーがあります。不要な挿絵マーカーを削除してください。`;
      }
      const expectedOrder = Array.from({ length: draft.inlineCount }, (_unused, index) => index + 1);
      if (markerOrders.length !== expectedOrder.length || markerOrders.some((order, index) => order !== expectedOrder[index])) {
        return "挿絵マーカーは本文内で挿絵1→挿絵2→…の順に1回ずつ配置してください。";
      }
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parseStoredArticleDraft(value: unknown): ArticleCreationDraft | null {
  if (!isRecord(value)) return null;

  const generationMode = value.generationMode;
  const publicationTarget = value.publicationTarget;
  const articleType = value.articleType;
  const saveStatus = value.saveStatus;
  const targetLength = value.targetLength;
  const price = value.price;
  const inlineCount = value.inlineCount;
  const imageStyle = typeof value.imageStyle === "string" && isImageStyleValue(value.imageStyle)
    ? value.imageStyle
    : "auto";

  if (
    (generationMode !== "prompt_export" && generationMode !== "manual")
    || (publicationTarget !== "note" && publicationTarget !== "tips" && publicationTarget !== "brain" && publicationTarget !== "blog")
    || (articleType !== "free" && articleType !== "paid")
    || (saveStatus !== "draft" && saveStatus !== "writing" && saveStatus !== "ready")
    || typeof value.theme !== "string"
    || typeof value.title !== "string"
    || typeof value.genre !== "string"
    || typeof value.subgenre !== "string"
    || typeof value.ageGroup !== "string"
    || typeof value.gender !== "string"
    || !AGE_GROUP_OPTIONS.some((option) => option === value.ageGroup)
    || !GENDER_OPTIONS.some((option) => option === value.gender)
    || typeof targetLength !== "number"
    || !Number.isSafeInteger(targetLength)
    || targetLength < 500
    || targetLength > 50000
    || (price !== null && (typeof price !== "number" || !Number.isInteger(price) || price <= 0))
    || typeof value.affiliateEnabled !== "boolean"
    || typeof value.magazineEnabled !== "boolean"
    || !isStringArray(value.tags)
    || typeof value.coverEnabled !== "boolean"
    || typeof value.inlineEnabled !== "boolean"
    || typeof inlineCount !== "number"
    || !Number.isInteger(inlineCount)
    || inlineCount < 1
    || inlineCount > 10
    || typeof value.body !== "string"
  ) {
    return null;
  }

  return {
    generationMode,
    theme: value.theme,
    title: value.title,
    publicationTarget,
    articleType,
    genre: value.genre.slice(0, 120),
    subgenre: value.subgenre.slice(0, 120),
    ageGroup: value.ageGroup,
    gender: value.gender,
    targetLength,
    price,
    affiliateEnabled: value.affiliateEnabled,
    magazineEnabled: value.magazineEnabled,
    tags: [...value.tags],
    coverEnabled: value.coverEnabled,
    inlineEnabled: value.inlineEnabled,
    inlineCount,
    imageStyle,
    body: value.body,
    saveStatus,
  };
}
