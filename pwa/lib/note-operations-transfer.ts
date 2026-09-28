import { parseCsvRecords } from "@/lib/csv-records";
import { isNoteScheduleDate, normalizeNoteScheduleTime } from "@/lib/note-schedule-core";
import type {
  NoteAiSchedulePlan,
  NoteScheduleImport,
  NoteScheduleItem,
  NoteScheduleItemType,
  NoteScheduleStatus,
} from "@/lib/note-schedule-types";
import type {
  NoteAccountGenre,
  NoteAccountStyle,
  NoteAudiencePreset,
  NoteMonetizationStyle,
  NoteOperationProfile,
  NoteTonePreset,
} from "@/lib/note-operation-profile";

export function exportNoteAiSchedulePlanJson(plan: NoteAiSchedulePlan): string {
  return JSON.stringify({
    schema: "aas-note-schedule-v2",
    target_month: plan.targetMonth,
    generated_for_jst: plan.generatedForJst,
    provider: plan.provider,
    research: {
      summary: plan.researchSummary,
      strategy_summary: plan.strategySummary,
      assumptions: plan.assumptions,
      sources: plan.sources.map((source) => ({
        title: source.title,
        url: source.url,
        published_at: source.publishedAt,
        why_used: source.whyUsed,
      })),
    },
    recommendation: {
      posts_per_week: plan.recommendation.postsPerWeek,
      paid_posts_per_week: plan.recommendation.paidPostsPerWeek,
      max_posts_per_day: plan.recommendation.maxPostsPerDay,
      total_posts: plan.recommendation.totalPosts,
      free_posts: plan.recommendation.freePosts,
      paid_posts: plan.recommendation.paidPosts,
      recommendation_reason: plan.recommendation.reason,
    },
    schedule: plan.schedule.map((item) => ({
      date: item.scheduledDate,
      time: item.scheduledTime,
      type: item.itemType,
      title: item.title,
      theme: item.theme,
      notes: item.notes,
    })),
  }, null, 2);
}


function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function exportNoteScheduleCsv(items: NoteScheduleItem[]): string {
  const header = ["date","time","type","title","theme","status","notes"].join(",");
  const rows = items.map((item) => [
    item.scheduledDate,
    item.scheduledTime,
    item.itemType,
    item.title,
    item.theme,
    item.status,
    item.notes,
  ].map((value) => csvCell(value)).join(","));
  return "\uFEFF" + [header, ...rows].join("\r\n");
}

export function exportNoteOperationsJson(profile: NoteOperationProfile, items: NoteScheduleItem[]): string {
  return JSON.stringify({
    schema: "aas-note-operations-v1",
    exported_at: new Date().toISOString(),
    timezone: "Asia/Tokyo",
    profile: {
      note_display_name: profile.noteDisplayName,
      bio_draft: profile.bioDraft,
      target_reader: profile.targetReader,
      main_topics: profile.mainTopics,
      experience_note: profile.experienceNote,
      account_genre: profile.accountGenre,
      custom_genre: profile.customGenre,
      account_style: profile.accountStyle,
      custom_account_style: profile.customAccountStyle,
      audience_preset: profile.audiencePreset,
      custom_audience: profile.customAudience,
      tone_preset: profile.tonePreset,
      custom_tone: profile.customTone,
      monetization_style: profile.monetizationStyle,
      custom_monetization_style: profile.customMonetizationStyle,
      operation_goal: profile.operationGoal,
      weekly_post_count: profile.weeklyPostCount,
      paid_posts_per_month: profile.paidPostsPerMonth,
      preferred_time: profile.preferredTime,
      secondary_time: profile.secondaryTime,
      schedule_weeks: profile.scheduleWeeks,
      account_ready: profile.accountReady,
      profile_ready: profile.profileReady,
    },
    schedule: items.map((item) => ({
      date: item.scheduledDate,
      time: item.scheduledTime,
      type: item.itemType,
      title: item.title,
      theme: item.theme,
      status: item.status,
      notes: item.notes,
    })),
  }, null, 2);
}

function importedType(value: unknown): NoteScheduleItemType {
  return value === "paid_note" || value === "review" || value === "profile_setup" || value === "sns_share" ? value : "free_note";
}

function importedStatus(value: unknown): NoteScheduleStatus {
  return value === "done" || value === "skipped" ? value : "planned";
}

function importedScheduleItem(raw: Record<string, unknown>): NoteScheduleItem | null {
  const date = typeof raw.date === "string" ? raw.date : "";
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!isNoteScheduleDate(date) || !title) throw new Error("予定の日付または記事タイトルが不正です。ファイルを確認してください。");
  return {
    scheduledDate: date,
    scheduledTime: normalizeNoteScheduleTime(typeof raw.time === "string" ? raw.time : "20:00", "20:00"),
    itemType: importedType(raw.type),
    title: title.slice(0, 240),
    theme: typeof raw.theme === "string" ? raw.theme.slice(0, 500) : "",
    status: importedStatus(raw.status),
    source: "imported",
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, 1200) : "",
  };
}

