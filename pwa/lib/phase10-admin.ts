import type { SupabaseClient } from "@supabase/supabase-js";

export const WINDOWS_PRODUCT = "AAS-WIN-BETA";
export const PWA_PRODUCT = "AAS-PWA-BETA";

export type AdminUser = {
  id: string;
  aasUserId: string;
  displayName: string | null;
  role: "user" | "admin";
  status: "pending" | "active" | "suspended" | "disabled";
  createdAt: string;
};

export type AdminEntitlement = {
  id: string;
  productCode: string;
  productName: string;
  platform: string;
  status: string;
  salesChannel: string;
  externalReference: string | null;
  grantedAt: string;
  expiresAt: string | null;
  updatedAt: string;
};

export type AdminInvite = {
  id: string;
  code: string;
  label: string | null;
  status: "active" | "exhausted" | "revoked";
  salesChannel: string;
  externalReference: string | null;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  entitlementExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error("管理APIの応答形式が不正です。");
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("管理APIの応答形式が不正です。");
    return item as Record<string, unknown>;
  });
}

function stringValue(value: unknown, name: string): string {
  if (typeof value !== "string") throw new Error(`${name}の形式が不正です。`);
  return value;
}

function nullableString(value: unknown, name: string): string | null {
  return value === null ? null : stringValue(value, name);
}

function integer(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`${name}の形式が不正です。`);
  return value;
}

function adminError(error: unknown, fallback: string): Error {
  const source = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const message = typeof source.message === "string" ? source.message : "";
  const lowered = message.toLowerCase();
  if (lowered.includes("active admin required")) return new Error("管理者権限を確認できません。再ログインしてください。");
  if (lowered.includes("invalid status transition")) return new Error("現在の状態ではその変更を実行できません。");
  if (lowered.includes("active entitlement not found")) return new Error("有効な利用権がありません。");
  return new Error(fallback);
}

export async function listAdminUsers(client: SupabaseClient, aasId = ""): Promise<AdminUser[]> {
  const { data, error } = await client.rpc("admin_list_users", {
    p_aas_user_id: aasId.trim() || null,
  });
  if (error) throw adminError(error, "ユーザー一覧の取得に失敗しました。");
  return asRows(data).map((row) => ({
    id: stringValue(row.id, "id"),
    aasUserId: stringValue(row.aas_user_id, "AAS ID"),
    displayName: nullableString(row.display_name, "表示名"),
    role: stringValue(row.role, "role") as AdminUser["role"],
    status: stringValue(row.status, "status") as AdminUser["status"],
    createdAt: stringValue(row.created_at, "created_at"),
  }));
}

export async function setAdminUserStatus(
  client: SupabaseClient,
  userId: string,
  status: "active" | "suspended",
): Promise<void> {
  const { error } = await client.rpc("admin_set_user_status", {
    p_target_user_id: userId,
    p_new_status: status,
  });
  if (error) throw adminError(error, "アカウント状態の変更に失敗しました。");
}

export async function listUserEntitlements(
  client: SupabaseClient,
  userId: string,
): Promise<AdminEntitlement[]> {
  const { data, error } = await client.rpc("admin_list_user_entitlements", {
    p_target_user_id: userId,
  });
  if (error) throw adminError(error, "利用権一覧の取得に失敗しました。");
  return asRows(data).map((row) => ({
    id: stringValue(row.id, "id"),
    productCode: stringValue(row.product_code, "product_code"),
    productName: stringValue(row.product_name, "product_name"),
    platform: stringValue(row.platform, "platform"),
    status: stringValue(row.status, "status"),
    salesChannel: stringValue(row.sales_channel, "sales_channel"),
    externalReference: nullableString(row.external_reference, "external_reference"),
    grantedAt: stringValue(row.granted_at, "granted_at"),
    expiresAt: nullableString(row.expires_at, "expires_at"),
    updatedAt: stringValue(row.updated_at, "updated_at"),
  }));
}

export async function grantEntitlement(
  client: SupabaseClient,
  userId: string,
  productCode: typeof WINDOWS_PRODUCT | typeof PWA_PRODUCT,
  options: { salesChannel: string; externalReference?: string; expiresAt?: string },
): Promise<void> {
  const { error } = await client.rpc("admin_grant_entitlement", {
    p_target_user_id: userId,
    p_product_code: productCode,
    p_expires_at: options.expiresAt || null,
    p_sales_channel: options.salesChannel.trim() || "admin",
    p_external_reference: options.externalReference?.trim() || null,
  });
  if (error) throw adminError(error, "利用権の付与に失敗しました。");
}

export async function revokeEntitlement(
  client: SupabaseClient,
  userId: string,
  productCode: typeof WINDOWS_PRODUCT | typeof PWA_PRODUCT,
): Promise<void> {
  const { error } = await client.rpc("admin_revoke_entitlement", {
    p_target_user_id: userId,
    p_product_code: productCode,
  });
  if (error) throw adminError(error, "利用権の取り消しに失敗しました。");
}

export async function createPwaInvite(
  client: SupabaseClient,
  input: {
    label?: string;
    salesChannel: string;
    externalReference?: string;
    expiresAt?: string;
    entitlementExpiresAt?: string;
    maxUses: number;
  },
): Promise<AdminInvite> {
  const { data, error } = await client.rpc("admin_create_pwa_invite", {
    p_label: input.label?.trim() || null,
    p_sales_channel: input.salesChannel.trim() || "admin-invite",
    p_external_reference: input.externalReference?.trim() || null,
    p_expires_at: input.expiresAt || null,
    p_entitlement_expires_at: input.entitlementExpiresAt || null,
    p_max_uses: input.maxUses,
  });
  if (error) throw adminError(error, "PWA招待コードの作成に失敗しました。");
  const rows = asRows(data);
  if (rows.length !== 1) throw new Error("招待コード作成結果が不正です。");
  return parseInvite(rows[0]);
}

function parseInvite(row: Record<string, unknown>): AdminInvite {
  return {
    id: stringValue(row.id, "id"),
    code: stringValue(row.invite_code, "invite_code"),
    label: nullableString(row.label, "label"),
    status: stringValue(row.status, "status") as AdminInvite["status"],
    salesChannel: stringValue(row.sales_channel, "sales_channel"),
    externalReference: nullableString(row.external_reference, "external_reference"),
    maxUses: integer(row.max_uses, "max_uses"),
    useCount: integer(row.use_count, "use_count"),
    expiresAt: nullableString(row.expires_at, "expires_at"),
    entitlementExpiresAt: nullableString(row.entitlement_expires_at, "entitlement_expires_at"),
    createdAt: stringValue(row.created_at, "created_at"),
    updatedAt: stringValue(row.updated_at ?? row.created_at, "updated_at"),
  };
}

export async function listPwaInvites(client: SupabaseClient): Promise<AdminInvite[]> {
  const { data, error } = await client.rpc("admin_list_pwa_invites", { p_status: null });
  if (error) throw adminError(error, "PWA招待コード一覧の取得に失敗しました。");
  return asRows(data).map(parseInvite);
}

export async function revokePwaInvite(client: SupabaseClient, inviteId: string): Promise<void> {
  const { error } = await client.rpc("admin_revoke_pwa_invite", { p_invite_id: inviteId });
  if (error) throw adminError(error, "招待コードの無効化に失敗しました。");
}
