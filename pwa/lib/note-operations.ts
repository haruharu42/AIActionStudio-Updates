import { replaceNoteScheduleAtomically } from "@/lib/note-schedule-persistence";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRuntimeWorkspacePresetDefinition, getRuntimeWorkspacePresetPreference } from "@/features/presets/workspace-presets";
import {
  addNoteScheduleDays,
  nextJstMonth,
  normalizeNoteScheduleTime,
  noteMonthBounds,
  todayJstDateKey,
} from "@/lib/note-schedule-core";
import type {
  NoteAiResearchSource,
  NoteAiSchedulePlan,
  NoteArticleOutputSnapshot,
  NoteScheduleItem,
  NoteScheduleItemType,
  NoteScheduleStatus,
} from "@/lib/note-schedule-types";
import {
  applyAasAdminNoteProfilePreset,
  defaultNoteOperationProfile,
  type NoteAccountGenre,
  type NoteAccountStyle,
  type NoteAudiencePreset,
  type NoteMonetizationStyle,
  type NoteOperationProfile,
  type NoteTonePreset,
} from "@/lib/note-operation-profile";

export {
  AAS_ADMIN_NOTE_PROFILE_PRESET,
  NOTE_ACCOUNT_GENRES,
  NOTE_ACCOUNT_STYLES,
  NOTE_AUDIENCE_PRESETS,
  NOTE_MONETIZATION_STYLES,
  NOTE_OPERATION_GOALS,
  NOTE_TONE_PRESETS,
  applyAasAdminNoteProfilePreset,
  defaultNoteOperationProfile,
  noteProfileSelectionLabels,
} from "@/lib/note-operation-profile";
export type {
  NoteAccountGenre,
  NoteAccountStyle,
  NoteAudiencePreset,
  NoteMonetizationStyle,
  NoteOperationGoal,
  NoteOperationProfile,
  NoteTonePreset,
} from "@/lib/note-operation-profile";

export type {
  NoteAiResearchSource,
  NoteAiSchedulePlan,
  NoteAiScheduleRecommendation,
  NoteArticleOutputSnapshot,
  NoteScheduleImport,
  NoteScheduleItem,
  NoteScheduleItemType,
  NoteSchedulePerformanceBreakdown,
  NoteSchedulePerformanceSnapshot,
  NoteScheduleSource,
  NoteScheduleStatus,
} from "@/lib/note-schedule-types";

export { extractNoteAiScheduleJson } from "@/lib/note-ai-schedule-json";
export { parseNoteAiSchedulePlan } from "@/lib/note-ai-schedule-plan";
export { summarizeNoteSchedulePerformance } from "@/lib/note-schedule-performance";
export { buildNoteAccountResearchPrompt, buildNoteProfileDraft, buildNoteScheduleResearchPrompt } from "@/lib/note-operation-prompts";

export {
  currentJstMonth,
  noteMonthBounds,
  previousJstMonth,
  todayJstDateKey,
} from "@/lib/note-schedule-core";

export async function loadNoteArticleOutputSnapshot(
  client: SupabaseClient,
  userId: string,
  targetMonth: string,
): Promise<NoteArticleOutputSnapshot | null> {
  noteMonthBounds(targetMonth);
  const nextMonth = nextJstMonth(targetMonth);
  const startIso = `${targetMonth}-01T00:00:00+09:00`;
  const endIso = `${nextMonth}-01T00:00:00+09:00`;
  const countRows = async (articleType?: "free" | "paid", status?: string): Promise<number> => {
    let query = client
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("publication_target", "note")
      .gte("created_at", startIso)
      .lt("created_at", endIso);
    if (articleType) query = query.eq("article_type", articleType);
    if (status) query = query.eq("status", status);
    const { count, error } = await query;
    if (error) throw new Error("AASの記事作成実績を読み込めませんでした。");
    return count ?? 0;
  };

  const statuses = ["draft", "writing", "ready", "waiting_publish", "published", "on_hold", "archived"] as const;
  const [createdPosts, freeCreated, paidCreated, ...statusValues] = await Promise.all([
    countRows(),
    countRows("free"),
    countRows("paid"),
    ...statuses.map((status) => countRows(undefined, status)),
  ]);
  if (!createdPosts) return null;

  const statusCounts: Record<string, number> = {};
  statuses.forEach((status, index) => {
    const count = statusValues[index] ?? 0;
    if (count > 0) statusCounts[status] = count;
  });
  const published = statusCounts.published ?? 0;
  const readyLike = (statusCounts.ready ?? 0) + (statusCounts.waiting_publish ?? 0) + published;
  const draftLike = createdPosts - readyLike;

  return {
    targetMonth,
    createdPosts,
    freeCreated,
    paidCreated,
    draftLike,
    readyLike,
    published,
    statusCounts,
  };
}

