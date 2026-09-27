import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminPromotionChannel } from "@/lib/admin-promotion-channel";

export const PROMOTION_SCREENSHOT_ANALYSIS_FUNCTION = "promotion-screenshot-analyzer";
export const PROMOTION_SCREENSHOT_MAX_IMAGES = 4;
export const PROMOTION_SCREENSHOT_MAX_FILE_BYTES = 4 * 1024 * 1024;
export const PROMOTION_SCREENSHOT_MAX_TOTAL_BYTES = 12 * 1024 * 1024;

export type PromotionScreenshotChannel = Extract<AdminPromotionChannel, "x" | "threads" | "instagram">;

export type PromotionScreenshotImageAnalysis = {
  index: number;
  detectedPage: string;
  visibleContent: string;
  keyElements: string[];
  supportedClaims: string[];
  unsupportedClaims: string[];
  promotionAngles: string[];
  recommendedRole: string;
  privacyWarnings: string[];
};

export type PromotionScreenshotAnalysis = {
  summary: string;
  screenshots: PromotionScreenshotImageAnalysis[];
  globalAngles: string[];
  sensitiveFindings: string[];
  provider: string;
  model: string;
};

type ScreenshotPayload = {
  filename: string;
  mimeType: string;
  dataUrl: string;
};

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function cleanText(value: unknown, maxLength = 1200): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanStringArray(value: unknown, maxItems = 12, maxLength = 500): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeImageAnalysis(value: unknown, fallbackIndex: number): PromotionScreenshotImageAnalysis {
  const row = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const parsedIndex = Number(row.index);
  return {
    index: Number.isInteger(parsedIndex) && parsedIndex > 0 ? parsedIndex : fallbackIndex,
    detectedPage: cleanText(row.detectedPage ?? row.detected_page, 240),
    visibleContent: cleanText(row.visibleContent ?? row.visible_content, 1400),
    keyElements: cleanStringArray(row.keyElements ?? row.key_elements),
    supportedClaims: cleanStringArray(row.supportedClaims ?? row.supported_claims),
    unsupportedClaims: cleanStringArray(row.unsupportedClaims ?? row.unsupported_claims),
    promotionAngles: cleanStringArray(row.promotionAngles ?? row.promotion_angles),
    recommendedRole: cleanText(row.recommendedRole ?? row.recommended_role, 500),
    privacyWarnings: cleanStringArray(row.privacyWarnings ?? row.privacy_warnings),
  };
}

export function normalizePromotionScreenshotAnalysis(value: unknown): PromotionScreenshotAnalysis {
  const root = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const rawScreenshots = Array.isArray(root.screenshots) ? root.screenshots : [];
  return {
    summary: cleanText(root.summary, 1800),
    screenshots: rawScreenshots.slice(0, PROMOTION_SCREENSHOT_MAX_IMAGES)
      .map((item, index) => normalizeImageAnalysis(item, index + 1)),
    globalAngles: cleanStringArray(root.globalAngles ?? root.global_angles),
    sensitiveFindings: cleanStringArray(root.sensitiveFindings ?? root.sensitive_findings),
    provider: cleanText(root.provider, 40),
    model: cleanText(root.model, 120),
  };
}

export function validatePromotionScreenshotFiles(files: readonly File[]): string | null {
  if (!files.length) return "スクリーンショットを1枚以上選択してください。";
  if (files.length > PROMOTION_SCREENSHOT_MAX_IMAGES) {
    return `一度に解析できるスクリーンショットは最大${PROMOTION_SCREENSHOT_MAX_IMAGES}枚です。`;
  }
  let total = 0;
  for (const file of files) {
    if (!ACCEPTED_TYPES.has(file.type)) {
      return "対応形式はPNG / JPEG / WebPです。";
    }
    if (file.size > PROMOTION_SCREENSHOT_MAX_FILE_BYTES) {
      return "1枚あたり4MB以下のスクリーンショットを選択してください。";
    }
    total += file.size;
  }
  if (total > PROMOTION_SCREENSHOT_MAX_TOTAL_BYTES) {
    return "選択した画像の合計サイズは12MB以下にしてください。";
  }
  return null;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("スクリーンショットを読み込めませんでした。"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("スクリーンショットを読み込めませんでした。"));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function buildPayload(files: readonly File[]): Promise<ScreenshotPayload[]> {
  return Promise.all(files.map(async (file) => ({
    filename: file.name.slice(0, 180),
    mimeType: file.type,
    dataUrl: await readFileAsDataUrl(file),
  })));
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const maybe = error as { message?: unknown; context?: { json?: () => Promise<unknown> } };
    if (typeof maybe.message === "string" && maybe.message.trim()) return maybe.message;
  }
  return "スクリーンショットを解析できませんでした。";
}

export async function analyzePromotionScreenshots(
  client: SupabaseClient,
  channel: PromotionScreenshotChannel,
  files: readonly File[],
): Promise<PromotionScreenshotAnalysis> {
  const validation = validatePromotionScreenshotFiles(files);
  if (validation) throw new Error(validation);

  const images = await buildPayload(files);
  const { data, error } = await client.functions.invoke(PROMOTION_SCREENSHOT_ANALYSIS_FUNCTION, {
    body: { channel, images },
  });

  if (error) {
    let message = errorMessage(error);
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (context?.json) {
      try {
        const detail = await context.json();
        if (detail && typeof detail === "object") {
          const record = detail as Record<string, unknown>;
          if (typeof record.error === "string" && record.error.trim()) message = record.error;
        }
      } catch {
        // Keep the SDK error message when a structured body is unavailable.
      }
    }
    throw new Error(message);
  }

  const root = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const analysis = normalizePromotionScreenshotAnalysis(root.analysis ?? root);
  if (!analysis.summary && !analysis.screenshots.length) {
    throw new Error("画像解析結果を受け取れませんでした。");
  }
  return analysis;
}

function bulletLines(label: string, values: readonly string[]): string {
  if (!values.length) return `${label}: なし`;
  return `${label}:\n${values.map((value) => `- ${value}`).join("\n")}`;
}

export function buildPromotionScreenshotPromptContext(
  analysis: PromotionScreenshotAnalysis | null,
): string {
  if (!analysis) return "";

  const screenshots = analysis.screenshots.map((item) => [
    `スクショ${item.index}`,
    `画面: ${item.detectedPage || "判別不能"}`,
    `見えている内容: ${item.visibleContent || "要確認"}`,
    bulletLines("確認できる要素", item.keyElements),
    bulletLines("画像から裏付けられる主張", item.supportedClaims),
    bulletLines("画像だけでは裏付けられない主張", item.unsupportedClaims),
    bulletLines("使える訴求角度", item.promotionAngles),
    `推奨する役割: ${item.recommendedRole || "要確認"}`,
    bulletLines("公開前に確認・隠す情報", item.privacyWarnings),
  ].join("\n")).join("\n\n");

  return [
    "【アップロード済みスクリーンショット解析】",
    "以下はAASが画像から抽出した補助情報です。画像から確認できた内容だけを事実として扱い、推測で成果や機能を追加しないでください。",
    `全体要約: ${analysis.summary || "要確認"}`,
    bulletLines("全体の訴求候補", analysis.globalAngles),
    bulletLines("機密・個人情報の注意", analysis.sensitiveFindings),
    screenshots,
  ].join("\n");
}
