import type { SocialGoal, SocialPlatform } from "@/lib/phase14-sns";

const STORAGE_PREFIX = "aas:pwa:sns-composer:v1";

const PLATFORMS: readonly SocialPlatform[] = [
  "x",
  "instagram",
  "threads",
  "tiktok",
  "facebook",
  "linkedin",
  "pinterest",
  "youtube",
];

const GOALS: readonly SocialGoal[] = [
  "article_traffic",
  "engagement",
  "product_interest",
  "profile_growth",
  "community",
  "lead_generation",
  "brand_awareness",
];

export type SnsComposerProgress = {
  articleId: string;
  platform: SocialPlatform;
  goal: SocialGoal;
  tone: string;
  maxCharacters: string;
  hashtags: boolean;
  generatedPrompt: string;
  generatedFingerprint: string;
};

export function snsComposerStorageKey(userId: string): string {
  return STORAGE_PREFIX + ":" + userId;
}

function isPlatform(value: unknown): value is SocialPlatform {
  return typeof value === "string" && PLATFORMS.includes(value as SocialPlatform);
}

function isGoal(value: unknown): value is SocialGoal {
  return typeof value === "string" && GOALS.includes(value as SocialGoal);
}

export function readSnsComposerProgress(userId: string): SnsComposerProgress | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = window.localStorage.getItem(snsComposerStorageKey(userId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    return {
      articleId: typeof row.articleId === "string" ? row.articleId.slice(0, 160) : "",
      platform: isPlatform(row.platform) ? row.platform : "x",
      goal: isGoal(row.goal) ? row.goal : "article_traffic",
      tone: typeof row.tone === "string" ? row.tone.slice(0, 300) : "親しみやすく具体的",
      maxCharacters: typeof row.maxCharacters === "string" ? row.maxCharacters.slice(0, 12) : "140",
      hashtags: row.hashtags !== false,
      generatedPrompt: typeof row.generatedPrompt === "string" ? row.generatedPrompt.slice(0, 120000) : "",
      generatedFingerprint: typeof row.generatedFingerprint === "string" ? row.generatedFingerprint.slice(0, 4000) : "",
    };
  } catch {
    return null;
  }
}

export function writeSnsComposerProgress(userId: string, progress: SnsComposerProgress): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    window.localStorage.setItem(
      snsComposerStorageKey(userId),
      JSON.stringify({
        ...progress,
        articleId: progress.articleId.slice(0, 160),
        tone: progress.tone.slice(0, 300),
        maxCharacters: progress.maxCharacters.slice(0, 12),
        generatedPrompt: progress.generatedPrompt.slice(0, 120000),
        generatedFingerprint: progress.generatedFingerprint.slice(0, 4000),
      }),
    );
    return true;
  } catch {
    return false;
  }
}
