import type { SideHustleDefinition, SideHustleDraft } from "@/features/side-hustles/types";
import { initialSideHustleDraft } from "@/features/side-hustles/prompt-builder";
import { SIDE_HUSTLE_CUSTOM_VALUE } from "@/features/side-hustles/types";

const BASE_KEY = "aas-side-hustle-wizard";

function storageKey(userId: string, slug: string): string {
  return [BASE_KEY, userId, slug].join(":");
}

export function hasStoredSideHustleDraft(userId: string, definition: SideHustleDefinition): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    return window.localStorage.getItem(storageKey(userId, definition.slug)) !== null;
  } catch {
    return false;
  }
}

export function readSideHustleDraft(
  userId: string,
  definition: SideHustleDefinition,
): SideHustleDraft {
  const fallback = initialSideHustleDraft(definition);
  if (typeof window === "undefined" || !userId) return fallback;
  try {
    const raw = JSON.parse(window.localStorage.getItem(storageKey(userId, definition.slug)) ?? "null") as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
    const row = raw as Record<string, unknown>;
    const valuesRaw = row.values && typeof row.values === "object" && !Array.isArray(row.values)
      ? row.values as Record<string, unknown>
      : {};
    const values = Object.fromEntries(definition.fields.map((field) => {
      const candidate = valuesRaw[field.key];
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        return [field.key, fallback.values[field.key]];
      }
      const value = candidate as Record<string, unknown>;
      const selected = typeof value.selected === "string" ? value.selected : "";
      const allowed = field.options.some((item) => item.value === selected);
      return [field.key, {
        selected: allowed ? selected : (field.options[0]?.value ?? SIDE_HUSTLE_CUSTOM_VALUE),
        custom: typeof value.custom === "string" ? value.custom.slice(0, 4000) : "",
      }];
    }));
    return {
      values,
      selectedAi: row.selectedAi === "claude" || row.selectedAi === "gemini" || row.selectedAi === "chatgpt" ? row.selectedAi : fallback.selectedAi,
      selectedPlan: row.selectedPlan === "paid" ? "paid" : "free",
      resultText: typeof row.resultText === "string" ? row.resultText.slice(0, 120000) : "",
      step: typeof row.step === "number" && Number.isInteger(row.step)
        ? Math.max(0, Math.min(4, row.step))
        : 0,
    };
  } catch {
    return fallback;
  }
}

export function writeSideHustleDraft(
  userId: string,
  definition: SideHustleDefinition,
  draft: SideHustleDraft,
): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    window.localStorage.setItem(storageKey(userId, definition.slug), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearSideHustleDraft(userId: string, definition: SideHustleDefinition): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    window.localStorage.removeItem(storageKey(userId, definition.slug));
    return true;
  } catch {
    return false;
  }
}
