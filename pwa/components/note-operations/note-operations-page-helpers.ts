import type { SharedAccessState } from "@/components/access-state-provider";
import { readEffectiveRelease, releaseVersionAtLeast } from "@/lib/app-release";
import { todayJstDateKey, type NoteOperationProfile, type NoteScheduleItem } from "@/features/note";

export type NoteOperationsGate =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "ready"; userId: string; isAdmin: boolean }
  | { kind: "error"; message: string };

const NOTE_PERFORMANCE_LOOP_MIN_RELEASE = "0.1.1";
const NOTE_SCHEDULE_RESPONSE_STORAGE_PREFIX = "aas.note.schedule.response.v1";
const NOTE_OPERATIONS_TAB_STORAGE_PREFIX = "aas.note.operations.tab.v1";

export type NoteOperationsTab = "start" | "profile" | "plan" | "calendar" | "membership";
const NOTE_OPERATIONS_TABS: readonly NoteOperationsTab[] = ["start", "profile", "plan", "calendar", "membership"];

export function noteOperationsGateFor(
  accessState: SharedAccessState,
  initError: string,
): NoteOperationsGate {
  if (accessState.kind === "ready") {
    if (initError) return { kind: "error", message: initError };
    return {
      kind: "ready",
      userId: accessState.profile.id,
      isAdmin: accessState.profile.role === "admin",
    };
  }
  if (accessState.kind === "loading") return { kind: "loading" };
  if (accessState.kind === "signed_out") return { kind: "signed_out" };
  if (accessState.kind === "unavailable") {
    return { kind: "error", message: "AASへ接続できませんでした。通信状態を確認してください。" };
  }
  if (accessState.kind === "pending") {
    return { kind: "error", message: "アカウント承認後に利用できます。" };
  }
  if (accessState.kind === "entitlement_denied") {
    return { kind: "error", message: "PWA利用権が必要です。" };
  }
  return { kind: "error", message: "現在のアカウント状態では利用できません。" };
}

export function noteScheduleResponseStorageKey(userId: string): string {
  return `${NOTE_SCHEDULE_RESPONSE_STORAGE_PREFIX}:${userId}`;
}

export function noteOperationsTabStorageKey(userId: string): string {
  return `${NOTE_OPERATIONS_TAB_STORAGE_PREFIX}:${userId}`;
}

export function readNoteOperationsTab(userId: string): NoteOperationsTab {
  if (typeof window === "undefined" || !userId) return "start";
  try {
    const value = window.localStorage.getItem(noteOperationsTabStorageKey(userId));
    return NOTE_OPERATIONS_TABS.includes(value as NoteOperationsTab)
      ? value as NoteOperationsTab
      : "start";
  } catch {
    return "start";
  }
}

export function writeNoteOperationsTab(userId: string, tab: NoteOperationsTab): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    window.localStorage.setItem(noteOperationsTabStorageKey(userId), tab);
    return true;
  } catch {
    return false;
  }
}

export function notePerformanceLoopAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const isGuardedPreview = window.location.hostname.includes("ai-article-studio-pwa-preview");
  return isGuardedPreview || releaseVersionAtLeast(readEffectiveRelease()?.version, NOTE_PERFORMANCE_LOOP_MIN_RELEASE);
}

export function downloadText(filename: string, text: string, type: string): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function monthStart(value: string): string {
  return /^\d{4}-\d{2}$/.test(value) ? value + "-01" : todayJstDateKey().slice(0, 7) + "-01";
}

export function moveMonth(value: string, delta: number): string {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function monthCells(value: string): Array<{ date: string; current: boolean }> {
  const start = monthStart(value);
  const [year, month] = start.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lead = first.getUTCDay();
  const base = new Date(Date.UTC(year, month - 1, 1 - lead));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(base);
    date.setUTCDate(base.getUTCDate() + index);
    return {
      date: date.toISOString().slice(0, 10),
      current: date.getUTCMonth() === month - 1,
    };
  });
}

export function typeClass(item: NoteScheduleItem): string {
  if (item.itemType === "paid_note") return "paid";
  if (item.itemType === "free_note") return "free";
  if (item.itemType === "review") return "review";
  return "setup";
}

export function createHref(item: NoteScheduleItem, profile: NoteOperationProfile): string {
  const paid = item.itemType === "paid_note";
  const params = new URLSearchParams({
    publicationTarget: "note",
    articleType: paid ? "paid" : "free",
    title: item.title || "",
    theme: item.theme || item.title || "",
    genre: profile.articleGenre || "AI副業",
    subgenre: profile.articleSubgenre || "AIおまかせ",
    targetLength: String(paid ? profile.paidTargetLength : profile.freeTargetLength),
    from: "note-operations",
  });
  return "/create?" + params.toString();
}