export function parseNoteOperationsImport(text: string, filename: string): NoteScheduleImport {
  if (filename.toLowerCase().endsWith(".json") || text.trim().startsWith("{")) {
    const raw: unknown = JSON.parse(text.replace(/^\uFEFF/, ""));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("JSON形式を確認できませんでした。");
    const value = raw as Record<string, unknown>;
    if (value.schema !== "aas-note-operations-v1") throw new Error("AAS note運営データの形式ではありません。");
    const rawSchedule = Array.isArray(value.schedule) ? value.schedule : [];
    if (rawSchedule.length > 500) throw new Error("予定は500件以下にしてください。内容を省略せずに読み込むため、ファイルを分けて確認してください。");
    if (rawSchedule.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
      throw new Error("予定の形式が不正です。ファイルを確認してください。");
    }
    const schedule = rawSchedule
      .map((item) => item && typeof item === "object" && !Array.isArray(item) ? importedScheduleItem(item as Record<string, unknown>) : null)
      .filter((item): item is NoteScheduleItem => Boolean(item))
      .slice(0, 500);
    const p = value.profile && typeof value.profile === "object" && !Array.isArray(value.profile)
      ? value.profile as Record<string, unknown>
      : null;
    const profile: Partial<NoteOperationProfile> | null = p ? {
      noteDisplayName: typeof p.note_display_name === "string" ? p.note_display_name.slice(0, 120) : "",
      bioDraft: typeof p.bio_draft === "string" ? p.bio_draft.slice(0, 1200) : "",
      targetReader: typeof p.target_reader === "string" ? p.target_reader.slice(0, 600) : "",
      mainTopics: Array.isArray(p.main_topics) ? p.main_topics.filter((item): item is string => typeof item === "string").slice(0, 12) : [],
      experienceNote: typeof p.experience_note === "string" ? p.experience_note.slice(0, 1200) : "",
      accountGenre: ["ai","sidejob","business","lifestyle","gadget","learning","parenting","health_beauty","money","creative","entertainment","other"].includes(String(p.account_genre)) ? p.account_genre as NoteAccountGenre : "ai",
      customGenre: typeof p.custom_genre === "string" ? p.custom_genre.slice(0, 120) : "",
      accountStyle: ["beginner","howto","experience","essay","review","trend","expert","creative","other"].includes(String(p.account_style)) ? p.account_style as NoteAccountStyle : "beginner",
      customAccountStyle: typeof p.custom_account_style === "string" ? p.custom_account_style.slice(0, 180) : "",
      audiencePreset: ["beginner","employee","sidejob_beginner","student","parent","senior","creator","business_owner","broad","other"].includes(String(p.audience_preset)) ? p.audience_preset as NoteAudiencePreset : "beginner",
      customAudience: typeof p.custom_audience === "string" ? p.custom_audience.slice(0, 300) : "",
      tonePreset: ["friendly","gentle","professional","casual","expert","energetic","other"].includes(String(p.tone_preset)) ? p.tone_preset as NoteTonePreset : "friendly",
      customTone: typeof p.custom_tone === "string" ? p.custom_tone.slice(0, 120) : "",
      monetizationStyle: ["free_first","free_to_paid","paid_expertise","membership_future","no_monetization","other"].includes(String(p.monetization_style)) ? p.monetization_style as NoteMonetizationStyle : "free_to_paid",
      customMonetizationStyle: typeof p.custom_monetization_style === "string" ? p.custom_monetization_style.slice(0, 180) : "",
      operationGoal: p.operation_goal === "growth" || p.operation_goal === "monetize" || p.operation_goal === "portfolio" ? p.operation_goal : "habit",
      weeklyPostCount: Math.max(1, Math.min(14, Number(p.weekly_post_count ?? 3) || 3)),
      paidPostsPerMonth: Math.max(0, Math.min(14, Number(p.paid_posts_per_month ?? 2) || 0)),
      preferredTime: normalizeNoteScheduleTime(typeof p.preferred_time === "string" ? p.preferred_time : "20:00", "20:00"),
      secondaryTime: normalizeNoteScheduleTime(typeof p.secondary_time === "string" ? p.secondary_time : "12:00", "12:00"),
      scheduleWeeks: Math.max(1, Math.min(12, Number(p.schedule_weeks ?? 4) || 4)),
      accountReady: p.account_ready === true,
      profileReady: p.profile_ready === true,
    } : null;
    return { profile, schedule };
  }

  const lines = parseCsvRecords(text);
  if (lines.length < 2) throw new Error("CSVに予定がありません。");
  if (lines.length > 501) throw new Error("予定は500件以下にしてください。");
  const headers = lines[0].map((value) => value.trim().toLowerCase());
  if (!headers.includes("date") || !headers.includes("title")) throw new Error("CSVにはdateとtitle列が必要です。");
  const schedule = lines.slice(1).map((values) => {
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    return importedScheduleItem(row);
  }).filter((item): item is NoteScheduleItem => Boolean(item)).slice(0, 500);
  return { profile: null, schedule };
}
