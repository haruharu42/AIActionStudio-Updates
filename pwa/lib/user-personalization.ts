import type { SupabaseClient } from "@supabase/supabase-js";

import { buildWorkspacePresetPromptContext } from "@/features/presets/workspace-presets";
import type { KnowledgeTask } from "@/lib/knowledge-engine";
import { compilePromptOptimizationContext } from "@/lib/prompt-optimization";

export type AiProvider = "chatgpt" | "claude" | "gemini";
export type AiPlan = "free" | "paid";
export type WritingTone = "balanced" | "friendly" | "professional" | "casual";
export type HeadingStyle = "balanced" | "short" | "descriptive";
export type ListPreference = "balanced" | "low" | "high";
export type CtaStyle = "balanced" | "soft" | "direct";
export type PreferredPlatform = "note" | "tips" | "brain" | "blog";

export type UserWritingProfile = {
  userId: string;
  personalizationEnabled: boolean;
  preferredAi: AiProvider;
  preferredPlan: AiPlan;
  tone: WritingTone;
  headingStyle: HeadingStyle;
  listPreference: ListPreference;
  ctaStyle: CtaStyle;
  avoidHype: boolean;
  preferredPlatform: PreferredPlatform | null;
  preferredGenre: string;
  personaContext: string;
  customInstructions: string;
  avoidPhrases: string;
  articleCount: number;
  platformCounts: Record<string, number>;
  genreCounts: Record<string, number>;
  subgenreCounts: Record<string, number>;
  articleTypeCounts: Record<string, number>;
  ageGroupCounts: Record<string, number>;
  targetLengthCounts: Record<string, number>;
  presetCounts: Record<string, number>;
  lastArticleType: "free" | "paid" | null;
  lastGenerationMode: "prompt_export" | "manual" | null;
  lastUsedAt: string | null;
  updatedAt: string | null;
};

const aiProviders = new Set<AiProvider>(["chatgpt", "claude", "gemini"]);
const aiPlans = new Set<AiPlan>(["free", "paid"]);
const tones = new Set<WritingTone>(["balanced", "friendly", "professional", "casual"]);
const headingStyles = new Set<HeadingStyle>(["balanced", "short", "descriptive"]);
const listPreferences = new Set<ListPreference>(["balanced", "low", "high"]);
const ctaStyles = new Set<CtaStyle>(["balanced", "soft", "direct"]);
const platforms = new Set<PreferredPlatform>(["note", "tips", "brain", "blog"]);

let runtimeProfile: UserWritingProfile | null = null;

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
};

export const AI_PLAN_LABELS: Record<AiPlan, string> = {
  free: "無料版",
  paid: "有料版",
};

