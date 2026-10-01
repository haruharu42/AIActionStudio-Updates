import type { SupabaseClient } from "@supabase/supabase-js";

export const APP_RELEASE_EFFECTIVE_KEY = "aas-pwa-effective-release";
export const APP_RELEASE_STATE_EVENT = "aas-pwa-release-state";

export type AppDeploymentAudience = "public" | "preview";
export type AppDeploymentTier = "public" | "preview" | "canary";

export const AAS_PRODUCTION_CANARY_HOSTNAME = "ai-article-studio-pwa-canary.ai-article-studio.workers.dev";

export function appDeploymentTier(): AppDeploymentTier {
  if (typeof window !== "undefined" && window.location.hostname === AAS_PRODUCTION_CANARY_HOSTNAME) {
    return "canary";
  }
  return process.env.NEXT_PUBLIC_AAS_RELEASE_AUDIENCE === "preview" ? "preview" : "public";
}

export function appDeploymentAudience(): AppDeploymentAudience {
  return appDeploymentTier() === "public" ? "public" : "preview";
}

export type AppRelease = {
  id: string;
  version: string;
  title: string;
  notes: string;
  build_key: string;
  update_kind: "optional" | "required";
};

export type AppReleaseState = {
  signed_in: boolean;
  active?: boolean;
  configured?: boolean;
  is_admin?: boolean;
  is_release_tester?: boolean;
  preview_allowed?: boolean;
  candidate_stage?: "admin" | "tester" | null;
  is_admin_preview?: boolean;
  is_tester_preview?: boolean;
  current_release?: AppRelease | null;
  effective_release?: AppRelease | null;
  available_release?: AppRelease | null;
  update_required?: boolean;
};

export type AdminAppRelease = AppRelease & {
  status: "candidate" | "published" | "retired" | "rolled_back";
  created_at: string;
  published_at: string | null;
  retired_at: string | null;
  adopted_users: number;
};

export type AdminReleaseTester = {
  aas_user_id: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminReleaseSnapshot = {
  channel: {
    current_release_id: string | null;
    candidate_release_id: string | null;
    candidate_stage: "admin" | "tester" | null;
    updated_at: string | null;
  };
  releases: AdminAppRelease[];
  testers: AdminReleaseTester[];
};

function isRelease(value: unknown): value is AppRelease {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.version === "string" &&
    typeof row.title === "string" &&
    typeof row.notes === "string" &&
    typeof row.build_key === "string" &&
    (row.update_kind === "optional" || row.update_kind === "required")
  );
}

function normalizeState(value: unknown): AppReleaseState {
  if (!value || typeof value !== "object") return { signed_in: false };
  const row = value as Record<string, unknown>;
  return {
    signed_in: row.signed_in === true,
    active: row.active === true,
    configured: row.configured === true,
    is_admin: row.is_admin === true,
    is_release_tester: row.is_release_tester === true,
    preview_allowed: row.preview_allowed !== false,
    candidate_stage: row.candidate_stage === "admin" || row.candidate_stage === "tester" ? row.candidate_stage : null,
    is_admin_preview: row.is_admin_preview === true,
    is_tester_preview: row.is_tester_preview === true,
    current_release: isRelease(row.current_release) ? row.current_release : null,
    effective_release: isRelease(row.effective_release) ? row.effective_release : null,
    available_release: isRelease(row.available_release) ? row.available_release : null,
    update_required: row.update_required === true,
  };
}

function normalizeAdminSnapshot(value: unknown): AdminReleaseSnapshot {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawChannel = row.channel && typeof row.channel === "object" ? (row.channel as Record<string, unknown>) : {};
  const rawReleases = Array.isArray(row.releases) ? row.releases : [];
  const rawTesters = Array.isArray(row.testers) ? row.testers : [];
  const releases: AdminAppRelease[] = rawReleases.flatMap((item) => {
    if (!isRelease(item) || typeof item !== "object") return [];
    const release = item as Record<string, unknown>;
    const status = release.status;
    if (!["candidate", "published", "retired", "rolled_back"].includes(String(status))) return [];
    return [{
      ...item,
      status: status as AdminAppRelease["status"],
      created_at: typeof release.created_at === "string" ? release.created_at : "",
      published_at: typeof release.published_at === "string" ? release.published_at : null,
      retired_at: typeof release.retired_at === "string" ? release.retired_at : null,
      adopted_users: typeof release.adopted_users === "number" ? release.adopted_users : Number(release.adopted_users ?? 0),
    }];
  });

  const testers: AdminReleaseTester[] = rawTesters.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const tester = item as Record<string, unknown>;
    if (typeof tester.aas_user_id !== "string") return [];
    return [{
      aas_user_id: tester.aas_user_id,
      enabled: tester.enabled === true,
      created_at: typeof tester.created_at === "string" ? tester.created_at : "",
      updated_at: typeof tester.updated_at === "string" ? tester.updated_at : "",
    }];
  });

  return {
    channel: {
      current_release_id: typeof rawChannel.current_release_id === "string" ? rawChannel.current_release_id : null,
      candidate_release_id: typeof rawChannel.candidate_release_id === "string" ? rawChannel.candidate_release_id : null,
      candidate_stage: rawChannel.candidate_stage === "admin" || rawChannel.candidate_stage === "tester" ? rawChannel.candidate_stage : null,
      updated_at: typeof rawChannel.updated_at === "string" ? rawChannel.updated_at : null,
    },
    releases,
    testers,
  };
}

