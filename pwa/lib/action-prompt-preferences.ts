import type { AiAppKey } from "@/lib/ai-app-links";
import type { ActionPromptTemplate } from "@/lib/action-prompt-catalog";

export const ACTION_PROMPT_FAVORITES_KEY = "aas-action-prompt-favorites";
export const ACTION_PROMPT_RECENT_KEY = "aas-action-prompt-recent";
export const ACTION_PROMPT_PROGRESS_KEY = "aas-action-prompt-progress";

export type StoredActionPromptDraft = {
  values: Record<string, string>;
  selectedAi?: AiAppKey;
};

export type StoredActionPromptProgress = {
  selectedId: string;
  values: Record<string, string>;
  selectedAi?: AiAppKey;
  drafts?: Record<string, StoredActionPromptDraft>;
};

function isAiAppKey(value: unknown): value is AiAppKey {
  return value === "chatgpt" || value === "claude" || value === "gemini";
}

function parseStoredValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function parseStoredDrafts(value: unknown): Record<string, StoredActionPromptDraft> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const drafts: Record<string, StoredActionPromptDraft> = {};
  for (const [templateId, rawDraft] of Object.entries(value as Record<string, unknown>)) {
    if (!rawDraft || typeof rawDraft !== "object" || Array.isArray(rawDraft)) continue;
    const row = rawDraft as Record<string, unknown>;
    drafts[templateId] = {
      values: parseStoredValues(row.values),
      selectedAi: isAiAppKey(row.selectedAi) ? row.selectedAi : undefined,
    };
  }
  return drafts;
}

export function actionPromptScopedKey(base: string, userId: string): string {
  return userId ? `${base}:${userId}` : base;
}

export function readActionPromptIds(base: string, userId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(actionPromptScopedKey(base, userId)) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeActionPromptIds(base: string, userId: string, ids: string[]): void {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.setItem(actionPromptScopedKey(base, userId), JSON.stringify(ids));
}

export function initialActionPromptValues(template: ActionPromptTemplate): Record<string, string> {
  return Object.fromEntries(template.fields.map((field) => [field.key, ""]));
}

export function recommendedActionPromptAi(template: ActionPromptTemplate): AiAppKey {
  if (template.recommendedAi === "Claude") return "claude";
  if (template.recommendedAi === "Gemini") return "gemini";
  return "chatgpt";
}

export function readActionPromptProgress(userId: string): StoredActionPromptProgress | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const value = JSON.parse(
      window.localStorage.getItem(actionPromptScopedKey(ACTION_PROMPT_PROGRESS_KEY, userId)) ?? "null",
    ) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    const row = value as Record<string, unknown>;
    if (
      typeof row.selectedId !== "string"
      || !row.values
      || typeof row.values !== "object"
      || Array.isArray(row.values)
    ) {
      return null;
    }

    const values = parseStoredValues(row.values);
    const drafts = parseStoredDrafts(row.drafts);

    return {
      selectedId: row.selectedId,
      values,
      selectedAi: isAiAppKey(row.selectedAi) ? row.selectedAi : undefined,
      drafts,
    };
  } catch {
    return null;
  }
}

export function writeActionPromptProgress(
  userId: string,
  progress: StoredActionPromptProgress,
): void {
  if (typeof window === "undefined" || !userId) return;
  const previous = readActionPromptProgress(userId);
  const drafts = { ...(previous?.drafts ?? {}), ...(progress.drafts ?? {}) };
  drafts[progress.selectedId] = {
    values: { ...progress.values },
    selectedAi: progress.selectedAi,
  };
  window.localStorage.setItem(
    actionPromptScopedKey(ACTION_PROMPT_PROGRESS_KEY, userId),
    JSON.stringify({ ...progress, drafts }),
  );
}