export const NOTE_SCHEDULE_TYPE_LABELS: Record<NoteScheduleItemType, string> = {
  free_note: "無料note作成",
  paid_note: "有料note作成",
  review: "振り返り",
  profile_setup: "初期設定",
  sns_share: "SNS告知",
};

export function isNoteArticleScheduleItem(item: NoteScheduleItem): boolean {
  return item.itemType === "free_note" || item.itemType === "paid_note";
}

function parseProfileRow(row: Record<string, unknown>, userId: string): NoteOperationProfile {
  return {
    userId,
    noteDisplayName: typeof row.note_display_name === "string" ? row.note_display_name : "",
    bioDraft: typeof row.bio_draft === "string" ? row.bio_draft : "",
    targetReader: typeof row.target_reader === "string" ? row.target_reader : "",
    mainTopics: Array.isArray(row.main_topics) ? row.main_topics.filter((v): v is string => typeof v === "string").slice(0, 12) : [],
    experienceNote: typeof row.experience_note === "string" ? row.experience_note : "",
    accountGenre: ["ai","sidejob","business","lifestyle","gadget","learning","parenting","health_beauty","money","creative","entertainment","other"].includes(String(row.account_genre)) ? row.account_genre as NoteAccountGenre : "ai",
    customGenre: typeof row.custom_genre === "string" ? row.custom_genre : "",
    accountStyle: ["beginner","howto","experience","essay","review","trend","expert","creative","other"].includes(String(row.account_style)) ? row.account_style as NoteAccountStyle : "beginner",
    customAccountStyle: typeof row.custom_account_style === "string" ? row.custom_account_style : "",
    audiencePreset: ["beginner","employee","sidejob_beginner","student","parent","senior","creator","business_owner","broad","other"].includes(String(row.audience_preset)) ? row.audience_preset as NoteAudiencePreset : "beginner",
    customAudience: typeof row.custom_audience === "string" ? row.custom_audience : "",
    tonePreset: ["friendly","gentle","professional","casual","expert","energetic","other"].includes(String(row.tone_preset)) ? row.tone_preset as NoteTonePreset : "friendly",
    customTone: typeof row.custom_tone === "string" ? row.custom_tone : "",
    monetizationStyle: ["free_first","free_to_paid","paid_expertise","membership_future","no_monetization","other"].includes(String(row.monetization_style)) ? row.monetization_style as NoteMonetizationStyle : "free_to_paid",
    customMonetizationStyle: typeof row.custom_monetization_style === "string" ? row.custom_monetization_style : "",
    operationGoal: row.operation_goal === "growth" || row.operation_goal === "monetize" || row.operation_goal === "portfolio" ? row.operation_goal : "habit",
    weeklyPostCount: Math.max(1, Math.min(14, Number(row.weekly_post_count ?? 3) || 3)),
    paidPostsPerMonth: Math.max(0, Math.min(14, Number(row.paid_posts_per_month ?? 2) || 0)),
    preferredTime: typeof row.preferred_time === "string" ? row.preferred_time.slice(0, 5) : "20:00",
    secondaryTime: typeof row.secondary_time === "string" ? row.secondary_time.slice(0, 5) : "12:00",
    timezone: typeof row.timezone === "string" ? row.timezone : "Asia/Tokyo",
    scheduleWeeks: Math.max(1, Math.min(12, Number(row.schedule_weeks ?? 4) || 4)),
    accountReady: row.account_ready === true,
    profileReady: row.profile_ready === true,
  };
}

function parseScheduleRow(row: Record<string, unknown>): NoteScheduleItem {
  const type = row.item_type;
  const status = row.status;
  const source = row.source;
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    userId: typeof row.user_id === "string" ? row.user_id : undefined,
    scheduledDate: typeof row.scheduled_date === "string" ? row.scheduled_date : "",
    scheduledTime: typeof row.scheduled_time === "string" ? row.scheduled_time.slice(0, 5) : "20:00",
    itemType: type === "paid_note" || type === "review" || type === "profile_setup" || type === "sns_share" ? type : "free_note",
    title: typeof row.title === "string" ? row.title : "",
    theme: typeof row.theme === "string" ? row.theme : "",
    status: status === "done" || status === "skipped" ? status : "planned",
    source: source === "generated" || source === "imported" ? source : "manual",
    notes: typeof row.notes === "string" ? row.notes : "",
  };
}


