import type {
  SnsLaunchGoal,
  SnsLaunchInput,
  SnsLaunchPlatform,
} from "@/lib/phase15-sns-plan";

const STORAGE_PREFIX = "aas:pwa:sns-launch-plan:v1";

const PLATFORMS: readonly SnsLaunchPlatform[] = [
  "x",
  "instagram",
  "threads",
  "tiktok",
  "facebook",
  "linkedin",
  "pinterest",
  "youtube",
];

const GOALS: readonly SnsLaunchGoal[] = [
  "article_sales",
  "affiliate",
  "digital_product",
  "client_work",
  "creator",
  "membership",
  "app_service",
  "lead_generation",
];

const FACE_REVEAL = ["yes", "no", "either"] as const;

export type SnsLaunchPlanProgress = {
  input: SnsLaunchInput;
  weeklyPostsText: string;
};

export function snsLaunchPlanStorageKey(userId: string): string {
  return STORAGE_PREFIX + ":" + userId;
}

function text(value: unknown, fallback: string, limit = 500): string {
  return typeof value === "string" ? value.slice(0, limit) : fallback;
}

export function readSnsLaunchPlanProgress(userId: string): SnsLaunchPlanProgress | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = window.localStorage.getItem(snsLaunchPlanStorageKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const root = parsed as Record<string, unknown>;
    const inputRaw = root.input;
    if (!inputRaw || typeof inputRaw !== "object" || Array.isArray(inputRaw)) return null;
    const row = inputRaw as Record<string, unknown>;

    const platform = typeof row.platform === "string" && PLATFORMS.includes(row.platform as SnsLaunchPlatform)
      ? row.platform as SnsLaunchPlatform
      : "x";
    const goal = typeof row.goal === "string" && GOALS.includes(row.goal as SnsLaunchGoal)
      ? row.goal as SnsLaunchGoal
      : "article_sales";
    const faceReveal = typeof row.faceReveal === "string" && FACE_REVEAL.includes(row.faceReveal as typeof FACE_REVEAL[number])
      ? row.faceReveal as SnsLaunchInput["faceReveal"]
      : "no";
    const weeklyPosts = typeof row.weeklyPosts === "number" && Number.isFinite(row.weeklyPosts)
      ? Math.max(1, Math.min(21, Math.trunc(row.weeklyPosts)))
      : 5;

    return {
      input: {
        platform,
        goal,
        niche: text(row.niche, "AI副業"),
        audience: text(row.audience, "30代・初心者"),
        strength: text(row.strength, "文章を分かりやすく整理する"),
        faceReveal,
        weeklyPosts,
        tone: text(row.tone, "親しみやすく具体的"),
        offer: text(row.offer, "note・Tips・Brain等の記事"),
      },
      weeklyPostsText: text(root.weeklyPostsText, String(weeklyPosts), 8),
    };
  } catch {
    return null;
  }
}

export function writeSnsLaunchPlanProgress(
  userId: string,
  progress: SnsLaunchPlanProgress,
): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    window.localStorage.setItem(
      snsLaunchPlanStorageKey(userId),
      JSON.stringify({
        input: {
          ...progress.input,
          niche: progress.input.niche.slice(0, 500),
          audience: progress.input.audience.slice(0, 500),
          strength: progress.input.strength.slice(0, 500),
          tone: progress.input.tone.slice(0, 500),
          offer: progress.input.offer.slice(0, 500),
          weeklyPosts: Math.max(1, Math.min(21, Math.trunc(progress.input.weeklyPosts) || 1)),
        },
        weeklyPostsText: progress.weeklyPostsText.slice(0, 8),
      }),
    );
    return true;
  } catch {
    return false;
  }
}
