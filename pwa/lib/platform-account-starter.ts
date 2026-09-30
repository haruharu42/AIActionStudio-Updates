import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPlatformAccountPresetPromptContext } from "@/features/presets/platform-account-presets";
import { buildWorkspacePresetPromptContext } from "@/features/presets/workspace-presets";
import type { AiProvider } from "@/lib/user-personalization";
import {
  ACCOUNT_DESIGN_PLATFORMS,
  accountDesignLabels,
  type AccountDesignPlatform,
  type PlatformAccountDesign,
} from "@/lib/platform-account-design";

export type AccountStarterIcon = {
  direction: string;
  prompt: string;
  altText: string;
  suggestedFilename: string;
};

export type AccountStarterKit = {
  schema: "aas-account-starter-v1";
  platform: AccountDesignPlatform;
  accountNameCandidates: string[];
  handleCandidates: string[];
  tagline: string;
  profile: string;
  concept: string;
  contentPillars: string[];
  freePostIdeas: string[];
  paidPostIdeas: string[];
  launchChecklist: string[];
  icon: AccountStarterIcon;
  warnings: string[];
  updatedAt: string | null;
};

const STARTER_COLUMNS = "user_id,platform,kit,updated_at";

function providerName(provider: AiProvider): string {
  return provider === "gemini" ? "Gemini" : provider === "claude" ? "Claude" : "ChatGPT";
}

function providerSearchInstruction(provider: AiProvider): string {
  return provider === "gemini"
    ? "Google検索/グラウンディング等、現在利用できるWeb検索機能を必ず使う"
    : "Web検索機能が利用できる場合は必ず使う";
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const raw of value) {
    const item = text(raw, maxLength);
    if (!item || result.includes(item)) continue;
    result.push(item);
    if (result.length >= maxItems) break;
  }
  return result;
}

function platformValue(value: unknown, fallback: AccountDesignPlatform): AccountDesignPlatform {
  return value === "note" || value === "tips" || value === "brain" ? value : fallback;
}

