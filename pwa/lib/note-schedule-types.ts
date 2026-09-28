import type { AiProvider } from "@/lib/user-personalization";
import type { NoteOperationProfile } from "@/lib/note-operation-profile";

export type NoteScheduleItemType = "free_note" | "paid_note" | "review" | "profile_setup" | "sns_share";
export type NoteScheduleStatus = "planned" | "done" | "skipped";
export type NoteScheduleSource = "generated" | "imported" | "manual";

export type NoteScheduleItem = {
  id?: string;
  userId?: string;
  scheduledDate: string;
  scheduledTime: string;
  itemType: NoteScheduleItemType;
  title: string;
  theme: string;
  status: NoteScheduleStatus;
  source: NoteScheduleSource;
  notes: string;
};

export type NoteScheduleImport = {
  profile: Partial<NoteOperationProfile> | null;
  schedule: NoteScheduleItem[];
};

export type NoteAiResearchSource = {
  title: string;
  url: string;
  publishedAt: string;
  whyUsed: string;
};

export type NoteAiScheduleRecommendation = {
  postsPerWeek: number;
  paidPostsPerWeek: number;
  maxPostsPerDay: number;
  totalPosts: number;
  freePosts: number;
  paidPosts: number;
  reason: string;
};

export type NoteAiSchedulePlan = {
  schema: "aas-note-schedule-v2";
  targetMonth: string;
  generatedForJst: string;
  provider: AiProvider;
  researchSummary: string;
  strategySummary: string;
  assumptions: string[];
  sources: NoteAiResearchSource[];
  recommendation: NoteAiScheduleRecommendation;
  schedule: NoteScheduleItem[];
  warnings: string[];
};

export type NoteSchedulePerformanceBreakdown = {
  key: string;
  scheduled: number;
  done: number;
  skipped: number;
  remainingPlanned: number;
};

export type NoteSchedulePerformanceSnapshot = {
  targetMonth: string;
  scheduledPosts: number;
  donePosts: number;
  skippedPosts: number;
  remainingPlannedPosts: number;
  freeScheduled: number;
  paidScheduled: number;
  freeDone: number;
  paidDone: number;
  adherenceRate: number;
  weekdays: NoteSchedulePerformanceBreakdown[];
  times: NoteSchedulePerformanceBreakdown[];
};

export type NoteArticleOutputSnapshot = {
  targetMonth: string;
  createdPosts: number;
  freeCreated: number;
  paidCreated: number;
  draftLike: number;
  readyLike: number;
  published: number;
  statusCounts: Record<string, number>;
};
