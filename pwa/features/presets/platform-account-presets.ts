import type { SupabaseClient } from "@supabase/supabase-js";

export type PlatformAccountPresetPlatform = "note" | "tips" | "brain";

export type PlatformAccountPreset = {
  id: string;
  userId: string;
  platform: PlatformAccountPresetPlatform;
  presetName: string;
  accountName: string;
  accountHandle: string;
  genre: string;
  accountStyle: string;
  audience: string;
  tone: string;
  monetization: string;
  operationGoal: string;
  profileNote: string;
  mainTopics: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlatformAccountPresetDraft = Omit<
  PlatformAccountPreset,
  "id" | "createdAt" | "updatedAt"
> & { id?: string | null };

const SELECT_COLUMNS = "id,user_id,platform,preset_name,account_name,account_handle,genre,account_style,audience,tone,monetization,operation_goal,profile_note,main_topics,is_default,created_at,updated_at";

let runtimePresets: PlatformAccountPreset[] = [];

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function topics(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 16);
}

function platform(value: unknown): PlatformAccountPresetPlatform | null {
  return value === "note" || value === "tips" || value === "brain" ? value : null;
}

function parseRow(row: Record<string, unknown>): PlatformAccountPreset | null {
  const parsedPlatform = platform(row.platform);
  if (!parsedPlatform || typeof row.id !== "string" || typeof row.user_id !== "string") return null;
  const presetName = clean(row.preset_name, 80);
  if (!presetName) return null;
  return {
    id: row.id,
    userId: row.user_id,
    platform: parsedPlatform,
    presetName,
    accountName: clean(row.account_name, 120),
    accountHandle: clean(row.account_handle, 120),
    genre: clean(row.genre, 160),
    accountStyle: clean(row.account_style, 240),
    audience: clean(row.audience, 400),
    tone: clean(row.tone, 180),
    monetization: clean(row.monetization, 320),
    operationGoal: clean(row.operation_goal, 240),
    profileNote: clean(row.profile_note, 1600),
    mainTopics: topics(row.main_topics),
    isDefault: row.is_default === true,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}

export function emptyPlatformAccountPreset(
  userId: string,
  target: PlatformAccountPresetPlatform = "note",
): PlatformAccountPresetDraft {
  return {
    userId,
    platform: target,
    presetName: "",
    accountName: "",
    accountHandle: "",
    genre: "",
    accountStyle: "",
    audience: "",
    tone: "",
    monetization: "",
    operationGoal: "",
    profileNote: "",
    mainTopics: [],
    isDefault: false,
  };
}

export function createAasPlatformAccountPresetDraft(
  userId: string,
  target: PlatformAccountPresetPlatform,
): PlatformAccountPresetDraft {
  const platformLabel = target === "tips" ? "Tips" : target === "brain" ? "Brain" : "note";
  return {
    userId,
    platform: target,
    presetName: `AAS公式・${platformLabel}`,
    accountName: "AI Action Studio（AAS）",
    accountHandle: "",
    genre: "AI Action Studio（AAS）・AI副業・コンテンツ制作・運営支援",
    accountStyle: `${platformLabel}でAASの使い方・副業専用プロンプト・Knowledge・開発進捗・実運用テスト・アップデートを分かりやすく発信する`,
    audience: "AIで記事制作・note / Tips / Brain運営を始めたい初心者〜個人クリエイター",
    tone: "落ち着いた・信頼感重視・過度に煽らない",
    monetization: "販売前は無料発信を中心にし、公開後は製品案内や必要に応じた有料コンテンツへ自然につなぐ",
    operationGoal: "AASの認知・理解を増やし、副業ごとの使い方・Knowledge・更新内容を継続して伝える",
    profileNote: "AASの使い方、副業専用プロンプト、Knowledge、開発進捗、アップデート、実運用テスト、記事・SNS・画像・販売支援の知見を中心に発信する。未確認の実績・価格・公開日・レビューは作らない。",
    mainTopics: [
      "AI Action Studio",
      "AASアップデート",
      "AI記事作成",
      "note運営",
      "Tips・Brain運営",
      "記事ライブラリ",
      "画像計画",
      "公開前チェック",
      "SNS再利用",
      "実運用テスト",
      "コンテンツ運営",
    ],
    isDefault: false,
  };
}

export async function listPlatformAccountPresets(
  client: SupabaseClient,
  userId: string,
): Promise<PlatformAccountPreset[]> {
  const { data, error } = await client
    .from("user_platform_account_presets")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("platform", { ascending: true })
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw new Error("アカウント別プリセットを読み込めませんでした。");
  return (data ?? []).map((row) => parseRow(row as Record<string, unknown>)).filter((item): item is PlatformAccountPreset => Boolean(item));
}

export async function savePlatformAccountPreset(
  client: SupabaseClient,
  draft: PlatformAccountPresetDraft,
): Promise<PlatformAccountPreset> {
  const presetName = draft.presetName.trim().slice(0, 80);
  if (!presetName) throw new Error("プリセット名を入力してください。");

  if (draft.isDefault) {
    const { error: clearError } = await client
      .from("user_platform_account_presets")
      .update({ is_default: false })
      .eq("user_id", draft.userId)
      .eq("platform", draft.platform)
      .eq("is_default", true);
    if (clearError) throw new Error("既定アカウントの切り替え準備に失敗しました。");
  }

  const payload = {
    user_id: draft.userId,
    platform: draft.platform,
    preset_name: presetName,
    account_name: draft.accountName.trim().slice(0, 120),
    account_handle: draft.accountHandle.trim().slice(0, 120),
    genre: draft.genre.trim().slice(0, 160),
    account_style: draft.accountStyle.trim().slice(0, 240),
    audience: draft.audience.trim().slice(0, 400),
    tone: draft.tone.trim().slice(0, 180),
    monetization: draft.monetization.trim().slice(0, 320),
    operation_goal: draft.operationGoal.trim().slice(0, 240),
    profile_note: draft.profileNote.trim().slice(0, 1600),
    main_topics: [...new Set(draft.mainTopics.map((item) => item.trim()).filter(Boolean))].slice(0, 16),
    is_default: draft.isDefault,
  };

  const query = draft.id
    ? client.from("user_platform_account_presets").update(payload).eq("id", draft.id).eq("user_id", draft.userId)
    : client.from("user_platform_account_presets").insert(payload);

  const { data, error } = await query.select(SELECT_COLUMNS).single();
  if (error || !data) {
    throw new Error(error?.code === "23505"
      ? "同じ掲載先に同名のプリセットがあります。別のプリセット名にしてください。"
      : "アカウント別プリセットを保存できませんでした。");
  }
  const parsed = parseRow(data as Record<string, unknown>);
  if (!parsed) throw new Error("保存したアカウント別プリセットを確認できませんでした。");
  return parsed;
}

export async function deletePlatformAccountPreset(
  client: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("user_platform_account_presets")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error("アカウント別プリセットを削除できませんでした。");
}

export function setRuntimePlatformAccountPresets(presets: PlatformAccountPreset[] | null): void {
  runtimePresets = presets ? [...presets] : [];
}

export function getRuntimePlatformAccountPresets(): PlatformAccountPreset[] {
  return [...runtimePresets];
}

export function getDefaultPlatformAccountPreset(platformValue: string): PlatformAccountPreset | null {
  const parsedPlatform = platform(platformValue);
  if (!parsedPlatform) return null;
  return runtimePresets.find((item) => item.platform === parsedPlatform && item.isDefault) ?? null;
}

export function buildPlatformAccountPresetPromptContext(platformValue: string): string {
  const preset = getDefaultPlatformAccountPreset(platformValue);
  if (!preset) return "";
  return [
    "【ACCOUNT PRESET】",
    "この掲載先で現在選ばれているアカウント別プリセットを、記事・画像・SNS・シリーズ等の方向性へ反映する。",
    "今回の画面でユーザーが明示した条件と衝突する場合は、今回の明示条件を優先する。",
    `プリセット名: ${preset.presetName}`,
    `アカウント名: ${preset.accountName || "未指定"}`,
    preset.accountHandle ? `アカウントID/補足: ${preset.accountHandle}` : "",
    `ジャンル: ${preset.genre || "未指定"}`,
    `アカウント型: ${preset.accountStyle || "未指定"}`,
    `想定読者: ${preset.audience || "未指定"}`,
    `発信トーン: ${preset.tone || "未指定"}`,
    `収益化方針: ${preset.monetization || "未指定"}`,
    `運営目的: ${preset.operationGoal || "未指定"}`,
    `主なテーマ: ${preset.mainTopics.length ? preset.mainTopics.join(" / ") : "未指定"}`,
    preset.profileNote ? `プロフィール・運営メモ: ${preset.profileNote}` : "",
    "ここにない経験・実績・資格・レビュー・成果は事実として補完しない。",
  ].filter(Boolean).join("\n");
}
