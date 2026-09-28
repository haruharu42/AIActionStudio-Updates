import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspacePresetKey =
  | "balanced"
  | "note_growth"
  | "longform"
  | "sns_growth"
  | "aas_official";

export type WorkspacePresetPreference = {
  userId: string;
  presetKey: WorkspacePresetKey;
  applyArticle: boolean;
  applyImages: boolean;
  applySns: boolean;
  applyNote: boolean;
  applyWorkflow: boolean;
  applyAccountDesign: boolean;
  updatedAt: string | null;
};

export type WorkspacePresetDefinition = {
  key: WorkspacePresetKey;
  label: string;
  description: string;
  badge: string;
  adminOnly: boolean;
  promptLines: readonly string[];
  article: {
    publicationTarget?: "note" | "tips" | "brain" | "blog";
    articleType?: "free" | "paid";
    genre?: string;
    targetLength?: number;
    coverEnabled?: boolean;
    inlineEnabled?: boolean;
    inlineCount?: number;
    tags?: readonly string[];
  };
  images: {
    coverEnabled?: boolean;
    inlineEnabled?: boolean;
    inlineCount?: number;
    styleContext?: string;
  };
  social: {
    preferredPlatform?: "x" | "instagram" | "threads" | "tiktok" | "youtube";
    targetCharacters: Readonly<Record<"x" | "instagram" | "threads" | "tiktok" | "youtube", number>>;
  };
  note: {
    genre?: string;
    style?: string;
    audience?: string;
    tone?: string;
    monetization?: string;
    goal?: string;
    topics?: readonly string[];
  };
  workflow: {
    defaultSeriesCount: number;
    reuseDelayDays: Readonly<Record<"x" | "instagram" | "threads" | "tiktok" | "youtube", number>>;
  };
};

const DEFAULT_SOCIAL = {
  x: 280,
  instagram: 300,
  threads: 500,
  tiktok: 150,
  youtube: 300,
} as const;

const DEFAULT_DELAYS = {
  x: 0,
  threads: 1,
  instagram: 2,
  tiktok: 3,
  youtube: 4,
} as const;

