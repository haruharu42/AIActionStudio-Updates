import type { SupabaseClient } from "@supabase/supabase-js";

export type MembershipSettings = {
  displayName: string;
  noteMembershipUrl: string;
  guidance: string;
  updatedAt: string | null;
};

export type MembershipPlan = {
  planCode: string;
  displayName: string;
  tierRank: number;
  badgeLabel: string;
  status: string;
  monthlyPriceYen: number | null;
  description: string;
  pricingManaged: boolean;
  articleLibraryLimit: number | null;
  articleLibraryUnlimited: boolean;
  articleLibraryManaged: boolean;
};

export type ArticleLibraryQuotaSettings = {
  freeLimit: number;
  planLimitsEnabled: boolean;
  updatedAt: string | null;
};

export type ArticleLibraryQuotaReadiness = {
  planLimitsEnabled: boolean;
  freeLimit: number;
  activeExpectedPlans: number;
  planConfigReady: boolean;
  activeGeneralUsers: number;
  usersOverFutureLimit: number;
  maxCurrentArticles: number;
  maxOverage: number;
  automatedChecksPass: boolean;
};

export type MembershipFeature = {
  featureKey: string;
  displayName: string;
  description: string;
  status: string;
  sortOrder: number;
};

export type MembershipPlanFeature = {
  planCode: string;
  featureKey: string;
  enabled: boolean;
  updatedAt: string | null;
};

function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error("メンバーシップ管理APIの応答形式が不正です。");
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("メンバーシップ管理APIの応答形式が不正です。");
    }
    return item as Record<string, unknown>;
  });
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("メンバーシップ管理APIの応答形式が不正です。");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field}の形式が不正です。`);
  return value;
}

function nullableText(value: unknown, field: string): string | null {
  return value === null || value === undefined ? null : text(value, field);
}

function integer(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`${field}の形式が不正です。`);
  }
  return value;
}

function nullableInteger(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  return integer(value, field);
}

function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${field}の形式が不正です。`);
  return value;
}

function adminError(error: unknown, fallback: string): Error {
  const source = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const message = typeof source.message === "string" ? source.message.toLowerCase() : "";
  if (message.includes("active admin required")) {
    return new Error("active管理者として確認できません。再ログインしてからお試しください。");
  }
  if (message.includes("invalid note membership url")) {
    return new Error("noteメンバーシップURLは https://note.com/ で始まるURLを入力してください。");
  }
  if (message.includes("membership plan not found")) {
    return new Error("指定したメンバーシッププランが見つかりません。");
  }
  if (message.includes("membership feature not found")) {
    return new Error("指定した特典機能が見つかりません。");
  }
  if (message.includes("invalid membership plan price")) {
    return new Error("月額料金は0〜1,000,000円の範囲で入力してください。");
  }
  if (message.includes("invalid article library plan limit")) {
    return new Error("記事ライブラリ保存上限は1〜100,000件の範囲で入力してください。");
  }
  if (message.includes("invalid article library free limit")) {
    return new Error("無料ユーザーの保存上限は1〜100,000件の範囲で入力してください。");
  }
  if (message.includes("aal2 required for article library quota activation")) {
    return new Error("プラン別保存上限の発効には管理者MFA認証（AAL2）が必要です。管理者MFA画面で再認証してください。");
  }
  if (message.includes("article library quota readiness requirements not met")) {
    return new Error("記事ライブラリ上限の公開前チェックを通過していません。超過ユーザーやプラン設定を確認してください。");
  }
  return new Error(fallback);
}

export async function getMembershipSettings(client: SupabaseClient): Promise<MembershipSettings> {
  const { data, error } = await client.rpc("admin_get_creator_membership_settings");
  if (error) throw adminError(error, "メンバーシップ設定を取得できませんでした。");
  const row = rows(data)[0];
  if (!row) throw new Error("メンバーシップ設定が見つかりません。");
  return {
    displayName: text(row.display_name, "display_name"),
    noteMembershipUrl: nullableText(row.note_membership_url, "note_membership_url") ?? "",
    guidance: text(row.guidance, "guidance"),
    updatedAt: nullableText(row.updated_at, "updated_at"),
  };
}

export async function updateMembershipSettings(
  client: SupabaseClient,
  input: { displayName: string; noteMembershipUrl: string; guidance: string },
): Promise<void> {
  const { error } = await client.rpc("admin_update_creator_membership_settings", {
    p_display_name: input.displayName.trim(),
    p_note_membership_url: input.noteMembershipUrl.trim() || null,
    p_guidance: input.guidance.trim(),
  });
  if (error) throw adminError(error, "メンバーシップ設定を保存できませんでした。");
}