export function createDefaultWritingProfile(userId: string): UserWritingProfile {
  return {
    userId,
    personalizationEnabled: false,
    preferredAi: "chatgpt",
    preferredPlan: "free",
    tone: "balanced",
    headingStyle: "balanced",
    listPreference: "balanced",
    ctaStyle: "balanced",
    avoidHype: true,
    preferredPlatform: null,
    preferredGenre: "",
    personaContext: "",
    customInstructions: "",
    avoidPhrases: "",
    articleCount: 0,
    platformCounts: {},
    genreCounts: {},
    subgenreCounts: {},
    articleTypeCounts: {},
    ageGroupCounts: {},
    targetLengthCounts: {},
    presetCounts: {},
    lastArticleType: null,
    lastGenerationMode: null,
    lastUsedAt: null,
    updatedAt: null,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numericCounts(value: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(asRecord(value))) {
    if (typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0) result[key] = raw;
  }
  return result;
}

function parseProfile(userId: string, row: unknown): UserWritingProfile {
  const data = asRecord(row);
  const preferredAi = typeof data.preferred_ai === "string" && aiProviders.has(data.preferred_ai as AiProvider)
    ? data.preferred_ai as AiProvider
    : "chatgpt";
  const preferredPlan = typeof data.preferred_plan === "string" && aiPlans.has(data.preferred_plan as AiPlan)
    ? data.preferred_plan as AiPlan
    : "free";
  const tone = typeof data.tone === "string" && tones.has(data.tone as WritingTone)
    ? data.tone as WritingTone
    : "balanced";
  const headingStyle = typeof data.heading_style === "string" && headingStyles.has(data.heading_style as HeadingStyle)
    ? data.heading_style as HeadingStyle
    : "balanced";
  const listPreference = typeof data.list_preference === "string" && listPreferences.has(data.list_preference as ListPreference)
    ? data.list_preference as ListPreference
    : "balanced";
  const ctaStyle = typeof data.cta_style === "string" && ctaStyles.has(data.cta_style as CtaStyle)
    ? data.cta_style as CtaStyle
    : "balanced";
  const preferredPlatform = typeof data.preferred_platform === "string" && platforms.has(data.preferred_platform as PreferredPlatform)
    ? data.preferred_platform as PreferredPlatform
    : null;

  return {
    userId,
    personalizationEnabled: data.personalization_enabled === true,
    preferredAi,
    preferredPlan,
    tone,
    headingStyle,
    listPreference,
    ctaStyle,
    avoidHype: data.avoid_hype !== false,
    preferredPlatform,
    preferredGenre: typeof data.preferred_genre === "string" ? data.preferred_genre.slice(0, 100) : "",
    personaContext: typeof data.persona_context === "string" ? data.persona_context.slice(0, 1200) : "",
    customInstructions: typeof data.custom_instructions === "string" ? data.custom_instructions.slice(0, 2400) : "",
    avoidPhrases: typeof data.avoid_phrases === "string" ? data.avoid_phrases.slice(0, 1200) : "",
    articleCount: typeof data.article_count === "number" && Number.isSafeInteger(data.article_count) && data.article_count >= 0 ? data.article_count : 0,
    platformCounts: numericCounts(data.platform_counts),
    genreCounts: numericCounts(data.genre_counts),
    subgenreCounts: numericCounts(data.subgenre_counts),
    articleTypeCounts: numericCounts(data.article_type_counts),
    ageGroupCounts: numericCounts(data.age_group_counts),
    targetLengthCounts: numericCounts(data.target_length_counts),
    presetCounts: numericCounts(data.preset_counts),
    lastArticleType: data.last_article_type === "free" || data.last_article_type === "paid" ? data.last_article_type : null,
    lastGenerationMode: data.last_generation_mode === "prompt_export" || data.last_generation_mode === "manual" ? data.last_generation_mode : null,
    lastUsedAt: typeof data.last_used_at === "string" ? data.last_used_at : null,
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
  };
}

export async function loadWritingProfile(
  client: SupabaseClient,
  userId: string,
): Promise<UserWritingProfile> {
  const { data, error } = await client
    .from("user_writing_profiles")
    .select("user_id,personalization_enabled,preferred_ai,preferred_plan,tone,heading_style,list_preference,cta_style,avoid_hype,preferred_platform,preferred_genre,persona_context,custom_instructions,avoid_phrases,article_count,platform_counts,genre_counts,subgenre_counts,article_type_counts,age_group_counts,target_length_counts,preset_counts,last_article_type,last_generation_mode,last_used_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error("あなた向け最適化の設定を取得できませんでした。");
  return data ? parseProfile(userId, data) : createDefaultWritingProfile(userId);
}

export async function saveWritingProfile(
  client: SupabaseClient,
  profile: UserWritingProfile,
): Promise<UserWritingProfile> {
  const payload = {
    user_id: profile.userId,
    personalization_enabled: profile.personalizationEnabled,
    preferred_ai: profile.preferredAi,
    preferred_plan: profile.preferredPlan,
    tone: profile.tone,
    heading_style: profile.headingStyle,
    list_preference: profile.listPreference,
    cta_style: profile.ctaStyle,
    avoid_hype: profile.avoidHype,
    preferred_platform: profile.preferredPlatform,
    preferred_genre: profile.preferredGenre.trim().slice(0, 100) || null,
    persona_context: profile.personaContext.trim().slice(0, 1200),
    custom_instructions: profile.customInstructions.trim().slice(0, 2400),
    avoid_phrases: profile.avoidPhrases.trim().slice(0, 1200),
  };
  const { data, error } = await client
    .from("user_writing_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("user_id,personalization_enabled,preferred_ai,preferred_plan,tone,heading_style,list_preference,cta_style,avoid_hype,preferred_platform,preferred_genre,persona_context,custom_instructions,avoid_phrases,article_count,platform_counts,genre_counts,subgenre_counts,article_type_counts,age_group_counts,target_length_counts,preset_counts,last_article_type,last_generation_mode,last_used_at,updated_at")
    .single();
  if (error || !data) throw new Error("あなた向け最適化の設定を保存できませんでした。");
  return parseProfile(profile.userId, data);
}

export async function resetWritingProfile(
  client: SupabaseClient,
  userId: string,
): Promise<UserWritingProfile> {
  const { error } = await client.from("user_writing_profiles").delete().eq("user_id", userId);
  if (error) throw new Error("あなた向け最適化の設定をリセットできませんでした。");
  const profile = createDefaultWritingProfile(userId);
  if (runtimeProfile?.userId === userId) runtimeProfile = profile;
  return profile;
}

export function setRuntimeWritingProfile(profile: UserWritingProfile | null): void {
  runtimeProfile = profile;
}

export function getRuntimeWritingProfile(): UserWritingProfile | null {
  return runtimeProfile;
}

function topCount(counts: Record<string, number>): string | null {
  const entry = Object.entries(counts)
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))[0];
  return entry ? `${entry[0]}（${entry[1]}回）` : null;
}

export function summarizeWritingProfile(profile: UserWritingProfile): string[] {
  const lines = [
    `使用AI: ${AI_PROVIDER_LABELS[profile.preferredAi]} / ${AI_PLAN_LABELS[profile.preferredPlan]}`,
    `個人最適化: ${profile.personalizationEnabled ? "ON" : "OFF"}`,
  ];
  if (profile.articleCount > 0) lines.push(`最適化ONで保存した記事: ${profile.articleCount}件`);
  const platform = topCount(profile.platformCounts);
  const genre = topCount(profile.genreCounts);
  const subgenre = topCount(profile.subgenreCounts);
  const ageGroup = topCount(profile.ageGroupCounts);
  const targetLength = topCount(profile.targetLengthCounts);
  if (platform) lines.push(`よく使う掲載先: ${platform}`);
  if (genre) lines.push(`よく使うジャンル: ${genre}`);
  if (subgenre) lines.push(`よく使うサブジャンル: ${subgenre}`);
  if (ageGroup) lines.push(`よく使う読者層: ${ageGroup}`);
  if (targetLength) lines.push(`よく使う文字数: 約${targetLength.replace(/（.*$/, "")}文字`);
  if (profile.personaContext || profile.customInstructions || profile.avoidPhrases) {
    lines.push("自分で指定した追加パーソナライズ: 設定済み");
  }
  return lines;
}

const providerRules: Record<AiProvider, string[]> = {
  chatgpt: [
    "指示・制約・出力形式を順番に処理し、指定されたMarkdown構造を厳密に守る",
    "最終出力前に、事実の創作・過度な断定・指定漏れがないか内部確認する",
  ],
  claude: [
    "長文でも章同士の論理と文体を一貫させ、自然な接続で読み進められる文章にする",
    "条件を省略せず、最終回答にはメタ説明を加えず指定された成果物だけを返す",
  ],
  gemini: [
    "与えられた条件と未確認情報を区別し、構造化されたMarkdownで要点を整理する",
    "見出し・表・箇条書きは必要性に応じて使い、指定された読者と掲載先を優先する",
  ],
};

const planRules: Record<AiPlan, string[]> = {
  free: [
    "無料版で扱いやすいよう、重複する指示や不要な前置きを削り、記事の必須条件・安全ルール・出力形式を最優先する",
    "複雑な検討を何段階も要求せず、1回の回答で安定して完結できる構成にする",
    "長文でも途中で説明方針を脱線させず、最終成果物だけを簡潔に返す",
  ],
  paid: [
    "与えられた詳細条件を最後まで保持し、構成・具体性・安全性・掲載先適合をまとめて高い粒度で確認する",
    "最終出力前に、見出しの重複、論理の飛躍、説明不足、同じ内容の言い換え反復がないか内部で推敲する",
    "読者の悩み→理解→判断→行動までの流れを内部で設計し、長文全体の一貫性を保ってから完成稿だけを返す",
    "ARTICLE BRIEFの条件をチェックリストとして内部確認し、指定漏れがない状態で最終出力する",
  ],
};

const toneRule: Record<WritingTone, string> = {
  balanced: "読みやすさと専門性のバランスを取る",
  friendly: "やさしく親しみやすいが、馴れ馴れしすぎない文章にする",
  professional: "簡潔で落ち着いた、専門性を感じる文章にする",
  casual: "会話に近い自然な文章にしつつ、情報の正確さを優先する",
};
const headingRule: Record<HeadingStyle, string> = {
  balanced: "見出しは内容が分かる自然な長さにする",
  short: "見出しは短く、一目で内容が分かる表現を優先する",
  descriptive: "見出しだけでも要点が分かる具体的な表現を優先する",
};
const listRule: Record<ListPreference, string> = {
  balanced: "文章と箇条書きを内容に応じて使い分ける",
  low: "箇条書きに偏らず、自然な本文説明を中心にする",
  high: "手順・比較・要点は積極的に箇条書きで整理する",
};
const ctaRule: Record<CtaStyle, string> = {
  balanced: "CTAは内容に合う自然な強さにする",
  soft: "CTAは押しつけず、読者が自分で選べる柔らかい表現にする",
  direct: "CTAは次に取る行動が明確に分かる直接的な表現にする",
};

function personalizationItems(value: string): string[] {
  return value
    .split(/\\r?\\n/)
    .map((item) => item.trim().replace(/^[-・]\\s*/, ""))
    .filter((item, index, items) => item.length > 0 && items.indexOf(item) === index);
}

function appendUserAuthoredPersonalization(lines: string[], profile: UserWritingProfile): void {
  const personaContext = personalizationItems(profile.personaContext);
  const customInstructions = personalizationItems(profile.customInstructions);
  const avoidPhrases = personalizationItems(profile.avoidPhrases);
  if (personaContext.length === 0 && customInstructions.length === 0 && avoidPhrases.length === 0) return;

  lines.push(
    "",
    "【ユーザーが明示した追加パーソナライズ】",
    "- 以下はユーザー本人がAASへ選択・入力した文章・回答の好み。今回の明示指示、事実確認、安全ルール、媒体ルールを上書きしない。",
    "- 記載されていない個人情報・経験・実績・感情は推測して補わない。",
  );
  for (const item of personaContext) lines.push(`- 執筆上の前提: ${item}`);
  for (const item of customInstructions) lines.push(`- 追加の文章・回答指示: ${item}`);
  for (const item of avoidPhrases) lines.push(`- 避けたい言葉・表現: ${item}`);
}

export function buildPersonalizationHandoffPrompt(
  profile: UserWritingProfile,
  provider: AiProvider = profile.preferredAi,
): string {
  const lines = [
    "【AAS パーソナライズ引き継ぎ】",
    `対象AI: ${AI_PROVIDER_LABELS[provider]}`,
    "以下はAI Action Studio（AAS）で私自身が設定した文章・回答の好みです。このチャット内の今後の回答に反映してください。",
    "ただし、今回の個別指示、事実確認、安全上の制約、利用サービスのルールを優先し、記載されていない私の経歴・体験・実績・感情は推測しないでください。",
    "",
    "【基本の文章設定】",
    `- ${toneRule[profile.tone]}`,
    `- ${headingRule[profile.headingStyle]}`,
    `- ${listRule[profile.listPreference]}`,
    `- ${ctaRule[profile.ctaStyle]}`,
  ];
  if (profile.avoidHype) lines.push("- 煽り表現・成果保証・過度な期待を持たせる表現を避ける");
  if (profile.preferredPlatform) lines.push(`- 普段よく使う掲載先: ${profile.preferredPlatform}`);
  if (profile.preferredGenre) lines.push(`- 普段よく扱うジャンル: ${profile.preferredGenre}`);

  appendUserAuthoredPersonalization(lines, profile);

  const providerNote: Record<AiProvider, string> = {
    chatgpt: "この文章はChatGPTのメモリやカスタム指示へ自動登録する依頼ではありません。通常チャット・一時チャットを問わず、この会話へ明示的に渡した設定として扱ってください。",
    claude: "この文章はClaudeのメモリやプロフィールへ自動登録する依頼ではありません。通常チャット・シークレットチャットを問わず、この会話へ明示的に渡した設定として扱ってください。",
    gemini: "この文章はGeminiのパーソナライズ設定へ自動登録する依頼ではありません。通常チャット・一時チャットを問わず、この会話へ明示的に渡した設定として扱ってください。",
  };
  lines.push("", "【引き継ぎの扱い】", providerNote[provider]);
  return lines.join("\n");
}

export function buildUserPromptContext(
  profile: UserWritingProfile | null,
  task: KnowledgeTask = "article",
): string {
  const workspacePresetContext = buildWorkspacePresetPromptContext(task);
  if (!profile) return workspacePresetContext;
  const lines = [
    "【使用AI向けAAS最適化】",
    `使用AI: ${AI_PROVIDER_LABELS[profile.preferredAi]}`,
    `利用プラン: ${AI_PLAN_LABELS[profile.preferredPlan]}`,
    ...providerRules[profile.preferredAi].map((rule) => `- ${rule}`),
    ...planRules[profile.preferredPlan].map((rule) => `- ${rule}`),
  ];

  const cloudOptimization = compilePromptOptimizationContext(
    profile.preferredAi,
    profile.preferredPlan,
    task,
  );
  if (cloudOptimization) {
    lines.push("", cloudOptimization);
  }

  if (profile.personalizationEnabled) {
    lines.push(
      "",
      "【このユーザー向け文章設定】",
      `- ${toneRule[profile.tone]}`,
      `- ${headingRule[profile.headingStyle]}`,
      `- ${listRule[profile.listPreference]}`,
      `- ${ctaRule[profile.ctaStyle]}`,
    );
    if (profile.avoidHype) lines.push("- 煽り表現・過剰な期待を持たせる表現を特に避ける");
    if (profile.preferredPlatform) lines.push(`- 通常よく使う掲載先: ${profile.preferredPlatform}。今回のARTICLE BRIEF指定が異なる場合は今回指定を優先する`);
    if (profile.preferredGenre) lines.push(`- 通常よく使うジャンル: ${profile.preferredGenre}。今回のARTICLE BRIEF指定が異なる場合は今回指定を優先する`);
    appendUserAuthoredPersonalization(lines, profile);
    const learnedPlatform = topCount(profile.platformCounts);
    const learnedGenre = topCount(profile.genreCounts);
    const learnedSubgenre = topCount(profile.subgenreCounts);
    const learnedArticleType = topCount(profile.articleTypeCounts);
    const learnedAgeGroup = topCount(profile.ageGroupCounts);
    const learnedTargetLength = topCount(profile.targetLengthCounts);
    if (learnedPlatform) lines.push(`- 利用履歴上よく使う掲載先: ${learnedPlatform}`);
    if (learnedGenre) lines.push(`- 利用履歴上よく使うジャンル: ${learnedGenre}`);
    if (learnedSubgenre) lines.push(`- 利用履歴上よく使うサブジャンル: ${learnedSubgenre}`);
    if (learnedArticleType) lines.push(`- 利用履歴上よく使う記事タイプ: ${learnedArticleType}`);
    if (learnedAgeGroup) lines.push(`- 利用履歴上よく使う読者層: ${learnedAgeGroup}`);
    if (learnedTargetLength) lines.push(`- 利用履歴上よく使う文字数帯: 約${learnedTargetLength.replace(/（.*$/, "")}文字`);
    lines.push("- 利用履歴は補助的な好みとして扱い、今回のARTICLE BRIEFやユーザー指定が異なる場合は今回指定を優先する");
    lines.push("- この設定は文体・構成の好みとして扱い、絶対ルールや今回の記事条件より優先しない");
  }
  if (workspacePresetContext) lines.push("", workspacePresetContext);
  return lines.join("\n");
}

export async function recordPersonalizationSignal(
  client: SupabaseClient,
  input: {
    platform: PreferredPlatform;
    genre: string;
    subgenre?: string;
    articleType: "free" | "paid";
    generationMode: "prompt_export" | "manual";
    ageGroup?: string;
    targetLength?: number;
    presetId?: string | null;
  },
): Promise<void> {
  const richSignal = await client.rpc("record_my_article_workflow_signal", {
    p_platform: input.platform,
    p_genre: input.genre.trim().slice(0, 100) || null,
    p_subgenre: (input.subgenre ?? "AIおまかせ").trim().slice(0, 100) || "AIおまかせ",
    p_article_type: input.articleType,
    p_generation_mode: input.generationMode,
    p_age_group: (input.ageGroup ?? "AIおまかせ").trim().slice(0, 60) || "AIおまかせ",
    p_target_length: Number.isSafeInteger(input.targetLength) ? input.targetLength : 5000,
    p_preset_id: input.presetId ?? null,
  });

  if (!richSignal.error) return;

  const richErrorCode = String(richSignal.error.code ?? "").toUpperCase();
  const richErrorMessage = String(richSignal.error.message ?? "").toLowerCase();
  const missingRichRpc = richErrorCode === "PGRST202"
    || richErrorCode === "42883"
    || richErrorMessage.includes("record_my_article_workflow_signal")
      && (richErrorMessage.includes("not found") || richErrorMessage.includes("does not exist"));
  if (!missingRichRpc) {
    throw new Error("個人最適化の利用傾向を更新できませんでした。");
  }

  const legacy = await client.rpc("record_my_personalization_signal", {
    p_platform: input.platform,
    p_genre: input.genre.trim().slice(0, 100) || null,
    p_article_type: input.articleType,
    p_generation_mode: input.generationMode,
  });
  if (legacy.error) throw new Error("個人最適化の利用傾向を更新できませんでした。");
}
