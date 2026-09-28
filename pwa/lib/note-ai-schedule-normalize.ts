import {
  normalizeNoteScheduleTime,
  noteMonthBounds,
} from "@/lib/note-schedule-core";
import type { NoteScheduleItem } from "@/lib/note-schedule-types";

function normalizeAiArticleScheduleType(value: unknown): "free_note" | "paid_note" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["free_note", "free", "free_article", "無料note", "無料ノート", "無料記事", "無料note作成"].includes(normalized)) return "free_note";
  if (["paid_note", "paid", "paid_article", "有料note", "有料ノート", "有料記事", "有料note作成"].includes(normalized)) return "paid_note";
  return null;
}

function fallbackDailyPostingTimes(count: number): string[] {
  if (count <= 1) return ["20:00"];
  const presets: Record<number, string[]> = {
    2: ["12:00", "20:00"],
    3: ["09:00", "14:00", "20:00"],
    4: ["08:00", "12:00", "16:00", "20:00"],
  };
  if (presets[count]) return presets[count];

  const startMinutes = 8 * 60;
  const endMinutes = 21 * 60;
  const step = (endMinutes - startMinutes) / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, index) => {
    const total = Math.round(startMinutes + step * index);
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  });
}

export function ensureDistinctDailyPostingTimes(items: NoteScheduleItem[]): NoteScheduleItem[] {
  const result = items.map((item) => ({ ...item }));
  const indexesByDate = new Map<string, number[]>();

  result.forEach((item, index) => {
    const indexes = indexesByDate.get(item.scheduledDate) ?? [];
    indexes.push(index);
    indexesByDate.set(item.scheduledDate, indexes);
  });

  for (const indexes of indexesByDate.values()) {
    if (indexes.length <= 1) continue;
    const uniqueTimes = new Set(indexes.map((index) => result[index].scheduledTime));
    if (uniqueTimes.size === indexes.length) continue;

    const fallbackTimes = fallbackDailyPostingTimes(indexes.length);
    indexes
      .sort((left, right) => result[left].scheduledTime.localeCompare(result[right].scheduledTime))
      .forEach((index, order) => {
        result[index] = { ...result[index], scheduledTime: fallbackTimes[order] };
      });
  }

  return result;
}

export function parseSimpleAiArticleSchedule(text: string, expectedMonth: string): NoteScheduleItem[] {
  const { start, end } = noteMonthBounds(expectedMonth);
  const [targetYear, targetMonthNumber] = expectedMonth.split("-").map(Number);
  const items: NoteScheduleItem[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*[-*]\s*/, "").trim();
    if (!line) continue;

    const type = /有料(?:note|ノート|記事)(?:作成)?/i.test(line) || /\bpaid(?:_note|_article)?\b/i.test(line)
      ? "paid_note"
      : /無料(?:note|ノート|記事)(?:作成)?/i.test(line) || /\bfree(?:_note|_article)?\b/i.test(line)
        ? "free_note"
        : null;
    if (!type) continue;

    let date = "";
    const fullDate = line.match(/\b(20\d{2})[-\/.年](\d{1,2})[-\/.月](\d{1,2})(?:日)?\b/);
    if (fullDate) {
      date = fullDate[1] + "-" + String(Number(fullDate[2])).padStart(2, "0") + "-" + String(Number(fullDate[3])).padStart(2, "0");
    } else {
      const monthDay = line.match(/(?:^|[|\s])(\d{1,2})[\/.月](\d{1,2})(?:日)?(?:[|\s]|$)/);
      if (monthDay && Number(monthDay[1]) === targetMonthNumber) {
        date = String(targetYear) + "-" + String(Number(monthDay[1])).padStart(2, "0") + "-" + String(Number(monthDay[2])).padStart(2, "0");
      }
    }
    if (!date || date < start || date > end) continue;

    const timeMatch = line.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    const time = timeMatch ? String(Number(timeMatch[1])).padStart(2, "0") + ":" + timeMatch[2] : "20:00";

    const cells = line.split("|").map((value) => value.trim()).filter(Boolean);
    const typeIndex = cells.findIndex((value) =>
      /(?:無料|有料)(?:note|ノート|記事)(?:作成)?/i.test(value) ||
      /\b(?:free|paid)(?:_note|_article)?\b/i.test(value),
    );

    let title = "";
    let theme = "";
    if (typeIndex >= 0) {
      title = cells[typeIndex + 1] ?? "";
      theme = cells[typeIndex + 2] ?? "";
    }
    if (!title) {
      title = line
        .replace(/\|/g, " ")
        .replace(/\b20\d{2}[-\/.年]\d{1,2}[-\/.月]\d{1,2}(?:日)?\b/g, " ")
        .replace(/\b\d{1,2}[\/.月]\d{1,2}(?:日)?\b/g, " ")
        .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, " ")
        .replace(/(?:無料|有料)(?:note|ノート|記事)(?:作成)?/gi, " ")
        .replace(/\b(?:free|paid)(?:_note|_article)?\b/gi, " ")
        .replace(/\s+/g, " ")
        .replace(/^[:：\-–—\s]+|[:：\-–—\s]+$/g, "")
        .trim();
    }
    const fallbackTitle = type === "paid_note" ? "有料noteを作成" : "無料noteを作成";
    const finalTitle = (title || fallbackTitle).slice(0, 240);
    const key = date + "|" + time + "|" + type + "|" + finalTitle;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      scheduledDate: date,
      scheduledTime: time,
      itemType: type,
      title: finalTitle,
      theme: theme.slice(0, 500),
      status: "planned",
      source: "imported",
      notes: "",
    });
  }

  return ensureDistinctDailyPostingTimes(items)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.scheduledTime.localeCompare(b.scheduledTime));
}
export function parseAiScheduleItem(raw: Record<string, unknown>): NoteScheduleItem | null {
  const date = typeof raw.date === "string"
    ? raw.date
    : typeof raw.scheduled_date === "string"
      ? raw.scheduled_date
      : typeof raw.day === "string"
        ? raw.day
        : "";
  const type = normalizeAiArticleScheduleType(raw.type ?? raw.item_type ?? raw.article_type);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !type) return null;

  const theme = typeof raw.theme === "string"
    ? raw.theme.trim().slice(0, 500)
    : typeof raw.topic === "string"
      ? raw.topic.trim().slice(0, 500)
      : "";
  const rawTitle = typeof raw.title === "string"
    ? raw.title.trim()
    : typeof raw.article_title === "string"
      ? raw.article_title.trim()
      : typeof raw.name === "string"
        ? raw.name.trim()
        : "";
  const fallbackTitle = theme || (type === "paid_note" ? "有料noteを作成" : "無料noteを作成");

  return {
    scheduledDate: date,
    scheduledTime: normalizeNoteScheduleTime(
      typeof raw.time === "string"
        ? raw.time
        : typeof raw.scheduled_time === "string"
          ? raw.scheduled_time
          : "20:00",
      "20:00",
    ),
    itemType: type,
    title: (rawTitle || fallbackTitle).slice(0, 240),
    theme,
    status: "planned",
    source: "imported",
    notes: typeof raw.notes === "string" ? raw.notes.trim().slice(0, 1200) : "",
  };
}
