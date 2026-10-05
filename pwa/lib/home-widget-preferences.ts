import type { SupabaseClient } from "@supabase/supabase-js";

export const HOME_WIDGET_KEYS = [
  "creator",
  "todayNote",
  "missions",
  "membership",
  "library",
  "releaseStatus",
  "hero",
  "quickStart",
  "articleSetup",
  "aiApps",
  "ranking",
  "quickActions",
] as const;

export type HomeWidgetKey = typeof HOME_WIDGET_KEYS[number];
export type HomeWidgetSize = "wide" | "half";

export type HomeWidgetItem = {
  key: HomeWidgetKey;
  size: HomeWidgetSize;
  visible: boolean;
};

export type HomeWidgetPreferences = {
  desktopLayout: HomeWidgetItem[];
  mobileLayout: HomeWidgetItem[];
};

export const HOME_WIDGET_LABELS: Record<HomeWidgetKey, string> = {
  creator: "Creatorステータス",
  todayNote: "今日のnote",
  missions: "今日のミッション",
  membership: "Creator特典 / メンバーシップ",
  library: "記事ライブラリ / noteマガジン",
  releaseStatus: "リリース状態",
  hero: "ミレア × ルピィ",
  quickStart: "クイックスタート / 使い方",
  articleSetup: "記事の基本設定",
  aiApps: "AIアプリ・関連機能",
  ranking: "週間ランキング",
  quickActions: "よく使う機能",
};

const DEFAULT_ORDER: readonly HomeWidgetKey[] = [
  "creator",
  "todayNote",
  "missions",
  "membership",
  "library",
  "releaseStatus",
  "hero",
  "quickStart",
  "articleSetup",
  "aiApps",
  "ranking",
  "quickActions",
];

function defaultLayout(): HomeWidgetItem[] {
  return DEFAULT_ORDER.map((key) => ({ key, size: "wide", visible: true }));
}

export function createDefaultHomeWidgetPreferences(): HomeWidgetPreferences {
  return {
    desktopLayout: defaultLayout(),
    mobileLayout: defaultLayout(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHomeWidgetKey(value: unknown): value is HomeWidgetKey {
  return typeof value === "string" && (HOME_WIDGET_KEYS as readonly string[]).includes(value);
}

function parseLayout(value: unknown, fallback: readonly HomeWidgetItem[]): HomeWidgetItem[] {
  if (!Array.isArray(value)) return fallback.map((item) => ({ ...item }));

  const seen = new Set<HomeWidgetKey>();
  const parsed: HomeWidgetItem[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !isHomeWidgetKey(entry.key) || seen.has(entry.key)) continue;
    seen.add(entry.key);
    parsed.push({
      key: entry.key,
      size: entry.size === "half" ? "half" : "wide",
      visible: entry.visible !== false,
    });
  }

  for (const item of fallback) {
    if (!seen.has(item.key)) parsed.push({ ...item });
  }
  return parsed;
}

export function parseHomeWidgetPreferences(value: unknown): HomeWidgetPreferences {
  const defaults = createDefaultHomeWidgetPreferences();
  if (!isRecord(value)) return defaults;

  const desktop = value.desktopLayout ?? value.desktop_layout;
  const mobile = value.mobileLayout ?? value.mobile_layout;
  return {
    desktopLayout: parseLayout(desktop, defaults.desktopLayout),
    mobileLayout: parseLayout(mobile, defaults.mobileLayout),
  };
}

export async function loadHomeWidgetPreferences(
  client: SupabaseClient,
  userId: string,
): Promise<HomeWidgetPreferences> {
  const { data, error } = await client
    .from("user_home_widget_preferences")
    .select("desktop_layout,mobile_layout")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return createDefaultHomeWidgetPreferences();
  return parseHomeWidgetPreferences(data);
}

export async function saveHomeWidgetPreferences(
  client: SupabaseClient,
  userId: string,
  preferences: HomeWidgetPreferences,
): Promise<HomeWidgetPreferences> {
  const normalized = parseHomeWidgetPreferences(preferences);
  const { data, error } = await client
    .from("user_home_widget_preferences")
    .upsert({
      user_id: userId,
      desktop_layout: normalized.desktopLayout,
      mobile_layout: normalized.mobileLayout,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select("desktop_layout,mobile_layout")
    .single();

  if (error) throw error;
  return parseHomeWidgetPreferences(data);
}