export function applyRuntimeWorkspacePresetToNoteProfile(profile: NoteOperationProfile): NoteOperationProfile {
  const preference = getRuntimeWorkspacePresetPreference();
  if (!preference?.applyNote) return profile;
  if (preference.presetKey === "aas_official") return applyAasAdminNoteProfilePreset(profile);

  const preset = getRuntimeWorkspacePresetDefinition();
  const note = preset.note;
  const topics = [...new Set([
    ...profile.mainTopics,
    ...(note.topics ?? preset.article.tags ?? []),
  ])].slice(0, 30);

  return {
    ...profile,
    mainTopics: topics,
    accountGenre: note.genre ? "other" : profile.accountGenre,
    customGenre: note.genre ?? profile.customGenre,
    accountStyle: note.style ? "other" : profile.accountStyle,
    customAccountStyle: note.style ?? profile.customAccountStyle,
    audiencePreset: note.audience ? "other" : profile.audiencePreset,
    customAudience: note.audience ?? profile.customAudience,
    tonePreset: note.tone ? "other" : profile.tonePreset,
    customTone: note.tone ?? profile.customTone,
    monetizationStyle: note.monetization ? "other" : profile.monetizationStyle,
    customMonetizationStyle: note.monetization ?? profile.customMonetizationStyle,
    operationGoal: note.goal?.includes("読者") ? "growth" : profile.operationGoal,
  };
}

export async function loadNoteOperationProfile(client: SupabaseClient, userId: string): Promise<NoteOperationProfile> {
  const { data, error } = await client
    .from("note_operation_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("note運営設定を読み込めませんでした。");
  return data ? parseProfileRow(data as Record<string, unknown>, userId) : defaultNoteOperationProfile(userId);
}

export async function saveNoteOperationProfile(client: SupabaseClient, profile: NoteOperationProfile): Promise<void> {
  const { error } = await client.from("note_operation_profiles").upsert({
    user_id: profile.userId,
    note_display_name: profile.noteDisplayName.trim().slice(0, 120),
    bio_draft: profile.bioDraft.trim().slice(0, 1200),
    target_reader: profile.targetReader.trim().slice(0, 600),
    main_topics: [...new Set(profile.mainTopics.map((item) => item.trim()).filter(Boolean))].slice(0, 12),
    experience_note: profile.experienceNote.trim().slice(0, 1200),
    account_genre: profile.accountGenre,
    custom_genre: profile.customGenre.trim().slice(0, 120),
    account_style: profile.accountStyle,
    custom_account_style: profile.customAccountStyle.trim().slice(0, 180),
    audience_preset: profile.audiencePreset,
    custom_audience: profile.customAudience.trim().slice(0, 300),
    tone_preset: profile.tonePreset,
    custom_tone: profile.customTone.trim().slice(0, 120),
    monetization_style: profile.monetizationStyle,
    custom_monetization_style: profile.customMonetizationStyle.trim().slice(0, 180),
    operation_goal: profile.operationGoal,
    weekly_post_count: Math.max(1, Math.min(14, Math.trunc(profile.weeklyPostCount))),
    paid_posts_per_month: Math.max(0, Math.min(14, Math.trunc(profile.paidPostsPerMonth))),
    preferred_time: normalizeNoteScheduleTime(profile.preferredTime, "20:00"),
    secondary_time: normalizeNoteScheduleTime(profile.secondaryTime, "12:00"),
    timezone: "Asia/Tokyo",
    schedule_weeks: Math.max(1, Math.min(12, Math.trunc(profile.scheduleWeeks))),
    account_ready: profile.accountReady,
    profile_ready: profile.profileReady,
  }, { onConflict: "user_id" });
  if (error) throw new Error("note運営設定を保存できませんでした。");
}

export async function listNoteSchedule(
  client: SupabaseClient,
  userId: string,
  startDate?: string,
  endDate?: string,
): Promise<NoteScheduleItem[]> {
  let query = client
    .from("note_operation_schedule_items")
    .select("*")
    .eq("user_id", userId)
    .order("scheduled_date", { ascending: true })
    .order("scheduled_time", { ascending: true });
  if (startDate) query = query.gte("scheduled_date", startDate);
  if (endDate) query = query.lte("scheduled_date", endDate);
  const { data, error } = await query.limit(500);
  if (error) throw new Error("note運営スケジュールを読み込めませんでした。");
  return (data ?? []).map((row) => parseScheduleRow(row as Record<string, unknown>));
}

export async function replaceNoteSchedule(
  client: SupabaseClient,
  userId: string,
  items: NoteScheduleItem[],
): Promise<NoteScheduleItem[]> {
  const rows = await replaceNoteScheduleAtomically(client, userId, items);
  return rows.map(parseScheduleRow);
}

export async function setNoteScheduleStatus(
  client: SupabaseClient,
  userId: string,
  itemId: string,
  status: NoteScheduleStatus,
): Promise<void> {
  const { error } = await client
    .from("note_operation_schedule_items")
    .update({ status })
    .eq("id", itemId)
    .eq("user_id", userId);
  if (error) throw new Error("予定の状態を更新できませんでした。");
}

function weekdayMondayZero(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  const sundayZero = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sundayZero + 6) % 7;
}

