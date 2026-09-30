import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadOpsSnapshot,
  refreshOpsCapacity,
  type OpsCapacity,
} from "@/lib/operations-admin";

const MIB = 1024 ** 2;
const GIB = 1024 ** 3;

export const AAS_GITHUB_REPOSITORY = "haruharu42/AIActionStudio-Updates";
export const GITHUB_REPOSITORY_RECOMMENDED_BYTES = 10 * GIB;
export const GITHUB_CACHE_INCLUDED_BYTES = 10 * GIB;
export const GITHUB_SHARED_STORAGE_OVERAGE_USD_PER_GB_MONTH = 0.25;
export const GITHUB_CACHE_OVERAGE_USD_PER_GB_MONTH = 0.07;
export const SUPABASE_STORAGE_OVERAGE_USD_PER_GB_MONTH = 0.0213;
export const SUPABASE_GP3_DISK_OVERAGE_USD_PER_GB_MONTH = 0.125;
export const INFRASTRUCTURE_PRICING_REFERENCE_DATE = "2026-09-28";

const GITHUB_PLAN_STORAGE_KEY = "aas-admin-infrastructure-github-plan:v1";

export type GitHubPlan = "free" | "pro" | "team" | "enterprise";

export type GitHubPlanReference = {
  label: string;
  actionsMinutesPerMonth: number;
  artifactStorageBytes: number;
  packageStorageBytes: number;
  cacheStorageBytes: number;
};

const GITHUB_PLAN_REFERENCES: Record<GitHubPlan, GitHubPlanReference> = {
  free: {
    label: "GitHub Free",
    actionsMinutesPerMonth: 2_000,
    artifactStorageBytes: 500 * MIB,
    packageStorageBytes: 500 * MIB,
    cacheStorageBytes: GITHUB_CACHE_INCLUDED_BYTES,
  },
  pro: {
    label: "GitHub Pro",
    actionsMinutesPerMonth: 3_000,
    artifactStorageBytes: 1 * GIB,
    packageStorageBytes: 2 * GIB,
    cacheStorageBytes: GITHUB_CACHE_INCLUDED_BYTES,
  },
  team: {
    label: "GitHub Team",
    actionsMinutesPerMonth: 3_000,
    artifactStorageBytes: 2 * GIB,
    packageStorageBytes: 2 * GIB,
    cacheStorageBytes: GITHUB_CACHE_INCLUDED_BYTES,
  },
  enterprise: {
    label: "GitHub Enterprise Cloud",
    actionsMinutesPerMonth: 50_000,
    artifactStorageBytes: 50 * GIB,
    packageStorageBytes: 50 * GIB,
    cacheStorageBytes: GITHUB_CACHE_INCLUDED_BYTES,
  },
};

export type SupabasePlanReference = {
  label: string;
  databaseOrDiskIncludedBytes: number | null;
  databaseLabel: string;
  storageIncludedBytes: number | null;
  note: string;
};

export type GitHubUsage = {
  repository: {
    fullName: string;
    isPrivate: boolean;
    sizeBytes: number | null;
    recommendedLimitBytes: number;
    remainingRecommendedBytes: number | null;
    percentOfRecommended: number | null;
    updatedAt: string | null;
  };
  actions: {
    workflowRunsThisMonth: number | null;
    latestRunAt: string | null;
    publicStandardRunnerFree: boolean;
    artifactUsedBytes: number | null;
    artifactCount: number | null;
    artifactPartial: boolean;
    artifactLimitBytes: number;
    artifactRemainingBytes: number | null;
    cacheUsedBytes: number | null;
    cacheCount: number | null;
    cachePartial: boolean;
    cacheLimitBytes: number;
    cacheRemainingBytes: number | null;
  };
  plan: GitHubPlanReference;
  checkedAt: string;
  warnings: string[];
};

