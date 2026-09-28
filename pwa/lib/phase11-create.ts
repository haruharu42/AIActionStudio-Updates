import type { SupabaseClient } from "@supabase/supabase-js";

import { recordKnowledgeCandidate } from "@/lib/knowledge-catalog";
import { withNoteMagazineWorkspace, type NoteMagazineSettings } from "@/lib/article-library-v2";
import {
  magazineAudienceLabel,
  magazineDirectionLabel,
  magazineMonetizationLabel,
  magazineOrderLabel,
  magazinePublishingStyleLabel,
  type MagazinePlanDraft,
} from "@/lib/magazine-planner";
import { PWA_PRODUCT_CODE } from "@/lib/phase6-access";
import { buildPlatformAccountPromptContext, getRuntimePlatformAccountDesign } from "@/lib/platform-account-design";
import { getRuntimeKnowledgeState } from "@/lib/prompt-optimization";
import { getPromptSpecialization } from "@/lib/phase12-prompt-profiles";
import { buildImagePromptPlan } from "@/lib/phase13-image-prompts";
import { isCustomGenre, isCustomSubgenre } from "@/lib/phase18-content-options";
import {
  buildUserPromptContext,
  getRuntimeWritingProfile,
  recordPersonalizationSignal,
} from "@/lib/user-personalization";

export type PublicationTarget = "note" | "tips" | "brain" | "blog";
export type ArticleType = "free" | "paid";
export type GenerationMode = "prompt_export" | "manual";
export type SaveStatus = "draft" | "writing" | "ready";
export type ArticleCreationSource = "note-membership" | null;
export type NoteMembershipArticleKind = "member" | "announcement" | "qa" | null;

export type ArticleCreationContext = {
  source: ArticleCreationSource;
  noteMembershipArticleKind: NoteMembershipArticleKind;
};

export type ArticleCreationDraft = {
  generationMode: GenerationMode;
  theme: string;
  title: string;
  publicationTarget: PublicationTarget;
  articleType: ArticleType;
  genre: string;
  subgenre: string;
  ageGroup: string;
  gender: string;
  targetLength: number;
  price: number | null;
  affiliateEnabled: boolean;
  magazineEnabled: boolean;
  tags: string[];
  coverEnabled: boolean;
  inlineEnabled: boolean;
  inlineCount: number;
  imageStyle: string;
  body: string;
  saveStatus: SaveStatus;
};

export type CreatedArticle = {
  id: string;
  title: string;
  revision: number;
};

const targetName: Record<PublicationTarget, string> = {
  note: "note",
  tips: "Tips",
  brain: "Brain",
  blog: "ブログ",
};

