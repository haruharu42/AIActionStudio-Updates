import type { SupabaseClient } from "@supabase/supabase-js";

import { notifySalesLaunchStateChanged } from "@/lib/sales-launch-readiness";

export type SellerType = "individual" | "business";
export type SellerDisclosureMode = "public" | "on_request";

export type CommerceSellerSettings = {
  sellerType: SellerType;
  disclosureMode: SellerDisclosureMode;
  name: string;
  address: string;
  phone: string;
  email: string;
  supportUrl: string;
  ready: boolean;
  updatedAt?: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseSellerSettings(value: unknown): CommerceSellerSettings {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("販売者情報を確認できませんでした。");
  }
  const item = row as Record<string, unknown>;
  return {
    sellerType: item.seller_type === "business" ? "business" : "individual",
    disclosureMode: item.seller_disclosure_mode === "public" ? "public" : "on_request",
    name: text(item.seller_name),
    address: text(item.seller_address),
    phone: text(item.seller_phone),
    email: text(item.seller_email),
    supportUrl: text(item.seller_support_url),
    ready: item.seller_ready === true,
    updatedAt: typeof item.updated_at === "string" ? item.updated_at : undefined,
  };
}

export async function loadAdminSellerSettings(client: SupabaseClient): Promise<CommerceSellerSettings> {
  const { data, error } = await client.rpc("admin_get_commerce_seller_settings");
  if (error) throw new Error("販売者情報を取得できませんでした。");
  return parseSellerSettings(data);
}

export async function updateAdminSellerSettings(
  client: SupabaseClient,
  settings: CommerceSellerSettings,
): Promise<void> {
  const supportUrl = settings.supportUrl.trim();
  if (supportUrl) {
    let parsed: URL;
    try {
      parsed = new URL(supportUrl);
    } catch {
      throw new Error("サポートURLは有効なHTTPS URLを入力してください。");
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      throw new Error("サポートURLは認証情報を含まないHTTPS URLを入力してください。");
    }
  }

  const email = settings.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("販売者メールアドレスの形式を確認してください。");
  }

  const { error } = await client.rpc("admin_update_commerce_seller_settings", {
    p_seller_type: settings.sellerType,
    p_seller_disclosure_mode: settings.disclosureMode,
    p_seller_name: settings.name.trim() || null,
    p_seller_address: settings.address.trim() || null,
    p_seller_phone: settings.phone.trim() || null,
    p_seller_email: email || null,
    p_seller_support_url: supportUrl || null,
  });
  if (error) throw new Error("販売者情報を保存できませんでした。");
  notifySalesLaunchStateChanged();
}
