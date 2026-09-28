import { normalizeNoteScheduleTime, noteMonthBounds } from "@/lib/note-schedule-core";
import type {
  NoteScheduleItem,
  NoteSchedulePerformanceBreakdown,
  NoteSchedulePerformanceSnapshot,
} from "@/lib/note-schedule-types";

const NOTE_PERFORMANCE_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function performanceBreakdown(
  posts: NoteScheduleItem[],
  keyOf: (item: NoteScheduleItem) => string,
  orderedKeys?: readonly string[],
): NoteSchedulePerformanceBreakdown[] {
  const buckets = new Map<string, NoteSchedulePerformanceBreakdown>();
  for (const item of posts) {
    const key = keyOf(item);
    const bucket = buckets.get(key) ?? { key, scheduled: 0, done: 0, skipped: 0, remainingPlanned: 0 };
    bucket.scheduled += 1;
    if (item.status === "done") bucket.done += 1;
    else if (item.status === "skipped") bucket.skipped += 1;
    else bucket.remainingPlanned += 1;
    buckets.set(key, bucket);
  }

  const order = new Map<string, number>();
  (orderedKeys ?? []).forEach((key, index) => order.set(key, index));
  return [...buckets.values()].sort((a, b) => {
    const aOrder = order.get(a.key);
    const bOrder = order.get(b.key);
    if (aOrder !== undefined || bOrder !== undefined) {
      return (aOrder ?? Number.MAX_SAFE_INTEGER) - (bOrder ?? Number.MAX_SAFE_INTEGER);
    }
    return a.key.localeCompare(b.key);
  });
}

export function summarizeNoteSchedulePerformance(
  items: NoteScheduleItem[],
  targetMonth: string,
): NoteSchedulePerformanceSnapshot | null {
  noteMonthBounds(targetMonth);
  const posts = items.filter(
    (item) =>
      item.scheduledDate.startsWith(`${targetMonth}-`) &&
      (item.itemType === "free_note" || item.itemType === "paid_note"),
  );
  if (!posts.length) return null;

  const donePosts = posts.filter((item) => item.status === "done").length;
  const skippedPosts = posts.filter((item) => item.status === "skipped").length;
  const remainingPlannedPosts = posts.length - donePosts - skippedPosts;
  const freePosts = posts.filter((item) => item.itemType === "free_note");
  const paidPosts = posts.filter((item) => item.itemType === "paid_note");
  const weekdays = performanceBreakdown(posts, (item) => {
    const [year, month, day] = item.scheduledDate.split("-").map(Number);
    return NOTE_PERFORMANCE_WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  }, ["月", "火", "水", "木", "金", "土", "日"]);
  const times = performanceBreakdown(posts, (item) => normalizeNoteScheduleTime(item.scheduledTime, "20:00"));

  return {
    targetMonth,
    scheduledPosts: posts.length,
    donePosts,
    skippedPosts,
    remainingPlannedPosts,
    freeScheduled: freePosts.length,
    paidScheduled: paidPosts.length,
    freeDone: freePosts.filter((item) => item.status === "done").length,
    paidDone: paidPosts.filter((item) => item.status === "done").length,
    adherenceRate: posts.length ? Math.round((donePosts / posts.length) * 1000) / 10 : 0,
    weekdays,
    times,
  };
}

export function formatSchedulePerformanceForPrompt(
  performance: NoteSchedulePerformanceSnapshot | null,
  expectedMonth: string,
): string {
  if (!performance || performance.targetMonth !== expectedMonth) {
    return `- ${expectedMonth}のfree_note / paid_note実績はAAS内にありません。一般論だけで頻度を増やさず、初心者が継続できる保守的な仮説から始める。`;
  }
  const weekdays = performance.weekdays
    .map((item) => `${item.key}曜: 予定${item.scheduled}/完了${item.done}/スキップ${item.skipped}/未完了${item.remainingPlanned}`)
    .join("、");
  const times = performance.times
    .map((item) => `${item.key}: 予定${item.scheduled}/完了${item.done}/スキップ${item.skipped}/未完了${item.remainingPlanned}`)
    .join("、");
  return [
    `- 対象月: ${performance.targetMonth}`,
    `- 記事予定: ${performance.scheduledPosts}件（無料 ${performance.freeScheduled} / 有料 ${performance.paidScheduled}）`,
    `- 完了: ${performance.donePosts}件 / スキップ: ${performance.skippedPosts}件 / 未完了: ${performance.remainingPlannedPosts}件`,
    `- 無料note完了: ${performance.freeDone}件 / 有料note完了: ${performance.paidDone}件`,
    `- 投稿予定に対する完了率: ${performance.adherenceRate}%`,
    `- 曜日別: ${weekdays || "データなし"}`,
    `- 時刻別: ${times || "データなし"}`,
  ].join("\n");
}