function filename(value: unknown, platform: AccountDesignPlatform): string {
  const raw = text(value, 120).replace(/[\\/:*?"<>|]/g, "-");
  return raw || `aas-${platform}-account-icon.png`;
}

export function emptyAccountStarterKit(platform: AccountDesignPlatform): AccountStarterKit {
  return {
    schema: "aas-account-starter-v1",
    platform,
    accountNameCandidates: [],
    handleCandidates: [],
    tagline: "",
    profile: "",
    concept: "",
    contentPillars: [],
    freePostIdeas: [],
    paidPostIdeas: [],
    launchChecklist: [],
    icon: { direction: "", prompt: "", altText: "", suggestedFilename: `aas-${platform}-account-icon.png` },
    warnings: [],
    updatedAt: null,
  };
}

export function parseAccountStarterKit(value: unknown, expectedPlatform: AccountDesignPlatform): AccountStarterKit {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI回答のアカウント作成データ形式を確認できませんでした。");
  }
  const root = value as Record<string, unknown>;
  if (root.schema !== "aas-account-starter-v1") {
    throw new Error("AAS用アカウント一括作成データではありません。");
  }
  const platform = platformValue(root.platform, expectedPlatform);
  if (platform !== expectedPlatform) {
    throw new Error("選択中の掲載先とAI回答の掲載先が一致しません。");
  }
  const iconRoot = root.icon && typeof root.icon === "object" && !Array.isArray(root.icon)
    ? root.icon as Record<string, unknown>
    : {};
  const kit: AccountStarterKit = {
    schema: "aas-account-starter-v1",
    platform,
    accountNameCandidates: stringList(root.account_name_candidates ?? root.accountNameCandidates, 5, 120),
    handleCandidates: stringList(root.handle_candidates ?? root.handleCandidates, 5, 40),
    tagline: text(root.tagline, 180),
    profile: text(root.profile, 1200),
    concept: text(root.concept, 600),
    contentPillars: stringList(root.content_pillars ?? root.contentPillars, 8, 180),
    freePostIdeas: stringList(root.free_post_ideas ?? root.freePostIdeas, 12, 220),
    paidPostIdeas: stringList(root.paid_post_ideas ?? root.paidPostIdeas, 8, 220),
    launchChecklist: stringList(root.launch_checklist ?? root.launchChecklist, 16, 220),
    icon: {
      direction: text(iconRoot.direction, 500),
      prompt: text(iconRoot.prompt, 3000),
      altText: text(iconRoot.alt_text ?? iconRoot.altText, 300),
      suggestedFilename: filename(iconRoot.suggested_filename ?? iconRoot.suggestedFilename, platform),
    },
    warnings: stringList(root.warnings, 10, 300),
    updatedAt: null,
  };
  if (kit.accountNameCandidates.length < 1 || !kit.profile || !kit.concept || kit.contentPillars.length < 2 || !kit.icon.prompt) {
    throw new Error("AI回答にアカウント名・プロフィール・発信軸・アイコン設計が不足しています。AASの一括作成プロンプトをそのままAIへ渡してください。");
  }
  return kit;
}

function jsonCandidates(input: string): string[] {
  const result = [input.trim()];
  for (const match of input.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    if (match[1]?.trim()) result.push(match[1].trim());
  }
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");
  if (start >= 0 && end > start) result.push(input.slice(start, end + 1));
  return [...new Set(result.filter(Boolean))];
}

export function extractAccountStarterKit(input: string, platform: AccountDesignPlatform): AccountStarterKit {
  if (!input.trim()) throw new Error("AI回答を貼り付けてください。");
  for (const candidate of jsonCandidates(input)) {
    try {
      return parseAccountStarterKit(JSON.parse(candidate) as unknown, platform);
    } catch {
      // Continue. Providers can wrap JSON in short prose or Markdown fences.
    }
  }
  throw new Error("AI回答からAAS用アカウント一括作成JSONを見つけられませんでした。回答全文を削らず、そのまま読み込んでください。");
}

export function buildAccountStarterPrompt(design: PlatformAccountDesign, provider: AiProvider): string {
  const labels = accountDesignLabels(design);
  const platformName = ACCOUNT_DESIGN_PLATFORMS.find((item) => item.value === design.platform)?.label ?? design.platform;
  const topics = design.mainTopics.length ? design.mainTopics.join(" / ") : "未指定";
  const experience = design.experienceNote.trim() || "未指定";
  const workspacePresetContext = buildWorkspacePresetPromptContext("account_design");
  const accountPresetContext = buildPlatformAccountPresetPromptContext(design.platform);
  return `あなたは日本の${platformName}運営に詳しい編集者・ブランド設計者です。
目的は、これから${platformName}を始める初心者のために「アカウント作成直後から運営を開始できる一式」を設計し、AI Action Studio（AAS）が読み込めるJSONだけで返すことです。

【最新情報の確認】
- ${providerSearchInstruction(provider)}。
- ${platformName}の現在の登録・プロフィール・投稿機能に関わる公開情報を確認する。
- 仕様が確認できない項目は断定しない。ID/ユーザー名候補の利用可能性は保証せず、最終登録時に本人が確認する前提にする。

【保存済みアカウント設計】
- 掲載先: ${platformName}
- ジャンル: ${labels.genre}
- アカウント型: ${labels.style}
- 想定読者: ${labels.audience}
- 発信トーン: ${labels.tone}
- 収益化方針: ${labels.monetization}
- 運営目的: ${labels.goal}
- 信頼の作り方: ${labels.trust}
- コンテンツの中心: ${labels.contentFocus}
- 主なテーマ: ${topics}
- ユーザーが事実として入力した経験・資格・背景: ${experience}

${workspacePresetContext ? `${workspacePresetContext}

` : ""}${accountPresetContext ? `${accountPresetContext}

` : ""}【必須で作るもの】
1. アカウント表示名候補を3〜5個
2. ID/ユーザー名候補を3〜5個（空き状況を保証しない）
3. 一言キャッチコピー
4. そのまま編集して使えるプロフィール文
5. アカウントのコンセプト
6. 発信の柱を3〜6個
7. 最初の無料投稿案を5〜10個
8. 有料販売を行う方針の場合のみ、有料投稿案を0〜5個
9. アカウント登録から初投稿までのチェックリスト
10. このアカウント専用アイコンの設計。アイコンは正方形・小サイズでも識別しやすく、文字や実在ロゴに頼らないオリジナル案にする。
11. アイコン画像生成プロンプト。既存作品、特定作家、実在人物、企業ロゴ、商標、著名キャラクターに似せない。

【絶対ルール】
- ユーザーが入力していない実績・資格・体験・売上・レビューを事実として作らない。
- 競合アカウント名やプロフィール文をコピー・近似模倣しない。
- 成果、売上、フォロワー増加を保証しない。
- メールアドレス、パスワード、Cookie、アクセストークン、認証コード等を要求しない。
- アイコンにプラットフォーム公式ロゴや第三者商標を入れない。
- 最終回答は説明文やMarkdownを付けず、JSONオブジェクト1個だけを返す。

{
  "schema": "aas-account-starter-v1",
  "platform": "${design.platform}",
  "account_name_candidates": ["候補1", "候補2", "候補3"],
  "handle_candidates": ["candidate_1", "candidate_2", "candidate_3"],
  "tagline": "一言キャッチコピー",
  "profile": "プロフィール文",
  "concept": "アカウントのコンセプト",
  "content_pillars": ["発信の柱1", "発信の柱2", "発信の柱3"],
  "free_post_ideas": ["無料投稿案1", "無料投稿案2", "無料投稿案3", "無料投稿案4", "無料投稿案5"],
  "paid_post_ideas": [],
  "launch_checklist": ["登録", "表示名設定", "ID確認", "プロフィール設定", "アイコン設定", "初投稿"],
  "icon": {
    "direction": "アイコンのビジュアル方針",
    "prompt": "画像生成AIへそのまま渡せる詳細プロンプト",
    "alt_text": "アイコンの説明",
    "suggested_filename": "aas-${design.platform}-account-icon.png"
  },
  "warnings": ["ID候補の空き状況は登録時に確認する"]
}

使用AI: ${providerName(provider)}`;
}

function kitPayload(kit: AccountStarterKit): Record<string, unknown> {
  return {
    schema: kit.schema,
    platform: kit.platform,
    account_name_candidates: kit.accountNameCandidates,
    handle_candidates: kit.handleCandidates,
    tagline: kit.tagline,
    profile: kit.profile,
    concept: kit.concept,
    content_pillars: kit.contentPillars,
    free_post_ideas: kit.freePostIdeas,
    paid_post_ideas: kit.paidPostIdeas,
    launch_checklist: kit.launchChecklist,
    icon: {
      direction: kit.icon.direction,
      prompt: kit.icon.prompt,
      alt_text: kit.icon.altText,
      suggested_filename: kit.icon.suggestedFilename,
    },
    warnings: kit.warnings,
  };
}

export async function loadAccountStarterKits(
  client: SupabaseClient,
  userId: string,
): Promise<Partial<Record<AccountDesignPlatform, AccountStarterKit>>> {
  const { data, error } = await client
    .from("platform_account_starter_kits")
    .select(STARTER_COLUMNS)
    .eq("user_id", userId);
  if (error) throw new Error("アカウント一括作成データを読み込めませんでした。");
  const result: Partial<Record<AccountDesignPlatform, AccountStarterKit>> = {};
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    if (row.platform !== "note" && row.platform !== "tips" && row.platform !== "brain") continue;
    const kit = parseAccountStarterKit(row.kit, row.platform);
    kit.updatedAt = typeof row.updated_at === "string" ? row.updated_at : null;
    result[row.platform] = kit;
  }
  return result;
}