export const WORKSPACE_PRESETS: Readonly<Record<WorkspacePresetKey, WorkspacePresetDefinition>> = {
  balanced: {
    key: "balanced",
    label: "バランス運営",
    description: "記事・画像・SNSを偏らせず、AASの標準的な使い方に合わせます。",
    badge: "標準",
    adminOnly: false,
    promptLines: [
      "今回入力された記事条件・読者・掲載先を最優先する",
      "読みやすさ・正確さ・過度に煽らない表現のバランスを取る",
      "記事から画像・SNSへ展開しても主張や事実関係を変えない",
    ],
    article: {
      targetLength: 5000,
      coverEnabled: true,
      inlineEnabled: false,
      inlineCount: 2,
    },
    images: {
      coverEnabled: true,
      inlineEnabled: false,
      inlineCount: 2,
    },
    social: { targetCharacters: DEFAULT_SOCIAL },
    note: {},
    workflow: { defaultSeriesCount: 6, reuseDelayDays: DEFAULT_DELAYS },
  },
  note_growth: {
    key: "note_growth",
    label: "note継続・読者成長",
    description: "無料noteを軸に継続し、SNSとシリーズで読者との接点を増やします。",
    badge: "note",
    adminOnly: false,
    promptLines: [
      "noteで継続して読まれることを優先し、1記事だけで完結させすぎず次の記事へ自然につなぐ",
      "無料記事では先に価値を提供し、有料導線を作る場合も過度に煽らない",
      "SNSでは記事本文のコピペではなく、要点・学び・問いかけへ再構成する",
    ],
    article: {
      publicationTarget: "note",
      articleType: "free",
      targetLength: 4000,
      coverEnabled: true,
      inlineEnabled: true,
      inlineCount: 2,
    },
    images: {
      coverEnabled: true,
      inlineEnabled: true,
      inlineCount: 2,
    },
    social: {
      preferredPlatform: "x",
      targetCharacters: { ...DEFAULT_SOCIAL, x: 280, instagram: 300, threads: 500 },
    },
    note: {
      style: "初心者向け解説・実践記録を中心に継続発信する",
      audience: "テーマに興味がある初心者〜継続して学びたい読者",
      tone: "親しみやすい・丁寧",
      monetization: "無料記事を軸に、深掘りが必要な内容だけ有料へ自然につなぐ",
      goal: "読者を増やしたい",
    },
    workflow: {
      defaultSeriesCount: 6,
      reuseDelayDays: { ...DEFAULT_DELAYS, x: 0, threads: 1, instagram: 2, tiktok: 4, youtube: 5 },
    },
  },
  longform: {
    key: "longform",
    label: "長文・深掘り",
    description: "専門性・比較・手順を丁寧に整理する長文記事向けです。",
    badge: "長文",
    adminOnly: false,
    promptLines: [
      "結論だけでなく背景・理由・具体例・手順を整理し、章同士の重複を減らす",
      "長文でも読者が現在地を見失わない見出し構造にする",
      "数値・価格・仕様など変動情報は未確認のまま断定しない",
    ],
    article: {
      targetLength: 8000,
      coverEnabled: true,
      inlineEnabled: true,
      inlineCount: 3,
    },
    images: {
      coverEnabled: true,
      inlineEnabled: true,
      inlineCount: 3,
    },
    social: {
      targetCharacters: { ...DEFAULT_SOCIAL, x: 1000, instagram: 600, threads: 1000, youtube: 1000 },
    },
    note: {
      style: "専門的な解説・深掘り",
      tone: "落ち着いた・専門的",
    },
    workflow: {
      defaultSeriesCount: 8,
      reuseDelayDays: { ...DEFAULT_DELAYS, x: 0, threads: 2, instagram: 3, tiktok: 5, youtube: 6 },
    },
  },
  sns_growth: {
    key: "sns_growth",
    label: "SNS展開重視",
    description: "記事公開後のX・Threads・Instagram・動画系への再利用を重視します。",
    badge: "SNS",
    adminOnly: false,
    promptLines: [
      "記事公開後のSNS再利用を前提に、冒頭フック・要点・CTAを切り出しやすい構成にする",
      "媒体ごとに同じ文章を使い回さず、読まれ方に合わせて再構成する",
      "SNSから元記事へ誘導する場合も、投稿単体で価値が分かる内容を含める",
    ],
    article: {
      targetLength: 3500,
      coverEnabled: true,
      inlineEnabled: true,
      inlineCount: 2,
    },
    images: {
      coverEnabled: true,
      inlineEnabled: true,
      inlineCount: 2,
    },
    social: {
      preferredPlatform: "x",
      targetCharacters: { x: 280, instagram: 600, threads: 500, tiktok: 300, youtube: 600 },
    },
    note: {},
    workflow: {
      defaultSeriesCount: 5,
      reuseDelayDays: { x: 0, threads: 1, instagram: 1, tiktok: 2, youtube: 3 },
    },
  },
  aas_official: {
    key: "aas_official",
    label: "AI Action Studio（AAS）公式運営",
    description: "AASの使い方・開発進捗・実運用テスト・公開予告を発信する管理者専用プリセットです。",
    badge: "ADMIN",
    adminOnly: true,
    promptLines: [
      "AI Action Studio（AAS）自体の公式発信として、使い方・副業専用プロンプト・Knowledge・開発進捗・実運用テスト・アップデートを分かりやすく伝える",
      "販売前・テスト中は購入可能と誤認させず、未確定の価格・公開日・販売URLを作らない",
      "実際に確認していないPV・売上・ユーザー反応・レビュー・改善効果を作らない",
      "読者はAI記事制作やnote・Tips・Brain運営を始めたい初心者〜個人クリエイターを中心に想定する",
      "落ち着いた信頼感のある文体で、機能紹介だけでなく実際の使い方と運営上の価値を具体的に伝える",
    ],
    article: {
      publicationTarget: "note",
      articleType: "free",
      genre: "AI・テクノロジー",
      targetLength: 4500,
      coverEnabled: true,
      inlineEnabled: true,
      inlineCount: 2,
      tags: [
        "AI Action Studio",
        "AAS",
        "AI記事作成",
        "note運営",
        "コンテンツ運営",
        "AASアップデート",
      ],
    },
    images: {
      coverEnabled: true,
      inlineEnabled: true,
      inlineCount: 2,
      styleContext: "AAS公式発信では、白・明るいブルー・濃いネイビーを基調に、清潔感のあるSaaS/制作ツールらしい画面・記事制作・AI支援のモチーフを優先する。特定企業のロゴや既存製品UIを模倣しない。",
    },
    social: {
      preferredPlatform: "x",
      targetCharacters: { x: 280, instagram: 600, threads: 500, tiktok: 300, youtube: 600 },
    },
    note: {
      genre: "AI Action Studio（AAS）・AI副業・コンテンツ制作・運営支援",
      style: "AASの使い方・副業専用プロンプト・Knowledge・開発進捗・実運用テストを分かりやすく整理する",
      audience: "note・Tips・BrainなどでAIを使って記事制作・コンテンツ運営を始めたい初心者〜個人クリエイター",
      tone: "落ち着いた・信頼感重視",
      monetization: "販売前は無料発信で使い方・開発進捗・実運用テストを共有し、公開後は製品案内や必要に応じた有料コンテンツへ自然につなぐ",
      goal: "読者を増やしたい",
      topics: [
        "AI Action Studio",
        "AASアップデート",
        "AI記事作成",
        "note運営",
        "Tips・Brain運営",
        "プロンプト活用",
        "記事ライブラリ",
        "画像計画",
        "公開前チェック",
        "SNS再利用",
        "実運用テスト",
        "コンテンツ運営",
      ],
    },
    workflow: {
      defaultSeriesCount: 6,
      reuseDelayDays: { x: 0, threads: 1, instagram: 2, tiktok: 3, youtube: 4 },
    },
  },
};

