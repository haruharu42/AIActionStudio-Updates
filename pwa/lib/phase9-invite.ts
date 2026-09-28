import type { SupabaseClient } from "@supabase/supabase-js";

export type InviteRedeemResult = {
  aasUserId: string;
  productCode: string;
  entitlementStatus: string;
  entitlementExpiresAt: string | null;
  profileStatus: string;
};

function row(value: unknown): Record<string, unknown> {
  const singleton = Array.isArray(value) ? value[0] : value;
  if (!singleton || typeof singleton !== "object" || Array.isArray(singleton)) {
    throw new Error("利用コードの応答形式が不正です。");
  }
  return singleton as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) throw new Error(`${label}の形式が不正です。`);
  return value;
}

export async function redeemPwaInvite(
  client: SupabaseClient,
  inviteCode: string,
): Promise<InviteRedeemResult> {
  const normalized = inviteCode.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error("利用コードの形式が正しくありません。");
  }

  const { data, error } = await client.rpc("redeem_pwa_invite", {
    p_invite_code: normalized,
  });
  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (message.includes("access code redemption is disabled")) {
      throw new Error("現在、利用コードの新規受付は停止しています。");
    }
    if (message.includes("entitlement already active")) {
      throw new Error("このアカウントには有効なPWA利用権がすでにあります。");
    }
    if (message.includes("unavailable") || message.includes("not found")) {
      throw new Error("この利用コードは使用できません。期限・利用回数を確認してください。");
    }
    if (message.includes("already redeemed")) {
      throw new Error("この利用コードはこのアカウントですでに使用されています。");
    }
    throw new Error("利用コードの確認に失敗しました。");
  }

  const parsed = row(data);
  return {
    aasUserId: text(parsed.aas_user_id, "AAS ID"),
    productCode: text(parsed.product_code, "商品コード"),
    entitlementStatus: text(parsed.entitlement_status, "利用権状態"),
    entitlementExpiresAt:
      parsed.entitlement_expires_at === null
        ? null
        : text(parsed.entitlement_expires_at, "利用期限"),
    profileStatus: text(parsed.profile_status, "プロフィール状態"),
  };
}