export async function listMembershipPlans(client: SupabaseClient): Promise<MembershipPlan[]> {
  const v3 = await client.rpc("admin_list_creator_membership_plans_v3");
  if (!v3.error) {
    return rows(v3.data).map((row) => ({
      planCode: text(row.plan_code, "plan_code"),
      displayName: text(row.display_name, "display_name"),
      tierRank: integer(row.tier_rank, "tier_rank"),
      badgeLabel: text(row.badge_label, "badge_label"),
      status: text(row.status, "status"),
      monthlyPriceYen: nullableInteger(row.monthly_price_yen, "monthly_price_yen"),
      description: text(row.description, "description"),
      pricingManaged: true,
      articleLibraryLimit: nullableInteger(row.article_library_limit, "article_library_limit"),
      articleLibraryUnlimited: booleanValue(row.article_library_unlimited, "article_library_unlimited"),
      articleLibraryManaged: true,
    }));
  }

  const v2 = await client.rpc("admin_list_creator_membership_plans_v2");
  if (!v2.error) {
    return rows(v2.data).map((row) => ({
      planCode: text(row.plan_code, "plan_code"),
      displayName: text(row.display_name, "display_name"),
      tierRank: integer(row.tier_rank, "tier_rank"),
      badgeLabel: text(row.badge_label, "badge_label"),
      status: text(row.status, "status"),
      monthlyPriceYen: nullableInteger(row.monthly_price_yen, "monthly_price_yen"),
      description: text(row.description, "description"),
      pricingManaged: true,
      articleLibraryLimit: null,
      articleLibraryUnlimited: false,
      articleLibraryManaged: false,
    }));
  }

  const legacy = await client.rpc("admin_list_creator_membership_plans");
  if (legacy.error) throw adminError(legacy.error, "メンバーシッププランを取得できませんでした。");
  return rows(legacy.data).map((row) => ({
    planCode: text(row.plan_code, "plan_code"),
    displayName: text(row.display_name, "display_name"),
    tierRank: integer(row.tier_rank, "tier_rank"),
    badgeLabel: text(row.badge_label, "badge_label"),
    status: text(row.status, "status"),
    monthlyPriceYen: null,
    description: "",
    pricingManaged: false,
    articleLibraryLimit: null,
    articleLibraryUnlimited: false,
    articleLibraryManaged: false,
  }));
}

export async function updateMembershipPlan(
  client: SupabaseClient,
  input: { planCode: string; displayName: string; monthlyPriceYen: number | null; description: string },
): Promise<void> {
  const { error } = await client.rpc("admin_update_creator_membership_plan", {
    p_plan_code: input.planCode,
    p_display_name: input.displayName.trim(),
    p_monthly_price_yen: input.monthlyPriceYen,
    p_description: input.description.trim(),
  });
  if (error) throw adminError(error, "メンバーシッププランを保存できませんでした。");
}

export async function getArticleLibraryQuotaSettings(
  client: SupabaseClient,
): Promise<ArticleLibraryQuotaSettings> {
  const { data, error } = await client.rpc("admin_get_article_library_quota_settings");
  if (error) throw adminError(error, "記事ライブラリ保存上限を取得できませんでした。");
  const row = rows(data)[0];
  if (!row) throw new Error("記事ライブラリ保存上限の設定が見つかりません。");
  return {
    freeLimit: integer(row.free_limit, "free_limit"),
    planLimitsEnabled: booleanValue(row.plan_limits_enabled, "plan_limits_enabled"),
    updatedAt: nullableText(row.updated_at, "updated_at"),
  };
}

export async function updateArticleLibraryFreeLimit(
  client: SupabaseClient,
  freeLimit: number,
): Promise<void> {
  const { error } = await client.rpc("admin_update_article_library_quota_settings", {
    p_free_limit: freeLimit,
  });
  if (error) throw adminError(error, "無料ユーザーの記事ライブラリ保存上限を保存できませんでした。");
}

function normalizeArticleLibraryQuotaReadiness(value: unknown): ArticleLibraryQuotaReadiness {
  const row = record(value);
  return {
    planLimitsEnabled: row.plan_limits_enabled === true,
    freeLimit: integer(row.free_limit, "free_limit"),
    activeExpectedPlans: integer(row.active_expected_plans, "active_expected_plans"),
    planConfigReady: row.plan_config_ready === true,
    activeGeneralUsers: integer(row.active_general_users, "active_general_users"),
    usersOverFutureLimit: integer(row.users_over_future_limit, "users_over_future_limit"),
    maxCurrentArticles: integer(row.max_current_articles, "max_current_articles"),
    maxOverage: integer(row.max_overage, "max_overage"),
    automatedChecksPass: row.automated_checks_pass === true,
  };
}

export async function getArticleLibraryQuotaReadiness(
  client: SupabaseClient,
): Promise<ArticleLibraryQuotaReadiness> {
  const { data, error } = await client.rpc("admin_get_article_library_quota_readiness");
  if (error) throw adminError(error, "記事ライブラリ上限の公開前チェックを取得できませんでした。");
  return normalizeArticleLibraryQuotaReadiness(data);
}

export async function setArticleLibraryPlanLimitsEnabled(
  client: SupabaseClient,
  enabled: boolean,
): Promise<ArticleLibraryQuotaReadiness> {
  const { data, error } = await client.rpc("admin_set_article_library_plan_limits_enabled", {
    p_enabled: enabled,
  });
  if (error) throw adminError(error, enabled
    ? "プラン別の記事ライブラリ保存上限を発効できませんでした。"
    : "プラン別の記事ライブラリ保存上限を停止できませんでした。");
  return normalizeArticleLibraryQuotaReadiness(data);
}