let runtimePreference: WorkspacePresetPreference | null = null;

export function createDefaultWorkspacePresetPreference(userId: string): WorkspacePresetPreference {
  return {
    userId,
    presetKey: "balanced",
    applyArticle: true,
    applyImages: true,
    applySns: true,
    applyNote: true,
    applyWorkflow: true,
    applyAccountDesign: true,
    updatedAt: null,
  };
}

export function availableWorkspacePresets(isAdmin: boolean): WorkspacePresetDefinition[] {
  return (Object.values(WORKSPACE_PRESETS) as WorkspacePresetDefinition[])
    .filter((preset) => !preset.adminOnly || isAdmin);
}

function isPresetKey(value: unknown): value is WorkspacePresetKey {
  return typeof value === "string" && value in WORKSPACE_PRESETS;
}

function parsePreference(userId: string, row: unknown, isAdmin: boolean): WorkspacePresetPreference {
  const source = row && typeof row === "object" && !Array.isArray(row)
    ? row as Record<string, unknown>
    : {};
  const rawKey = isPresetKey(source.preset_key) ? source.preset_key : "balanced";
  const presetKey = rawKey === "aas_official" && !isAdmin ? "balanced" : rawKey;
  return {
    userId,
    presetKey,
    applyArticle: source.apply_article !== false,
    applyImages: source.apply_images !== false,
    applySns: source.apply_sns !== false,
    applyNote: source.apply_note !== false,
    applyWorkflow: source.apply_workflow !== false,
    applyAccountDesign: source.apply_account_design !== false,
    updatedAt: typeof source.updated_at === "string" ? source.updated_at : null,
  };
}