function primaryDays(count: number): number[] {
  const sets: Record<number, number[]> = {
    1: [6],
    2: [2, 6],
    3: [1, 3, 6],
    4: [1, 3, 5, 6],
    5: [1, 2, 4, 5, 6],
    6: [1, 2, 3, 4, 5, 6],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return sets[Math.max(1, Math.min(7, count))];
}

function paidIndexes(total: number, paidCount: number): Set<number> {
  const result = new Set<number>();
  if (paidCount <= 0 || total <= 0) return result;
  const target = Math.min(total, paidCount);
  for (let i = 0; i < target; i += 1) {
    result.add(Math.min(total - 1, Math.floor(((i + 0.5) * total) / target)));
  }
  return result;
}

export function generateNoteSchedule(
  profile: NoteOperationProfile,
  startDate = todayJstDateKey(),
): NoteScheduleItem[] {
  const weeks = Math.max(1, Math.min(12, Math.trunc(profile.scheduleWeeks)));
  const perWeek = Math.max(1, Math.min(14, Math.trunc(profile.weeklyPostCount)));
  const days = primaryDays(Math.min(7, perWeek));
  const secondaryPosts = Math.max(0, perWeek - 7);
  const postingSlots: Array<{ date: string; time: string }> = [];

  for (let offset = 0; offset < weeks * 7; offset += 1) {
    const date = addNoteScheduleDays(startDate, offset);
    const weekday = weekdayMondayZero(date);
    if (days.includes(weekday)) {
      postingSlots.push({ date, time: normalizeNoteScheduleTime(profile.preferredTime, "20:00") });
    }
    if (secondaryPosts > 0 && weekday < secondaryPosts) {
      postingSlots.push({ date, time: normalizeNoteScheduleTime(profile.secondaryTime, "12:00") });
    }
  }

  postingSlots.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const targetPaid = Math.round((profile.paidPostsPerMonth * weeks) / 4);
  const paid = paidIndexes(postingSlots.length, targetPaid);
  const topics = profile.mainTopics.length ? profile.mainTopics : ["メインテーマを決める"];
  const items: NoteScheduleItem[] = [];

  if (!profile.accountReady) {
    items.push({
      scheduledDate: startDate,
      scheduledTime: "10:00",
      itemType: "profile_setup",
      title: "noteアカウントを作成・基本設定を確認",
      theme: "",
      status: "planned",
      source: "generated",
      notes: "AASはnoteのパスワードやCookieを保存しません。",
    });
  }
  if (!profile.profileReady) {
    items.push({
      scheduledDate: addNoteScheduleDays(startDate, profile.accountReady ? 0 : 1),
      scheduledTime: "10:00",
      itemType: "profile_setup",
      title: "プロフィール文と自己紹介記事を整える",
      theme: topics[0],
      status: "planned",
      source: "generated",
      notes: "入力した事実だけを使ってプロフィールを作成します。",
    });
  }

  postingSlots.forEach((slot, index) => {
    const isPaid = paid.has(index);
    const theme = topics[index % topics.length];
    items.push({
      scheduledDate: slot.date,
      scheduledTime: slot.time,
      itemType: isPaid ? "paid_note" : "free_note",
      title: isPaid ? "有料note：深掘り・実践記事を投稿" : "無料note：入口・役立ち記事を投稿",
      theme,
      status: "planned",
      source: "generated",
      notes: isPaid
        ? "無料記事から自然につながるテーマか確認してから投稿。"
        : "読者の悩みを1つに絞り、次に読みたい内容へつなげる。",
    });
  });

  for (let week = 0; week < weeks; week += 1) {
    items.push({
      scheduledDate: addNoteScheduleDays(startDate, week * 7 + 6),
      scheduledTime: "21:30",
      itemType: "review",
      title: "今週のnote運営を振り返る",
      theme: "",
      status: "planned",
      source: "generated",
      notes: "閲覧・反応・続けやすさを確認し、次週の頻度やテーマを調整する。",
    });
  }

  return items
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.scheduledTime.localeCompare(b.scheduledTime))
    .slice(0, 500);
}

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

