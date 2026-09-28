import { extractNoteAiScheduleJson } from "@/lib/note-ai-schedule-json";
import {
  noteMonthBounds,
  todayJstDateKey,
} from "@/lib/note-schedule-core";
import {
  ensureDistinctDailyPostingTimes,
  parseAiScheduleItem,
  parseSimpleAiArticleSchedule,
} from "@/lib/note-ai-schedule-normalize";
import type {
  NoteAiResearchSource,
  NoteAiSchedulePlan,
  NoteScheduleItem,
} from "@/lib/note-schedule-types";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finiteNumber(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeHttpUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString().slice(0, 1200) : "";
  } catch {
    return "";
  }
}

export function parseNoteAiSchedulePlan(
  text: string,
  expectedMonth: string,
  currentDate = todayJstDateKey(),
): NoteAiSchedulePlan {
  const bounds = noteMonthBounds(expectedMonth);
  let root: Record<string, unknown>;
  try {
    root = extractNoteAiScheduleJson(text);
  } catch {
    const parsed = parseSimpleAiArticleSchedule(text, expectedMonth);
    const simpleSchedule = expectedMonth === currentDate.slice(0, 7)
      ? parsed.filter((item) => item.scheduledDate >= currentDate)
      : parsed;
    if (!simpleSchedule.length) {
      throw new Error("AI回答から無料note・有料noteの作成予定を見つけられませんでした。回答全文をそのまま貼り付けてください。");
    }
    const freePosts = simpleSchedule.filter((item) => item.itemType === "free_note").length;
    const paidPosts = simpleSchedule.filter((item) => item.itemType === "paid_note").length;
    const perDay = new Map<string, number>();
    for (const item of simpleSchedule) perDay.set(item.scheduledDate, (perDay.get(item.scheduledDate) ?? 0) + 1);
    const startForRate = expectedMonth === currentDate.slice(0, 7) ? currentDate : bounds.start;
    const spanDays = Math.max(1, Math.floor((Date.parse(bounds.end + "T00:00:00Z") - Date.parse(startForRate + "T00:00:00Z")) / 86400000) + 1);
    const planningWeeks = Math.max(1, spanDays / 7);
    return {
      schema: "aas-note-schedule-v2",
      targetMonth: expectedMonth,
      generatedForJst: currentDate,
      provider: "chatgpt",
      researchSummary: "",
      strategySummary: "",
      assumptions: [],
      sources: [],
      recommendation: {
        postsPerWeek: Math.round((simpleSchedule.length / planningWeeks) * 10) / 10,
        paidPostsPerWeek: Math.round((paidPosts / planningWeeks) * 10) / 10,
        maxPostsPerDay: Math.max(0, ...perDay.values()),
        totalPosts: simpleSchedule.length,
        freePosts,
        paidPosts,
        reason: "AI回答内の無料note・有料note作成予定をAASが直接読み取りました。",
      },
      schedule: simpleSchedule,
      warnings: ["JSONではなくAI回答内の予定表・文章から読み取りました。"],
    };
  }
  const responseTargetMonth = typeof root.target_month === "string"
    ? root.target_month
    : typeof root.targetMonth === "string"
      ? root.targetMonth
      : "";
  if (responseTargetMonth !== expectedMonth) throw new Error(`AIの対象月（${responseTargetMonth}）とAASで選択した対象月（${expectedMonth}）が一致しません。`);

  const providerRaw = typeof root.provider === "string" ? root.provider.toLowerCase() : "";
  const provider = providerRaw.includes("gemini") ? "gemini" : providerRaw.includes("claude") ? "claude" : "chatgpt";
  const generatedForJst = typeof root.generated_for_jst === "string" && /^\d{4}-\d{2}-\d{2}$/.test(root.generated_for_jst)
    ? root.generated_for_jst
    : currentDate;
  const research = asObject(root.research);
  const recommendationRaw = asObject(root.recommendation);
  const scheduleRaw = Array.isArray(root.schedule)
    ? root.schedule
    : Array.isArray(root.calendar)
      ? root.calendar
      : Array.isArray(root.items)
        ? root.items
        : [];
  const { start, end } = bounds;
  const schedule = ensureDistinctDailyPostingTimes(
    scheduleRaw
      .map((item) => item && typeof item === "object" && !Array.isArray(item) ? parseAiScheduleItem(item as Record<string, unknown>) : null)
      .filter((item): item is NoteScheduleItem => Boolean(item)),
  );

  if (!schedule.length) throw new Error("無料note作成・有料note作成の予定を読み込めませんでした。AIの回答に日付と無料/有料noteの予定が含まれているか確認してください。");
  const outside = schedule.filter((item) => item.scheduledDate < start || item.scheduledDate > end);
  if (outside.length) throw new Error("対象月の外にある予定が含まれています。AIに対象月だけで再作成してもらってください。");
  if (schedule.length > 200) throw new Error("1か月の予定が多すぎます。200件以下にしてください。");

  const articleItems = schedule;
  const actualFree = articleItems.filter((item) => item.itemType === "free_note").length;
  const actualPaid = articleItems.filter((item) => item.itemType === "paid_note").length;
  const perDay = new Map<string, number>();
  const duplicateKeys = new Set<string>();
  const seen = new Set<string>();
  for (const item of articleItems) {
    const key = `${item.scheduledDate}|${item.scheduledTime}`;
    if (seen.has(key)) duplicateKeys.add(key);
    seen.add(key);
    perDay.set(item.scheduledDate, (perDay.get(item.scheduledDate) ?? 0) + 1);
  }
  const actualMaxPerDay = Math.max(0, ...perDay.values());
  const warnings: string[] = [];
  if (duplicateKeys.size) warnings.push(`同じ日時に記事投稿が重複しています（${duplicateKeys.size}件）。`);
  if (actualMaxPerDay >= 3) warnings.push(`1日に最大${actualMaxPerDay}本の記事投稿があります。制作負荷を確認してください。`);
  if (!Array.isArray(research.sources) || research.sources.length === 0) warnings.push("調査元URLがありません。最新情報の根拠をAIに再確認することをおすすめします。");
  if (expectedMonth === currentDate.slice(0, 7)) {
    const pastCount = articleItems.filter((item) => item.scheduledDate < currentDate).length;
    if (pastCount) warnings.push(`今日より前の投稿予定が${pastCount}件あります。必要なら削除してから反映してください。`);
  }

  const sources: NoteAiResearchSource[] = (Array.isArray(research.sources) ? research.sources : [])
    .map((value) => {
      const source = asObject(value);
      const url = safeHttpUrl(source.url);
      if (!url) return null;
      return {
        title: typeof source.title === "string" ? source.title.trim().slice(0, 300) : "",
        url,
        publishedAt: typeof source.published_at === "string" ? source.published_at.trim().slice(0, 40) : "",
        whyUsed: typeof source.why_used === "string" ? source.why_used.trim().slice(0, 800) : "",
      };
    })
    .filter((value): value is NoteAiResearchSource => Boolean(value))
    .slice(0, 30);

  if (sources.length > 0 && !sources.some((source) => {
    try {
      const url = new URL(source.url);
      return url.hostname === "note.com" && url.pathname.startsWith("/info/");
    } catch {
      return false;
    }
  })) {
    warnings.push("note公式（note.com/info）の出典が確認できません。note現行仕様や企画の根拠を再確認してください。");
  }

  const generatedDate = new Date(generatedForJst + "T00:00:00Z");
  const recentSourceCutoff = new Date(generatedDate);
  recentSourceCutoff.setUTCDate(recentSourceCutoff.getUTCDate() - 180);
  const datedSources = sources
    .map((source) => /^\d{4}-\d{2}-\d{2}/.test(source.publishedAt) ? new Date(source.publishedAt.slice(0, 10) + "T00:00:00Z") : null)
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));
  if (sources.length > 0 && datedSources.length === 0) {
    warnings.push("出典の公開・更新日を確認できません。最新トレンドの根拠日付をAIに再確認してください。");
  } else if (datedSources.length > 0 && !datedSources.some((date) => date >= recentSourceCutoff && date <= generatedDate)) {
    warnings.push("直近180日以内の出典が確認できません。最新トレンド部分は再調査をおすすめします。");
  }

  const declaredTotal = Math.max(0, Math.round(finiteNumber(recommendationRaw.total_posts, articleItems.length)));
  const declaredFree = Math.max(0, Math.round(finiteNumber(recommendationRaw.free_posts, actualFree)));
  const declaredPaid = Math.max(0, Math.round(finiteNumber(recommendationRaw.paid_posts, actualPaid)));
  if (declaredTotal !== articleItems.length || declaredFree !== actualFree || declaredPaid !== actualPaid) {
    warnings.push("AIのrecommendation本数と実際のschedule件数が一致しないため、AASは実際の予定件数を採用します。");
  }

  return {
    schema: "aas-note-schedule-v2",
    targetMonth: expectedMonth,
    generatedForJst,
    provider,
    researchSummary: typeof research.summary === "string" ? research.summary.trim().slice(0, 6000) : "",
    strategySummary: typeof research.strategy_summary === "string" ? research.strategy_summary.trim().slice(0, 6000) : "",
    assumptions: Array.isArray(research.assumptions)
      ? research.assumptions.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 500)).filter(Boolean).slice(0, 30)
      : [],
    sources,
    recommendation: {
      postsPerWeek: Math.max(0, Math.min(21, finiteNumber(recommendationRaw.posts_per_week))),
      paidPostsPerWeek: Math.max(0, Math.min(14, finiteNumber(recommendationRaw.paid_posts_per_week))),
      maxPostsPerDay: actualMaxPerDay,
      totalPosts: articleItems.length,
      freePosts: actualFree,
      paidPosts: actualPaid,
      reason: typeof recommendationRaw.recommendation_reason === "string" ? recommendationRaw.recommendation_reason.trim().slice(0, 6000) : "",
    },
    schedule: schedule.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.scheduledTime.localeCompare(b.scheduledTime)),
    warnings,
  };
}