export async function loadWorkspacePresetPreference(
  client: SupabaseClient,
  userId: string,
  isAdmin: boolean,
): Promise<WorkspacePresetPreference> {
  const { data, error } = await client
    .from("user_workspace_preset_preferences")
    .select("user_id,preset_key,apply_article,apply_images,apply_sns,apply_note,apply_workflow,apply_account_design,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("共通プリセット設定を読み込めませんでした。");
  return data ? parsePreference(userId, data, isAdmin) : createDefaultWorkspacePresetPreference(userId);
}

export async function saveWorkspacePresetPreference(
  client: SupabaseClient,
  preference: WorkspacePresetPreference,
  isAdmin: boolean,
): Promise<WorkspacePresetPreference> {
  const presetKey = preference.presetKey === "aas_official" && !isAdmin
    ? "balanced"
    : preference.presetKey;
  const payload = {
    user_id: preference.userId,
    preset_key: presetKey,
    apply_article: preference.applyArticle,
    apply_images: preference.applyImages,
    apply_sns: preference.applySns,
    apply_note: preference.applyNote,
    apply_workflow: preference.applyWorkflow,
    apply_account_design: preference.applyAccountDesign,
  };
  const { data, error } = await client
    .from("user_workspace_preset_preferences")
    .upsert(payload, { onConflict: "user_id" })
    .select("user_id,preset_key,apply_article,apply_images,apply_sns,apply_note,apply_workflow,apply_account_design,updated_at")
    .single();
  if (error || !data) throw new Error("共通プリセット設定を保存できませんでした。");
  const parsed = parsePreference(preference.userId, data, isAdmin);
  setRuntimeWorkspacePresetPreference(parsed);
  return parsed;
}

export async function resetWorkspacePresetPreference(
  client: SupabaseClient,
  userId: string,
): Promise<WorkspacePresetPreference> {
  const { error } = await client
    .from("user_workspace_preset_preferences")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error("共通プリセット設定を初期化できませんでした。");
  const next = createDefaultWorkspacePresetPreference(userId);
  setRuntimeWorkspacePresetPreference(next);
  return next;
}

export function setRuntimeWorkspacePresetPreference(preference: WorkspacePresetPreference | null): void {
  runtimePreference = preference;
}

export function getRuntimeWorkspacePresetPreference(): WorkspacePresetPreference | null {
  return runtimePreference;
}

export function getRuntimeWorkspacePresetDefinition(): WorkspacePresetDefinition {
  return runtimePreference
    ? WORKSPACE_PRESETS[runtimePreference.presetKey]
    : WORKSPACE_PRESETS.balanced;
}

export function workspacePresetAppliesTo(
  feature: "article" | "images" | "sns" | "note" | "workflow" | "account_design",
): boolean {
  if (!runtimePreference) return false;

  // Article-specific conditions are intentionally kept out of the shared
  // workspace preset. Article creation now uses the fixed platform account
  // preset plus the seven-step per-article inputs instead.
  if (feature === "article") return false;

  return {
    article: false,
    images: runtimePreference.applyImages,
    sns: runtimePreference.applySns,
    note: runtimePreference.applyNote,
    workflow: runtimePreference.applyWorkflow,
    account_design: runtimePreference.applyAccountDesign,
  }[feature];
}

export function buildWorkspacePresetPromptContext(task: string): string {
  if (!runtimePreference) return "";
  const preset = WORKSPACE_PRESETS[runtimePreference.presetKey];
  const feature =
    task === "image" ? "images"
      : task === "sns" || task === "promotion" ? "sns"
        : task === "note" ? "note"
          : task === "account_design" ? "account_design"
            : task === "article" || task === "title" ? "article"
              : "workflow";
  if (!workspacePresetAppliesTo(feature)) return "";
  return [
    "【AAS共通プリセット】",
    `プリセット: ${preset.label}`,
    ...preset.promptLines.map((line) => `- ${line}`),
    "- 今回の画面でユーザーが明示的に指定した条件がある場合は、その指定をプリセットより優先する",
  ].join("\n");
}