export async function replaceNoteScheduleMonth(
  client: SupabaseClient,
  userId: string,
  targetMonth: string,
  items: NoteScheduleItem[],
): Promise<NoteScheduleItem[]> {
  const rows = await replaceNoteScheduleAtomically(client, userId, items, targetMonth);
  return rows.map(parseScheduleRow);
}

export async function saveNoteAiSchedulePlan(
  client: SupabaseClient,
  userId: string,
  plan: NoteAiSchedulePlan,
): Promise<void> {
  const { error } = await client.from("note_operation_schedule_plans").upsert({
    user_id: userId,
    target_month: plan.targetMonth + "-01",
    ai_provider: plan.provider,
    generated_for_date: plan.generatedForJst,
    research_summary: plan.researchSummary,
    strategy_summary: plan.strategySummary,
    assumptions: plan.assumptions,
    research_sources: plan.sources.map((source) => ({
      title: source.title,
      url: source.url,
      published_at: source.publishedAt,
      why_used: source.whyUsed,
    })),
    recommended_posts_per_week: plan.recommendation.postsPerWeek,
    recommended_paid_posts_per_week: plan.recommendation.paidPostsPerWeek,
    recommended_max_posts_per_day: plan.recommendation.maxPostsPerDay,
    total_posts: plan.recommendation.totalPosts,
    free_posts: plan.recommendation.freePosts,
    paid_posts: plan.recommendation.paidPosts,
    recommendation_reason: plan.recommendation.reason,
    applied_at: new Date().toISOString(),
  }, { onConflict: "user_id,target_month" });
  if (error) throw new Error("AIの調査結果を保存できませんでした。");
}

export async function loadNoteAiSchedulePlan(
  client: SupabaseClient,
  userId: string,
  targetMonth: string,
): Promise<NoteAiSchedulePlan | null> {
  const { data, error } = await client
    .from("note_operation_schedule_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("target_month", targetMonth + "-01")
    .maybeSingle();
  if (error) throw new Error("AI運用プランを読み込めませんでした。");
  if (!data) return null;
  const sourcesRaw = Array.isArray(data.research_sources) ? data.research_sources : [];
  const sources: NoteAiResearchSource[] = sourcesRaw.map((value: unknown) => {
    const source = asObject(value);
    return {
      title: typeof source.title === "string" ? source.title : "",
      url: safeHttpUrl(source.url),
      publishedAt: typeof source.published_at === "string" ? source.published_at : "",
      whyUsed: typeof source.why_used === "string" ? source.why_used : "",
    };
  }).filter((source: NoteAiResearchSource) => source.url);
  const monthSchedule = (await listNoteSchedule(client, userId, targetMonth + "-01", noteMonthBounds(targetMonth).end))
    .filter((item) => isNoteArticleScheduleItem(item));
  return {
    schema: "aas-note-schedule-v2",
    targetMonth,
    generatedForJst: typeof data.generated_for_date === "string" ? data.generated_for_date : todayJstDateKey(),
    provider: data.ai_provider === "gemini" || data.ai_provider === "claude" ? data.ai_provider : "chatgpt",
    researchSummary: typeof data.research_summary === "string" ? data.research_summary : "",
    strategySummary: typeof data.strategy_summary === "string" ? data.strategy_summary : "",
    assumptions: Array.isArray(data.assumptions) ? data.assumptions.filter((item: unknown): item is string => typeof item === "string") : [],
    sources,
    recommendation: {
      postsPerWeek: finiteNumber(data.recommended_posts_per_week),
      paidPostsPerWeek: finiteNumber(data.recommended_paid_posts_per_week),
      maxPostsPerDay: Math.round(finiteNumber(data.recommended_max_posts_per_day)),
      totalPosts: Math.round(finiteNumber(data.total_posts)),
      freePosts: Math.round(finiteNumber(data.free_posts)),
      paidPosts: Math.round(finiteNumber(data.paid_posts)),
      reason: typeof data.recommendation_reason === "string" ? data.recommendation_reason : "",
    },
    schedule: monthSchedule,
    warnings: [],
  };
}

export {
  exportNoteAiSchedulePlanJson,
  exportNoteOperationsJson,
  exportNoteScheduleCsv,
  parseNoteOperationsImport,
} from "@/lib/note-operations-transfer";
