import type { SupabaseClient } from "@supabase/supabase-js";

export type SalesLaunchReadinessSnapshot = {
  persistedExternalSalesEnabled: boolean;
  persistedAccessCodeEnabled: boolean;
  persistedPurchaseUrlReady: boolean;
  sellerReady: boolean;
  usableInviteCount: number;
  verifiedMfaCount: number;
  persistedAutomatedReady: boolean;
  settingsUpdatedAt: string;
};

function singleton(value: unknown): Record<string, unknown> {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("販売前チェックの応答形式が不正です。");
  }
  return row as Record<string, unknown>;
}

function integer(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name}の形式が不正です。`);
  }
  return value;
}

export async function loadSalesLaunchReadiness(
  client: SupabaseClient,
): Promise<SalesLaunchReadinessSnapshot> {
  const { data, error } = await client.rpc("admin_get_sales_launch_readiness");
  if (error) throw new Error("販売前チェックを取得できませんでした。");

  const row = singleton(data);
  return {
    persistedExternalSalesEnabled: row.persisted_external_sales_enabled === true,
    persistedAccessCodeEnabled: row.persisted_access_code_enabled === true,
    persistedPurchaseUrlReady: row.persisted_purchase_url_ready === true,
    sellerReady: row.seller_ready === true,
    usableInviteCount: integer(row.usable_invite_count, "利用コード件数"),
    verifiedMfaCount: integer(row.verified_mfa_count, "MFA件数"),
    persistedAutomatedReady: row.persisted_automated_ready === true,
    settingsUpdatedAt: typeof row.settings_updated_at === "string" ? row.settings_updated_at : "",
  };
}


export type PublicSalesApproval = {
  approved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
};

function parseApproval(value: unknown): PublicSalesApproval {
  const row = singleton(value);
  return {
    approved: row.public_sales_approved === true,
    approvedAt: typeof row.public_sales_approved_at === "string" ? row.public_sales_approved_at : null,
    approvedBy: typeof row.public_sales_approved_by === "string" ? row.public_sales_approved_by : null,
  };
}

export async function loadPublicSalesApproval(
  client: SupabaseClient,
): Promise<PublicSalesApproval> {
  const { data, error } = await client.rpc("admin_get_public_sales_approval");
  if (error) throw new Error("公開販売承認の状態を取得できませんでした。");
  return parseApproval(data);
}

export async function setPublicSalesApproval(
  client: SupabaseClient,
  approved: boolean,
): Promise<PublicSalesApproval> {
  const { data, error } = await client.rpc("admin_set_public_sales_approval", {
    p_approved: approved,
  });
  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (message.includes("sales launch readiness requirements not met")) {
      throw new Error("販売前の自動確認が未完了のため、公開販売を承認できません。");
    }
    throw new Error(approved ? "公開販売を承認できませんでした。" : "公開販売を停止できませんでした。");
  }
  return parseApproval(data);
}