function normalizeLines(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

function normalizedTitleLine(value: string): string {
  return value
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .replace(/^["'「『](.+)["'」』]$/, "$1")
    .trim();
}

export function stripLeadingArticleTitle(value: string, title: string): string {
  const normalized = value.replace(/\r\n?/g, "\n").trimStart();
  const selectedTitle = normalizedTitleLine(title);
  if (!normalized || !selectedTitle) return normalized;

  const lines = normalized.split("\n");
  if (normalizedTitleLine(lines[0] ?? "") !== selectedTitle) return normalized;

  lines.shift();
  while (lines[0]?.trim() === "") lines.shift();
  return lines.join("\n").trimStart();
}

export function publicationEditorLink(target: PublicationTarget): string | null {
  if (target === "note") return "https://note.com/new";
  if (target === "tips") return "https://tips.jp/";
  if (target === "brain") return "https://brain-market.com/";
  return null;
}

export type PublicationBodyOptions = {
  articleType?: ArticleType;
  inlineEnabled?: boolean;
  inlineCount?: number;
};

export function normalizePublicationMarkers(
  body: string,
  options: PublicationBodyOptions,
): string {
  let normalized = body.replace(/\r\n?/g, "\n");

  if (options.articleType === "free") {
    normalized = normalized.replace(/^\s*<!--\s*PAID_AREA\s*-->\s*$/gim, "");
  }

  if (options.inlineEnabled === false) {
    normalized = normalized.replace(/^\s*<!--\s*IMAGE:\d+\s*-->\s*$/gim, "");
  } else if (options.inlineEnabled === true && Number.isSafeInteger(options.inlineCount)) {
    const maxInline = Math.max(0, Math.trunc(options.inlineCount ?? 0));
    normalized = normalized.replace(
      /^\s*<!--\s*IMAGE:(\d+)\s*-->\s*$/gim,
      (match, order: string) => {
        const numericOrder = Number(order);
        return numericOrder >= 1 && numericOrder <= maxInline ? match.trim() : "";
      },
    );
  }

  return normalized.replace(/\n{3,}/g, "\n\n").trim();
}

export function publicationBodyForCopy(
  body: string,
  title: string,
  options?: PublicationBodyOptions,
): string {
  const source = options ? normalizePublicationMarkers(body, options) : body;
  return stripLeadingArticleTitle(source, title)
    .replace(/^\s*<!--\s*IMAGE:(\d+)\s*-->\s*$/gim, (_match, order: string) => `**【挿絵${Number(order)}をここに挿入】**`)
    .replace(/^\s*<!--\s*PAID_AREA\s*-->\s*$/gim, "---\n**【ここから有料エリア】**\n---")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 50);
}

function promptContextBlock(task: "title" | "article"): string {
  const value = buildUserPromptContext(getRuntimeWritingProfile(), task);
  return value ? `\n\n${value}` : "";
}

function specializationFor(draft: ArticleCreationDraft, task: "title" | "article"): string {
  return getPromptSpecialization({
    publicationTarget: draft.publicationTarget,
    articleType: draft.articleType,
    genre: draft.genre,
    subgenre: draft.subgenre,
    ageGroup: draft.ageGroup,
    gender: draft.gender,
  }, task);
}

function magazinePromptContext(plan?: MagazinePlanDraft): string {
  if (!plan?.name) return "";
  const titles = plan.articleTitles.length
    ? plan.articleTitles.map((title, index) => `${index + 1}. ${title}`).join("\n")
    : "未確定";
  return `\n\n【MAGAZINE CONTEXT】
マガジン名: ${plan.name}
想定読者: ${magazineAudienceLabel(plan.audience, plan.customAudience)}
方向性: ${magazineDirectionLabel(plan.direction, plan.customDirection)}
記事数: ${plan.articleCount}記事
公開スタイル: ${magazinePublishingStyleLabel(plan.publishingStyle, plan.customPublishingStyle)}
収益化レベル: ${magazineMonetizationLabel(plan.monetizationLevel, plan.customMonetizationLevel)}
記事の並び方: ${magazineOrderLabel(plan.orderStrategy, plan.customOrderStrategy)}
補足・目的: ${plan.purpose || "未指定"}
構成案:
${titles}
現在の記事がマガジン全体の中で重複しない役割になるようにしてください。`;
}

export function suggestLocalTitles(
  draft: Pick<
    ArticleCreationDraft,
    "theme" | "publicationTarget" | "articleType" | "ageGroup" | "genre"
  >,
): string[] {
  const theme = draft.theme.trim() || draft.genre.trim() || "テーマ";
  const age = draft.ageGroup.trim() ? `${draft.ageGroup.trim()}向け` : "初心者向け";
  const paid = draft.articleType === "paid" ? "実践ガイド" : "入門ガイド";
  const site = targetName[draft.publicationTarget];
  return [
    `${theme}は何から始める？${age}に分かりやすく始め方を整理`,
    `${theme}入門｜${age}のための選び方・進め方${paid}`,
    `迷わない${theme}の始め方｜${age}に必要な準備と手順`,
    `${site}で学ぶ${theme}｜初心者が最初に押さえたいポイント`,
    `${theme}を無理なく始める方法｜${age}のチェックリスト付き`,
  ];
}

export function parseTitleCandidates(value: string): string[] {
  const candidates: string[] = [];
  const lines = value.replace(/```[a-z0-9_-]*\s*/gi, "").replace(/```/g, "").split(/\r?\n/);
  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;
    line = line.replace(/^#{1,6}\s+/, "").trim();
    if (/^(?:記事)?タイトル候補(?:\s*[（(]?5(?:個|案)[）)]?)?\s*[:：]?$/i.test(line)) continue;
    line = line.replace(/^\*\*(.+)\*\*$/, "$1").trim();
    line = line.replace(/^(?:候補\s*)?\d{1,2}\s*[.)、:：-]\s*/, "").trim();
    line = line.replace(/^[-*•・]\s*/, "").trim();
    line = line.replace(/^\*\*(.+)\*\*$/, "$1").trim();
    line = line.replace(/^[\"'「『](.+)[\"'」』]$/, "$1").trim();
    if (line.length < 2 || line.length > 500 || candidates.includes(line)) continue;
    candidates.push(line);
    if (candidates.length >= 5) break;
  }
  return candidates;
}

export function buildTitlePrompt(draft: ArticleCreationDraft, magazinePlan?: MagazinePlanDraft): string {
  const specialization = specializationFor(draft, "title");
  return `あなたは日本語の編集者です。次の条件で記事タイトル候補を5個作成してください。\n\n【絶対ルール】\n- 実体験・実績・レビューを創作しない。\n- 未確認の価格・在庫・評価・ランキング・統計を断定しない。\n- 競合記事のコピーや近似模倣をしない。\n- 根拠のない成果保証や過度な煽りを使わない。${promptContextBlock("title")}\n\n【条件】\n掲載先: ${targetName[draft.publicationTarget]}\n記事タイプ: ${draft.articleType === "paid" ? "有料" : "無料"}\nジャンル: ${draft.genre || "未指定"}\nサブジャンル: ${draft.subgenre || "AIおまかせ"}\n対象年齢: ${draft.ageGroup || "AIおまかせ"}\n対象性別: ${draft.gender || "AIおまかせ"}\n${draft.theme.trim() ? `補足テーマ: ${draft.theme.trim()}\\n` : ""}\n${specialization}${magazinePromptContext(magazinePlan)}\n\n${buildPlatformAccountPromptContext(draft.publicationTarget)}

一目で内容が分かり、誇張せず、読者がクリック後の内容を想像できるタイトルにしてください。
必ず5個だけ、1〜5の番号付きで1行に1候補を出力してください。前置き・解説・まとめは不要です。`;
}

export function buildArticlePrompt(draft: ArticleCreationDraft, magazinePlan?: MagazinePlanDraft): string {
  const imageRule = draft.coverEnabled || draft.inlineEnabled
    ? `画像計画: アイキャッチ=${draft.coverEnabled ? "あり" : "なし"}、挿絵=${draft.inlineEnabled ? `${draft.inlineCount}枚` : "なし"}、画風=${draft.imageStyle || "auto"}。本文中で挿絵が有効な場合は「<!-- IMAGE:01 -->」のような差し込み候補位置を自然な区切りに、必要枚数ぶん必ず単独行で置いてください。`
    : "画像計画: なし。";
  const paidAreaRule = draft.articleType === "paid"
    ? "有料記事: 無料で読める導入・問題提起・価値提示を先に用意し、その後、有料本文が始まる直前に <!-- PAID_AREA --> を必ず1回だけ単独行で置いてください。マーカーより前だけでも購入判断ができる説明を入れ、核心となる具体策・手順・テンプレート・詳細解説はマーカーより後へ配置してください。"
    : "無料記事: <!-- PAID_AREA --> は出力しないでください。";
  const specialization = specializationFor(draft, "article");
  return `あなたは日本語の編集者兼記事ライターです。\n目的は、指定された掲載先へそのまま掲載できる、具体的で読みやすく、読者が行動できる完成記事を作ることです。\n\n【絶対ルール】\n- ユーザーが入力していない実体験・実績・レビュー・購入経験・使用経験を事実として作らない。\n- 価格、在庫、評価、キャンペーン、統計、販売数、ランキング、最新仕様など変動する情報を未確認のまま断定しない。\n- 競合記事の文章をコピー・近似模倣しない。\n- 根拠のない成果保証、過度な煽り、架空の権威づけをしない。\n- 架空例を使う場合は「例」「想定」と明示する。\n- 文字数を水増しせず、手順・判断基準・具体例・チェックリスト等で価値を作る。\n\n【出力】\n- 日本語。\n- 選択済みタイトルは構成条件として参照するだけにし、出力本文の先頭や見出しに記事タイトルを再掲しない。\n- H1（#）は使わない。最初の行から導入本文またはH2（##）以下の本文を出力する。\n- Markdown見出し（## / ###）で明確に構造化する。\n- 読者に必ず覚えてほしい結論・重要語・判断基準は **太字** で強調する。\n- 特に重要な注意点・要点・行動指針は > 引用形式の強調ブロックを自然に使う。\n- 手順・比較・チェック項目は箇条書きまたは番号付きリストを使い、長い文章だけが続かないようにする。\n- セクションの大きな切り替わりでは必要に応じて --- を使う。\n- 装飾は重要箇所に絞り、全文章を太字にするなど過剰な装飾はしない。\n- 挿絵マーカー <!-- IMAGE:01 --> 等は単独行に置き、太字・引用・リストの中へ入れない。\n- 余計な前置き、メタ説明、生成方針の説明は付けない。\n- 完成記事の本文だけを返す。タイトル・「タイトル：」表記・末尾の解説は出力しない。${promptContextBlock("article")}\n\n【ARTICLE BRIEF】\nタイトル: ${draft.title || "タイトル候補から選択"}\n掲載先: ${targetName[draft.publicationTarget]}\n記事タイプ: ${draft.articleType === "paid" ? "有料" : "無料"}\nジャンル: ${draft.genre || "未指定"}\nサブジャンル: ${draft.subgenre || "AIおまかせ"}\n対象年齢: ${draft.ageGroup || "AIおまかせ"}\n対象性別: ${draft.gender || "AIおまかせ"}\n${draft.theme.trim() ? `補足テーマ: ${draft.theme.trim()}\\n` : ""}文字数目安: 約${draft.targetLength}文字\n価格: ${draft.articleType === "paid" && draft.price !== null ? `${draft.price}円` : "設定なし"}\nアフィリエイト: ${draft.affiliateEnabled ? "ON" : "OFF"}\nマガジン: ${draft.magazineEnabled ? "ON" : "OFF"}\n${imageRule}\n${paidAreaRule}\n\n${specialization}${magazinePromptContext(magazinePlan)}${buildPlatformAccountPromptContext(draft.publicationTarget)}\n\n掲載先と無料/有料の性質に合わせ、導入、見出し構成、具体例、手順、注意点、必要に応じたCTAを自然に最適化してください。`;
}

async function requireAccess(
  client: SupabaseClient,
  ownerId: string,
): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user || user.id.toLowerCase() !== ownerId.toLowerCase()) {
    throw new Error("ログイン状態を確認できません。");
  }
  const { data, error } = await client.rpc("can_access_product", {
    p_product_code: PWA_PRODUCT_CODE,
  });
  if (error || data !== true) throw new Error("PWA利用権を確認できません。");
}

export function validateCreationDraft(
  input: ArticleCreationDraft,
): ArticleCreationDraft {
  const draft: ArticleCreationDraft = {
    ...input,
    theme: input.theme.trim(),
    title: input.title.trim(),
    genre: input.genre.trim(),
    subgenre: input.subgenre.trim(),
    ageGroup: input.ageGroup.trim(),
    gender: input.gender.trim(),
    body: normalizeLines(input.body),
    tags: compactTags(input.tags),
  };
  if (!draft.title || draft.title.length > 500) {
    throw new Error("タイトルを1〜500文字で入力してください。");
  }
  if (draft.saveStatus === "ready" && !draft.body) {
    throw new Error("完成状態で保存するには本文を入力してください。");
  }
  if (!draft.genre || draft.genre === "その他") {
    throw new Error("「その他」を選んだ場合はジャンル名を入力してください。");
  }
  if (!draft.subgenre || draft.subgenre === "その他") {
    throw new Error("「その他」を選んだ場合はサブジャンル名を入力してください。");
  }
  if (draft.genre.length > 120 || draft.subgenre.length > 120) {
    throw new Error("ジャンル・サブジャンルは120文字以内で入力してください。");
  }
  if (
    !Number.isSafeInteger(draft.targetLength) ||
    draft.targetLength < 500 ||
    draft.targetLength > 50000
  ) {
    throw new Error("文字数目安は500〜50000文字で指定してください。");
  }
  if (
    !Number.isSafeInteger(draft.inlineCount) ||
    draft.inlineCount < 0 ||
    draft.inlineCount > 10
  ) {
    throw new Error("挿絵枚数は0〜10枚で指定してください。");
  }
  if (
    draft.articleType === "paid" &&
    (draft.price === null ||
      !Number.isSafeInteger(draft.price) ||
      draft.price <= 0)
  ) {
    throw new Error("有料記事は1以上の整数価格を設定してください。");
  }
  const paidMarkers = draft.body.match(/<!--\s*PAID_AREA\s*-->/gi) ?? [];
  if (draft.articleType === "paid" && draft.body.trim() && paidMarkers.length === 0) {
    throw new Error("有料記事の本文に有料エリア開始位置がありません。本文工程で「ここから有料エリア」を設定してください。");
  }
  if (draft.articleType === "paid" && paidMarkers.length > 1) {
    throw new Error("有料エリア開始位置は本文に1か所だけ設定してください。");
  }
  if (draft.articleType === "free" && paidMarkers.length > 0) {
    throw new Error("無料記事には有料エリア開始位置を入れないでください。");
  }

  const markerOrders = [...draft.body.matchAll(/<!--\s*IMAGE:0*(\d+)\s*-->/gi)]
    .map((match) => Number(match[1]))
    .filter((order) => Number.isSafeInteger(order));
  if (!draft.inlineEnabled && markerOrders.length > 0) {
    throw new Error("挿絵をOFFにしているため、本文の挿絵マーカーを削除してください。");
  }
  if (draft.inlineEnabled && draft.body.trim()) {
    for (let order = 1; order <= draft.inlineCount; order += 1) {
      const occurrences = markerOrders.filter((value) => value === order).length;
      if (occurrences === 0) {
        throw new Error(`挿絵${order}の差し込み位置が本文にありません。`);
      }
      if (occurrences > 1) {
        throw new Error(`挿絵${order}の差し込み位置が重複しています。`);
      }
    }
    const unexpected = markerOrders.find((order) => order < 1 || order > draft.inlineCount);
    if (unexpected !== undefined) {
      throw new Error(`設定枚数に含まれない挿絵${unexpected}のマーカーがあります。`);
    }
    const expectedOrder = Array.from({ length: draft.inlineCount }, (_unused, index) => index + 1);
    if (markerOrders.length !== expectedOrder.length || markerOrders.some((order, index) => order !== expectedOrder[index])) {
      throw new Error("挿絵マーカーは本文内で挿絵1→挿絵2→…の順に1回ずつ配置してください。");
    }
  }

  if (draft.articleType === "free") draft.price = null;
  if (!draft.inlineEnabled) draft.inlineCount = 0;
  return draft;
}

export async function createArticleFromWizard(
  client: SupabaseClient,
  ownerId: string,
  input: ArticleCreationDraft,
  magazinePlan?: MagazinePlanDraft,
  presetId?: string | null,
  creationContext?: ArticleCreationContext,
): Promise<CreatedArticle> {
  const draft = validateCreationDraft(input);
  if (draft.magazineEnabled) {
    if (draft.publicationTarget !== "note") {
      throw new Error("マガジン作成モードはnote向けに設定してください。");
    }
    if (!magazinePlan?.name.trim() || magazinePlan.articleTitles.length < 1) {
      throw new Error("マガジン構成案を選択してから記事を保存してください。");
    }
    if (draft.theme === "その他") {
      throw new Error("「その他」を選んだ場合はテーマ・キーワードを入力してください。");
    }
    const missingCustomMagazineField =
      (magazinePlan.audience === "other" && !magazinePlan.customAudience.trim())
      || (magazinePlan.direction === "other" && !magazinePlan.customDirection.trim())
      || (magazinePlan.publishingStyle === "other" && !magazinePlan.customPublishingStyle.trim())
      || (magazinePlan.monetizationLevel === "other" && !magazinePlan.customMonetizationLevel.trim())
      || (magazinePlan.orderStrategy === "other" && !magazinePlan.customOrderStrategy.trim())
      || magazinePlan.purpose === "その他";
    if (missingCustomMagazineField) {
      throw new Error("マガジンモードで「その他」を選んだ項目は内容を入力してください。");
    }
  }
  await requireAccess(client, ownerId);
  const writingProfile = getRuntimeWritingProfile();
  const customGenre = isCustomGenre(draft.genre);
  const customSubgenre = isCustomSubgenre(draft.genre, draft.subgenre);

  const article = {
    title: draft.title,
    publication_target: draft.publicationTarget,
    article_type: draft.articleType,
    genre: draft.genre || null,
    subgenre: draft.subgenre || null,
    body: draft.body,
    status: draft.saveStatus,
    price: draft.price,
    tags: draft.tags,
  };
  const imagePrompts = buildImagePromptPlan({
    title: draft.title,
    theme: draft.theme,
    publicationTarget: draft.publicationTarget,
    genre: draft.genre,
    subgenre: draft.subgenre,
    ageGroup: draft.ageGroup,
    gender: draft.gender,
    body: draft.body,
    coverEnabled: draft.coverEnabled,
    inlineEnabled: draft.inlineEnabled,
    inlineCount: draft.inlineCount,
    imageStyle: draft.imageStyle,
  });
  const knowledgeRuntime = getRuntimeKnowledgeState();
  const accountDesign = getRuntimePlatformAccountDesign(draft.publicationTarget);
  let workspaceJson: Record<string, unknown> = {
    wizard_version: 11,
    prompt_profile_version: 12,
    image_prompt_version: 13,
    knowledge_engine_version: 1,
    cloud_knowledge_channel: knowledgeRuntime.channel,
    cloud_knowledge_version: knowledgeRuntime.effectiveVersion,
    prompt_optimization_version: knowledgeRuntime.effectiveVersion,
    user_personalization_version: 2,
    personalization_enabled: writingProfile?.personalizationEnabled ?? false,
    article_preset_id: presetId ?? null,
    account_design_applied: Boolean(accountDesign),
    account_design_platform: accountDesign?.platform ?? null,
    account_design_updated_at: accountDesign?.updatedAt ?? null,
    selected_title: draft.title,
    generation_method: draft.generationMode,
    local_status: draft.saveStatus === "ready" ? "完成" : draft.saveStatus,
    local_updated_at: null,
    creation_source: creationContext?.source ?? null,
    note_membership_article_kind:
      creationContext?.source === "note-membership"
        ? creationContext.noteMembershipArticleKind
        : null,
  };

  if (draft.magazineEnabled && magazinePlan?.name) {
    workspaceJson = {
      ...workspaceJson,
      pwa_magazine_plan: {
        name: magazinePlan.name,
        audience: magazinePlan.audience,
        custom_audience: magazinePlan.customAudience || null,
        article_count: magazinePlan.articleCount,
        direction: magazinePlan.direction,
        custom_direction: magazinePlan.customDirection || null,
        publishing_style: magazinePlan.publishingStyle,
        custom_publishing_style: magazinePlan.customPublishingStyle || null,
        monetization_level: magazinePlan.monetizationLevel,
        custom_monetization_level: magazinePlan.customMonetizationLevel || null,
        order_strategy: magazinePlan.orderStrategy,
        custom_order_strategy: magazinePlan.customOrderStrategy || null,
        purpose: magazinePlan.purpose,
        article_titles: magazinePlan.articleTitles,
      },
    };
    if (draft.publicationTarget === "note") {
      const noteMagazine: NoteMagazineSettings = {
        enabled: true,
        name: magazinePlan.name,
        type: magazinePlan.monetizationLevel === "sales"
          ? "paid"
          : magazinePlan.monetizationLevel === "balanced"
            ? "mixed"
            : "free",
        seriesName: magazinePlan.name,
        order: 1,
        role: "intro",
      };
      workspaceJson = withNoteMagazineWorkspace(workspaceJson, noteMagazine);
    }
  }

  const workspace = {
    request_json: {
      platform: targetName[draft.publicationTarget],
      article_type: draft.articleType === "paid" ? "有料" : "無料",
      genre: draft.genre,
      subgenre: draft.subgenre,
      genre_source: customGenre ? "custom" : "preset",
      subgenre_source: customSubgenre ? "custom" : "preset",
      age_group: draft.ageGroup,
      gender: draft.gender,
      target_length: draft.targetLength,
      price_jpy: draft.price,
      image_style: draft.imageStyle,
      affiliate_enabled: draft.affiliateEnabled,
      magazine_enabled: draft.magazineEnabled,
      magazine_name: draft.magazineEnabled ? magazinePlan?.name || null : null,
      magazine_article_count: draft.magazineEnabled ? magazinePlan?.articleCount ?? null : null,
      magazine_direction: draft.magazineEnabled ? magazinePlan?.direction ?? null : null,
      magazine_custom_direction: draft.magazineEnabled ? magazinePlan?.customDirection || null : null,
      magazine_audience: draft.magazineEnabled ? magazinePlan?.audience ?? null : null,
      magazine_custom_audience: draft.magazineEnabled ? magazinePlan?.customAudience || null : null,
      theme: draft.theme,
      tags: draft.tags,
      generation_method: draft.generationMode,
      ai_provider: writingProfile?.preferredAi ?? null,
      ai_plan: writingProfile?.preferredPlan ?? null,
      account_design_applied: Boolean(accountDesign),
      account_design_updated_at: accountDesign?.updatedAt ?? null,
    },
    workspace_json: workspaceJson,
    image_plan_json: {
      enabled: draft.coverEnabled || draft.inlineEnabled,
      cover: {
        enabled: draft.coverEnabled,
        required: draft.coverEnabled,
      },
      inline: {
        enabled: draft.inlineEnabled,
        count: draft.inlineCount,
      },
      style: draft.imageStyle,
      prompt_plan: imagePrompts,
    },
    source_body: draft.body || null,
    publish_body: normalizePublicationMarkers(draft.body, {
      articleType: draft.articleType,
      inlineEnabled: draft.inlineEnabled,
      inlineCount: draft.inlineCount,
    }) || null,
  };

  const { data, error } = await client.rpc("create_article_with_workspace", {
    p_article: article,
    p_workspace: workspace,
  });
  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (message.includes("article_quota_exceeded")) {
      throw new Error("記事ストック上限に達しています。");
    }
    if (message.includes("active profile required")) {
      throw new Error("activeアカウントが必要です。");
    }
    throw new Error("記事の新規保存に失敗しました。");
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("記事作成結果が不正です。");
  }
  const articleRow = (result as Record<string, unknown>).article;
  if (!articleRow || typeof articleRow !== "object" || Array.isArray(articleRow)) {
    throw new Error("記事作成結果が不正です。");
  }
  const row = articleRow as Record<string, unknown>;
  if (
    row.user_id !== ownerId ||
    typeof row.id !== "string" ||
    typeof row.title !== "string" ||
    typeof row.revision !== "number"
  ) {
    throw new Error("作成記事の所有者または応答形式を確認できません。");
  }

  void recordPersonalizationSignal(client, {
    platform: draft.publicationTarget,
    genre: draft.genre,
    subgenre: draft.subgenre,
    articleType: draft.articleType,
    generationMode: draft.generationMode,
    ageGroup: draft.ageGroup,
    targetLength: draft.targetLength,
    presetId: presetId ?? null,
  }).catch(() => undefined);
  if (customGenre) {
    void recordKnowledgeCandidate(client, { kind: "genre", value: draft.genre }).catch(() => undefined);
  }
  if (customSubgenre) {
    void recordKnowledgeCandidate(client, { kind: "subgenre", parentValue: draft.genre, value: draft.subgenre }).catch(() => undefined);
  }

  return {
    id: row.id,
    title: row.title,
    revision: row.revision,
  };
}
