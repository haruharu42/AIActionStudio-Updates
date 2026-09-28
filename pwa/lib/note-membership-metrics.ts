export const NOTE_MEMBERSHIP_METRICS_STORAGE_PREFIX = "aas.note.membership.metrics.v1";
export const NOTE_MEMBERSHIP_METRICS_MAX_ENTRIES = 36;

export type NoteMembershipMetricsEntry = {
  month: string;
  memberCount: number | null;
  newMembers: number | null;
  cancellations: number | null;
  revenueYen: number | null;
  postCount: number | null;
  operationHours: number | null;
  memo: string;
};

export function membershipMetricsStorageKey(userId: string): string {
  return NOTE_MEMBERSHIP_METRICS_STORAGE_PREFIX + ":" + userId;
}

export function currentMembershipMetricsMonth(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? String(date.getUTCFullYear());
  const month = parts.find((part) => part.type === "month")?.value ?? String(date.getUTCMonth() + 1).padStart(2, "0");
  return year + "-" + month;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validMonth(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < 2000 || year > 2200) return false;
  if (value > currentMembershipMetricsMonth()) return false;
  return true;
}

function optionalInteger(value: unknown, max: number): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > max) return undefined;
  return value;
}

function optionalHours(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10000) return undefined;
  return Math.round(value * 10) / 10;
}

export function parseMembershipMetricsEntry(value: unknown): NoteMembershipMetricsEntry | null {
  if (!isRecord(value) || !validMonth(value.month)) return null;

  const memberCount = optionalInteger(value.memberCount, 10_000_000);
  const newMembers = optionalInteger(value.newMembers, 10_000_000);
  const cancellations = optionalInteger(value.cancellations, 10_000_000);
  const revenueYen = optionalInteger(value.revenueYen, 1_000_000_000_000);
  const postCount = optionalInteger(value.postCount, 1_000_000);
  const operationHours = optionalHours(value.operationHours);
  const memo = typeof value.memo === "string" ? value.memo.trim().slice(0, 1000) : null;

  if (
    memberCount === undefined
    || newMembers === undefined
    || cancellations === undefined
    || revenueYen === undefined
    || postCount === undefined
    || operationHours === undefined
    || memo === null
  ) {
    return null;
  }

  return {
    month: value.month,
    memberCount,
    newMembers,
    cancellations,
    revenueYen,
    postCount,
    operationHours,
    memo,
  };
}

export function parseMembershipMetricsEntries(value: unknown): NoteMembershipMetricsEntry[] {
  if (!Array.isArray(value)) return [];

  const byMonth = new Map<string, NoteMembershipMetricsEntry>();
  for (const item of value) {
    const parsed = parseMembershipMetricsEntry(item);
    if (parsed && !byMonth.has(parsed.month)) byMonth.set(parsed.month, parsed);
  }

  return [...byMonth.values()]
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, NOTE_MEMBERSHIP_METRICS_MAX_ENTRIES);
}

export function upsertMembershipMetricsEntry(
  current: readonly NoteMembershipMetricsEntry[],
  next: NoteMembershipMetricsEntry,
): NoteMembershipMetricsEntry[] {
  const parsed = parseMembershipMetricsEntry(next);
  if (!parsed) return [...current];

  return parseMembershipMetricsEntries([
    parsed,
    ...current.filter((entry) => entry.month !== parsed.month),
  ]);
}

function metricParts(entry: NoteMembershipMetricsEntry): string[] {
  const parts: string[] = [];
  if (entry.memberCount !== null) parts.push("会員数 " + entry.memberCount + "人");
  if (entry.newMembers !== null) parts.push("新規加入 " + entry.newMembers + "人");
  if (entry.cancellations !== null) parts.push("解約 " + entry.cancellations + "人");
  if (entry.revenueYen !== null) parts.push("売上 " + entry.revenueYen + "円");
  if (entry.postCount !== null) parts.push("投稿数 " + entry.postCount + "本");
  if (entry.operationHours !== null) parts.push("運営時間 " + entry.operationHours + "時間");
  if (entry.memo) parts.push("メモ「" + entry.memo.replace(/[\r\n]+/g, " ") + "」");
  return parts;
}

export function formatMembershipMetricsForPrompt(
  entries: readonly NoteMembershipMetricsEntry[],
  limit = 6,
): string[] {
  return parseMembershipMetricsEntries(entries)
    .slice(0, Math.max(0, Math.min(12, limit)))
    .map((entry) => {
      const parts = metricParts(entry);
      return "- " + entry.month + ": " + (parts.length ? parts.join(" / ") : "数値入力なし");
    });
}

export function hasMembershipMetrics(entry: NoteMembershipMetricsEntry): boolean {
  return (
    entry.memberCount !== null
    || entry.newMembers !== null
    || entry.cancellations !== null
    || entry.revenueYen !== null
    || entry.postCount !== null
    || entry.operationHours !== null
    || Boolean(entry.memo.trim())
  );
}
