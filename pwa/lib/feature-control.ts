import type { SupabaseClient } from "@supabase/supabase-js";

export type FeatureRolloutStage = "admin" | "tester" | "public";

export type AppFeatureControl = {
  featureKey: string;
  category: string;
  title: string;
  description: string;
  routePrefix: string | null;
  exactMatch: boolean;
  rolloutStage: FeatureRolloutStage;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  adminOnly: boolean;
  sortOrder: number;
  allowed: boolean;
  accessReason: string;
};

export type AppFeatureState = {
  signedIn: boolean;
  active: boolean;
  isAdmin: boolean;
  isReleaseTester: boolean;
  features: AppFeatureControl[];
};

export type AdminFeatureControl = Omit<AppFeatureControl, "allowed" | "accessReason"> & {
  updatedAt: string | null;
  updatedByAasId: string | null;
};

export type AdminFeatureSnapshot = {
  testerCount: number;
  testers: string[];
  features: AdminFeatureControl[];
};

export function validateFeatureRolloutTransition(
  currentStage: FeatureRolloutStage,
  targetStage: FeatureRolloutStage,
  activeTesterCount: number,
): string | null {
  if (currentStage === targetStage) return null;

  if (currentStage === "admin" && targetStage === "public") {
    return "全体公開の前に「AAS-000002等でテスト」段階を通してください。管理者のみから全一般ユーザーへ直接公開はできません。";
  }

  const isForwardToTester = currentStage === "admin" && targetStage === "tester";
  const isForwardToPublic = currentStage === "tester" && targetStage === "public";
  if ((isForwardToTester || isForwardToPublic) && activeTesterCount < 1) {
    return "段階反映にはactiveなテストユーザーが1件以上必要です。先にAAS-000002等のテストアカウントを登録してください。";
  }

  return null;
}

function rolloutStage(value: unknown): FeatureRolloutStage {
  return value === "admin" || value === "tester" || value === "public" ? value : "admin";
}

function featureFromRow(value: unknown): AppFeatureControl | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.feature_key !== "string" || typeof row.title !== "string") return null;
  return {
    featureKey: row.feature_key,
    category: typeof row.category === "string" ? row.category : "その他",
    title: row.title,
    description: typeof row.description === "string" ? row.description : "",
    routePrefix: typeof row.route_prefix === "string" ? row.route_prefix : null,
    exactMatch: row.exact_match === true,
    rolloutStage: rolloutStage(row.rollout_stage),
    maintenanceMode: row.maintenance_mode === true,
    maintenanceMessage: typeof row.maintenance_message === "string" ? row.maintenance_message : "",
    adminOnly: row.admin_only === true,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : Number(row.sort_order ?? 0),
    allowed: row.allowed === true,
    accessReason: typeof row.access_reason === "string" ? row.access_reason : "",
  };
}

export function normalizeFeatureState(value: unknown): AppFeatureState {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    signedIn: row.signed_in === true,
    active: row.active !== false,
    isAdmin: row.is_admin === true,
    isReleaseTester: row.is_release_tester === true,
    features: Array.isArray(row.features)
      ? row.features.flatMap((item) => {
          const feature = featureFromRow(item);
          return feature ? [feature] : [];
        })
      : [],
  };
}

export function normalizeAdminFeatureSnapshot(value: unknown): AdminFeatureSnapshot {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const features = Array.isArray(row.features)
    ? row.features.flatMap((item) => {
        const base = featureFromRow(item);
        if (!base || !item || typeof item !== "object") return [];
        const raw = item as Record<string, unknown>;
        const { allowed: _allowed, accessReason: _accessReason, ...rest } = base;
        void _allowed;
        void _accessReason;
        return [{
          ...rest,
          updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : null,
          updatedByAasId: typeof raw.updated_by_aas_id === "string" ? raw.updated_by_aas_id : null,
        }];
      })
    : [];

  const testers = Array.isArray(row.testers)
    ? row.testers.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const aasUserId = (item as Record<string, unknown>).aas_user_id;
        return typeof aasUserId === "string" ? [aasUserId] : [];
      })
    : [];

  return {
    testerCount: typeof row.tester_count === "number" ? row.tester_count : Number(row.tester_count ?? testers.length),
    testers,
    features,
  };
}

export async function loadMyAppFeatureControls(client: SupabaseClient): Promise<AppFeatureState> {
  const { data, error } = await client.rpc("get_my_app_feature_controls");
  if (error) throw error;
  return normalizeFeatureState(data);
}

export async function adminListAppFeatureControls(client: SupabaseClient): Promise<AdminFeatureSnapshot> {
  const { data, error } = await client.rpc("admin_list_app_feature_controls");
  if (error) throw error;
  return normalizeAdminFeatureSnapshot(data);
}

export async function adminUpdateAppFeatureControl(
  client: SupabaseClient,
  input: {
    featureKey: string;
    rolloutStage: FeatureRolloutStage;
    maintenanceMode: boolean;
    maintenanceMessage: string;
  },
): Promise<AdminFeatureSnapshot> {
  const { data, error } = await client.rpc("admin_update_app_feature_control", {
    p_feature_key: input.featureKey,
    p_rollout_stage: input.rolloutStage,
    p_maintenance_mode: input.maintenanceMode,
    p_maintenance_message: input.maintenanceMessage,
  });
  if (error) throw error;
  return normalizeAdminFeatureSnapshot(data);
}

function routeMatches(feature: AppFeatureControl, pathname: string): boolean {
  if (!feature.routePrefix) return false;
  if (feature.exactMatch) return pathname === feature.routePrefix;
  return pathname === feature.routePrefix || pathname.startsWith(feature.routePrefix + "/");
}

export function featureForPath(features: readonly AppFeatureControl[], pathname: string): AppFeatureControl | null {
  return [...features]
    .filter((feature) => routeMatches(feature, pathname))
    .sort((a, b) => (b.routePrefix?.length ?? 0) - (a.routePrefix?.length ?? 0))[0] ?? null;
}

export function featureByKey(features: readonly AppFeatureControl[], featureKey: string): AppFeatureControl | null {
  return features.find((feature) => feature.featureKey === featureKey) ?? null;
}