export function clearEffectiveRelease(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(APP_RELEASE_EFFECTIVE_KEY);
  delete document.documentElement.dataset.aasReleaseVersion;
  delete document.documentElement.dataset.aasReleaseBuild;
  window.dispatchEvent(new CustomEvent<AppReleaseState>(APP_RELEASE_STATE_EVENT, {
    detail: { signed_in: false },
  }));
}

export function persistEffectiveRelease(state: AppReleaseState): void {
  if (typeof window === "undefined") return;
  const release = state.effective_release ?? state.current_release ?? null;
  if (release) {
    window.localStorage.setItem(APP_RELEASE_EFFECTIVE_KEY, JSON.stringify(release));
    document.documentElement.dataset.aasReleaseVersion = release.version;
    document.documentElement.dataset.aasReleaseBuild = release.build_key;
  } else {
    window.localStorage.removeItem(APP_RELEASE_EFFECTIVE_KEY);
    delete document.documentElement.dataset.aasReleaseVersion;
    delete document.documentElement.dataset.aasReleaseBuild;
  }
  window.dispatchEvent(new CustomEvent<AppReleaseState>(APP_RELEASE_STATE_EVENT, { detail: state }));
}

export function readEffectiveRelease(): AppRelease | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(APP_RELEASE_EFFECTIVE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return isRelease(value) ? value : null;
  } catch {
    return null;
  }
}

export async function loadMyAppReleaseState(
  client: SupabaseClient,
  audience: AppDeploymentAudience = appDeploymentAudience(),
): Promise<AppReleaseState> {
  const { data, error } = await client.rpc("get_my_app_release_state", { p_audience: audience });
  if (error) throw error;
  const state = normalizeState(data);
  persistEffectiveRelease(state);
  return state;
}

export async function acceptAppRelease(client: SupabaseClient, releaseId: string): Promise<AppReleaseState> {
  const { data, error } = await client.rpc("accept_app_release", { p_release_id: releaseId });
  if (error) throw error;
  const state = normalizeState(data);
  persistEffectiveRelease(state);
  return state;
}

export async function adminListAppReleases(client: SupabaseClient): Promise<AdminReleaseSnapshot> {
  const { data, error } = await client.rpc("admin_list_app_releases");
  if (error) throw error;
  return normalizeAdminSnapshot(data);
}

export async function adminCreateAppRelease(
  client: SupabaseClient,
  input: { version: string; title: string; notes: string; updateKind: "optional" | "required"; buildKey: string },
): Promise<AdminReleaseSnapshot> {
  const { data, error } = await client.rpc("admin_create_app_release", {
    p_version: input.version,
    p_title: input.title,
    p_notes: input.notes,
    p_update_kind: input.updateKind,
    p_build_key: input.buildKey,
  });
  if (error) throw error;
  return normalizeAdminSnapshot(data);
}

export async function adminPromoteAppReleaseToTesters(client: SupabaseClient, releaseId: string): Promise<AdminReleaseSnapshot> {
  const { data, error } = await client.rpc("admin_promote_app_release_to_testers", { p_release_id: releaseId });
  if (error) throw error;
  return normalizeAdminSnapshot(data);
}

export async function adminSetAppReleaseTester(
  client: SupabaseClient,
  aasUserId: string,
  enabled: boolean,
): Promise<AdminReleaseSnapshot> {
  const { data, error } = await client.rpc("admin_set_app_release_tester", {
    p_aas_user_id: aasUserId,
    p_enabled: enabled,
  });
  if (error) throw error;
  return normalizeAdminSnapshot(data);
}

export async function adminPublishAppRelease(client: SupabaseClient, releaseId: string): Promise<AdminReleaseSnapshot> {
  const { data, error } = await client.rpc("admin_publish_app_release", { p_release_id: releaseId });
  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (message.includes("aal2 required for public release publish")) {
      throw new Error("全体公開には現在の管理者セッションでMFA認証（AAL2）が必要です。管理者MFA画面で再認証してください。");
    }
    throw error;
  }
  return normalizeAdminSnapshot(data);
}

export async function adminRollbackAppRelease(client: SupabaseClient, targetReleaseId: string): Promise<AdminReleaseSnapshot> {
  const { data, error } = await client.rpc("admin_rollback_app_release", { p_target_release_id: targetReleaseId });
  if (error) throw error;
  return normalizeAdminSnapshot(data);
}


function numericVersion(value: string): [number, number, number] | null {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function releaseVersionAtLeast(currentVersion: string | null | undefined, minimumVersion: string): boolean {
  if (!currentVersion) return false;
  const current = numericVersion(currentVersion);
  const minimum = numericVersion(minimumVersion);
  if (!current || !minimum) return false;
  for (let index = 0; index < 3; index += 1) {
    if (current[index] > minimum[index]) return true;
    if (current[index] < minimum[index]) return false;
  }
  return true;
}