export async function updateMembershipPlanArticleQuota(
  client: SupabaseClient,
  plan: MembershipPlan,
): Promise<void> {
  const { error } = await client.rpc("admin_update_creator_membership_plan_v2", {
    p_plan_code: plan.planCode,
    p_display_name: plan.displayName.trim(),
    p_monthly_price_yen: plan.monthlyPriceYen,
    p_description: plan.description.trim(),
    p_article_library_limit: plan.articleLibraryUnlimited ? null : plan.articleLibraryLimit,
    p_article_library_unlimited: plan.articleLibraryUnlimited,
  });
  if (error) throw adminError(error, "プラン別の記事ライブラリ保存上限を保存できませんでした。");
}

export async function listMembershipFeatures(client: SupabaseClient): Promise<MembershipFeature[]> {
  const { data, error } = await client.rpc("admin_list_creator_membership_features");
  if (error) throw adminError(error, "メンバー特典機能を取得できませんでした。");
  return rows(data).map((row) => ({
    featureKey: text(row.feature_key, "feature_key"),
    displayName: text(row.display_name, "display_name"),
    description: text(row.description, "description"),
    status: text(row.status, "status"),
    sortOrder: integer(row.sort_order, "sort_order"),
  }));
}

export async function listMembershipPlanFeatures(client: SupabaseClient): Promise<MembershipPlanFeature[]> {
  const { data, error } = await client.rpc("admin_list_creator_membership_plan_features");
  if (error) throw adminError(error, "プラン別特典設定を取得できませんでした。");
  return rows(data).map((row) => ({
    planCode: text(row.plan_code, "plan_code"),
    featureKey: text(row.feature_key, "feature_key"),
    enabled: booleanValue(row.enabled, "enabled"),
    updatedAt: nullableText(row.updated_at, "updated_at"),
  }));
}

export async function setMembershipPlanFeature(
  client: SupabaseClient,
  input: { planCode: string; featureKey: string; enabled: boolean },
): Promise<void> {
  const { error } = await client.rpc("admin_set_creator_membership_plan_feature", {
    p_plan_code: input.planCode,
    p_feature_key: input.featureKey,
    p_enabled: input.enabled,
  });
  if (error) throw adminError(error, "プランの特典機能を更新できませんでした。");
}


export type MembershipAssignment = {
  userId: string;
  aasUserId: string;
  displayName: string | null;
  planCode: string;
  planName: string;
  productCode: string;
  grantedAt: string;
  expiresAt: string | null;
  salesChannel: string;
  externalReference: string | null;
};

export type MembershipAuditAction = {
  id: number;
  actorUserId: string | null;
  targetUserId: string;
  targetAasUserId: string;
  targetDisplayName: string | null;
  productCode: string;
  action: "grant" | "update" | "revoke";
  oldStatus: string | null;
  newStatus: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export async function listMembershipAssignments(client: SupabaseClient): Promise<MembershipAssignment[]> {
  const { data, error } = await client.rpc("admin_list_creator_membership_assignments");
  if (error) throw adminError(error, "現在のメンバー一覧を取得できませんでした。");
  return rows(data).map((row) => ({
    userId: text(row.user_id, "user_id"),
    aasUserId: text(row.aas_user_id, "aas_user_id"),
    displayName: nullableText(row.display_name, "display_name"),
    planCode: text(row.plan_code, "plan_code"),
    planName: text(row.plan_name, "plan_name"),
    productCode: text(row.product_code, "product_code"),
    grantedAt: text(row.granted_at, "granted_at"),
    expiresAt: nullableText(row.expires_at, "expires_at"),
    salesChannel: text(row.sales_channel, "sales_channel"),
    externalReference: nullableText(row.external_reference, "external_reference"),
  }));
}

export async function listMembershipAuditActions(
  client: SupabaseClient,
  limit = 50,
): Promise<MembershipAuditAction[]> {
  const { data, error } = await client.rpc("admin_list_creator_membership_actions", {
    p_limit: Math.max(1, Math.min(200, Math.trunc(limit))),
  });
  if (error) throw adminError(error, "メンバーシップ監査ログを取得できませんでした。");
  return rows(data).map((row) => ({
    id: integer(row.id, "id"),
    actorUserId: nullableText(row.actor_user_id, "actor_user_id"),
    targetUserId: text(row.target_user_id, "target_user_id"),
    targetAasUserId: text(row.target_aas_user_id, "target_aas_user_id"),
    targetDisplayName: nullableText(row.target_display_name, "target_display_name"),
    productCode: text(row.product_code, "product_code"),
    action: text(row.action, "action") as MembershipAuditAction["action"],
    oldStatus: nullableText(row.old_status, "old_status"),
    newStatus: nullableText(row.new_status, "new_status"),
    expiresAt: nullableText(row.expires_at, "expires_at"),
    createdAt: text(row.created_at, "created_at"),
  }));
}