export type InfrastructureUsageSnapshot = {
  supabase: OpsCapacity;
  github: GitHubUsage;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function percentage(used: number | null, limit: number): number | null {
  if (used === null || limit <= 0) return null;
  return Math.round((used / limit) * 10_000) / 100;
}

function remaining(used: number | null, limit: number): number | null {
  return used === null ? null : Math.max(0, limit - used);
}

async function fetchGitHubJson(path: string): Promise<unknown> {
  const response = await fetch(`https://api.github.com/repos/${AAS_GITHUB_REPOSITORY}${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  return response.json() as Promise<unknown>;
}

function monthStartIso(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function githubPlanReference(plan: GitHubPlan): GitHubPlanReference {
  return GITHUB_PLAN_REFERENCES[plan];
}

export function readAdminGitHubPlan(): GitHubPlan {
  if (typeof window === "undefined") return "free";
  const value = window.localStorage.getItem(GITHUB_PLAN_STORAGE_KEY);
  return value === "pro" || value === "team" || value === "enterprise" ? value : "free";
}

export function writeAdminGitHubPlan(plan: GitHubPlan): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GITHUB_PLAN_STORAGE_KEY, plan);
}

export function supabasePlanReference(planLabel: string): SupabasePlanReference {
  const normalized = planLabel.trim().toLowerCase();
  if (normalized === "free") {
    return {
      label: "Free",
      databaseOrDiskIncludedBytes: 500 * MIB,
      databaseLabel: "Database size",
      storageIncludedBytes: 1 * GIB,
      note: "FreeはDatabase sizeが500MBを超えるとread-only制限の対象です。Storageは1GB枠です。",
    };
  }
  if (normalized === "pro" || normalized === "team") {
    return {
      label: normalized === "pro" ? "Pro" : "Team",
      databaseOrDiskIncludedBytes: 8 * GIB,
      databaseLabel: "Primary disk (gp3)",
      storageIncludedBytes: 100 * GIB,
      note: "有料プランのDatabaseは実データ量ではなくprovisioned disk課金です。Storage枠は組織全体で共有されます。",
    };
  }
  return {
    label: planLabel || "Custom",
    databaseOrDiskIncludedBytes: null,
    databaseLabel: "Database / Disk",
    storageIncludedBytes: null,
    note: "Enterprise/Customの契約量は契約内容に依存します。管理画面の設定値と公式Usageを確認してください。",
  };
}

export async function loadGitHubUsage(
  plan: GitHubPlan,
  now: Date = new Date(),
): Promise<GitHubUsage> {
  const planRef = githubPlanReference(plan);
  const warnings: string[] = [];

  const repoPromise = fetchGitHubJson("");
  const runsPromise = fetchGitHubJson(
    `/actions/runs?created=${encodeURIComponent(`>=${monthStartIso(now)}`)}&per_page=1`,
  );
  const artifactsPromise = fetchGitHubJson("/actions/artifacts?per_page=100");
  const cachesPromise = fetchGitHubJson("/actions/caches?per_page=100");

  const [repoResult, runsResult, artifactsResult, cachesResult] = await Promise.allSettled([
    repoPromise,
    runsPromise,
    artifactsPromise,
    cachesPromise,
  ]);

  const repo = repoResult.status === "fulfilled" ? asRecord(repoResult.value) : {};
  if (repoResult.status === "rejected") warnings.push("GitHubリポジトリ情報を取得できませんでした。");
  const isPrivate = repo.private === true;
  const sizeKb = asNumber(repo.size);
  const sizeBytes = sizeKb === null ? null : Math.max(0, Math.round(sizeKb * 1024));

  const runs = runsResult.status === "fulfilled" ? asRecord(runsResult.value) : {};
  if (runsResult.status === "rejected") warnings.push("今月のGitHub Actions実行数を取得できませんでした。");
  const workflowRunsThisMonth = asNumber(runs.total_count);
  const firstRun = asRecord(asArray(runs.workflow_runs)[0]);
  const latestRunAt = asString(firstRun.created_at);

  let artifactUsedBytes: number | null = null;
  let artifactCount: number | null = null;
  let artifactPartial = false;
  if (artifactsResult.status === "fulfilled") {
    const root = asRecord(artifactsResult.value);
    const artifacts = asArray(root.artifacts).map(asRecord).filter((item) => item.expired !== true);
    artifactUsedBytes = artifacts.reduce((sum, item) => sum + (asNumber(item.size_in_bytes) ?? 0), 0);
    artifactCount = asNumber(root.total_count) ?? artifacts.length;
    artifactPartial = (artifactCount ?? 0) > artifacts.length;
  } else {
    warnings.push("Actions Artifactの現在容量は公開API権限では取得できません。GitHub Billingの値を優先してください。");
  }

  let cacheUsedBytes: number | null = null;
  let cacheCount: number | null = null;
  let cachePartial = false;
  if (cachesResult.status === "fulfilled") {
    const root = asRecord(cachesResult.value);
    const caches = asArray(root.actions_caches).map(asRecord);
    cacheUsedBytes = caches.reduce((sum, item) => sum + (asNumber(item.size_in_bytes) ?? 0), 0);
    cacheCount = asNumber(root.total_count) ?? caches.length;
    cachePartial = (cacheCount ?? 0) > caches.length;
  } else {
    warnings.push("Actions Cacheの現在容量は公開API権限では取得できません。GitHub Billingの値を優先してください。");
  }

  return {
    repository: {
      fullName: asString(repo.full_name) ?? AAS_GITHUB_REPOSITORY,
      isPrivate,
      sizeBytes,
      recommendedLimitBytes: GITHUB_REPOSITORY_RECOMMENDED_BYTES,
      remainingRecommendedBytes: remaining(sizeBytes, GITHUB_REPOSITORY_RECOMMENDED_BYTES),
      percentOfRecommended: percentage(sizeBytes, GITHUB_REPOSITORY_RECOMMENDED_BYTES),
      updatedAt: asString(repo.updated_at),
    },
    actions: {
      workflowRunsThisMonth,
      latestRunAt,
      publicStandardRunnerFree: !isPrivate,
      artifactUsedBytes,
      artifactCount,
      artifactPartial,
      artifactLimitBytes: planRef.artifactStorageBytes,
      artifactRemainingBytes: remaining(artifactUsedBytes, planRef.artifactStorageBytes),
      cacheUsedBytes,
      cacheCount,
      cachePartial,
      cacheLimitBytes: planRef.cacheStorageBytes,
      cacheRemainingBytes: remaining(cacheUsedBytes, planRef.cacheStorageBytes),
    },
    plan: planRef,
    checkedAt: new Date().toISOString(),
    warnings,
  };
}

export async function loadInfrastructureUsage(
  client: SupabaseClient,
  githubPlan: GitHubPlan,
  options: { refreshSupabase?: boolean } = {},
): Promise<InfrastructureUsageSnapshot> {
  if (options.refreshSupabase) {
    await refreshOpsCapacity(client);
  }
  const [ops, github] = await Promise.all([
    loadOpsSnapshot(client),
    loadGitHubUsage(githubPlan),
  ]);
  return { supabase: ops.capacity, github };
}