export async function saveAccountStarterKit(
  client: SupabaseClient,
  userId: string,
  kit: AccountStarterKit,
): Promise<AccountStarterKit> {
  const validated = parseAccountStarterKit(kitPayload(kit), kit.platform);
  const payload = kitPayload(validated);
  if (kit.updatedAt) {
    const { data, error } = await client
      .from("platform_account_starter_kits")
      .update({ kit: payload })
      .eq("user_id", userId)
      .eq("platform", kit.platform)
      .eq("updated_at", kit.updatedAt)
      .select(STARTER_COLUMNS)
      .maybeSingle();
    if (error) throw new Error("アカウント一括作成データを保存できませんでした。");
    if (!data) throw new Error("別の画面または端末でアカウント一括作成データが更新されています。再読み込みしてから保存してください。");
    const saved = parseAccountStarterKit((data as Record<string, unknown>).kit, kit.platform);
    saved.updatedAt = typeof (data as Record<string, unknown>).updated_at === "string" ? (data as Record<string, unknown>).updated_at as string : null;
    return saved;
  }
  const { data, error } = await client
    .from("platform_account_starter_kits")
    .insert({ user_id: userId, platform: kit.platform, kit: payload })
    .select(STARTER_COLUMNS)
    .single();
  if (error || !data) {
    if (typeof error?.code === "string" && error.code === "23505") {
      throw new Error("別の画面または端末で先に保存されています。再読み込みしてからお試しください。");
    }
    throw new Error("アカウント一括作成データを保存できませんでした。");
  }
  const saved = parseAccountStarterKit((data as Record<string, unknown>).kit, kit.platform);
  saved.updatedAt = typeof (data as Record<string, unknown>).updated_at === "string" ? (data as Record<string, unknown>).updated_at as string : null;
  return saved;
}

export function applyStarterKitToDesign(
  design: PlatformAccountDesign,
  kit: AccountStarterKit,
  accountName?: string,
): PlatformAccountDesign {
  return {
    ...design,
    displayName: (accountName || kit.accountNameCandidates[0] || design.displayName).slice(0, 120),
    profileDraft: kit.profile.slice(0, 1200),
    mainTopics: kit.contentPillars.slice(0, 8),
  };
}
