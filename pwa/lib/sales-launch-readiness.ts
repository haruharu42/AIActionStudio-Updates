import type { SupabaseClient } from "@supabase/supabase-js";

export const SALES_LAUNCH_STATE_EVENT = "aas:sales-launch-state-changed";

export function notifySalesLaunchStateChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SALES_LAUNCH_STATE_EVENT));
}

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


export type StripeBillingPlanReadiness = {
  planCode: "AAS-PWA-7DAY" | "AAS-PWA-MONTHLY";
  priceConfigured: boolean;
  priceReachable: boolean;
  active: boolean;
  modeMatches: boolean;
  ready: boolean;
};

export type StripeBillingReadiness = {
  mode: "off" | "test" | "live";
  supabaseConfigured: boolean;
  stripeSecretConfigured: boolean;
  webhookSecretConfigured: boolean;
  sellerReady: boolean;
  backendReady: boolean;
  plans: StripeBillingPlanReadiness[];
};

function parseStripeBillingReadiness(value: unknown): StripeBillingReadiness {
  const row = singleton(value);
  const mode = row.mode === "live" || row.mode === "test" ? row.mode : "off";
  const plans = Array.isArray(row.plans)
    ? row.plans.flatMap((item): StripeBillingPlanReadiness[] => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const plan = item as Record<string, unknown>;
        const planCode = plan.planCode === "AAS-PWA-7DAY" || plan.planCode === "AAS-PWA-MONTHLY"
          ? plan.planCode
          : null;
        if (!planCode) return [];
        return [{
          planCode,
          priceConfigured: plan.priceConfigured === true,
          priceReachable: plan.priceReachable === true,
          active: plan.active === true,
          modeMatches: plan.modeMatches === true,
          ready: plan.ready === true,
        }];
      })
    : [];

  return {
    mode,
    supabaseConfigured: row.supabaseConfigured === true,
    stripeSecretConfigured: row.stripeSecretConfigured === true,
    webhookSecretConfigured: row.webhookSecretConfigured === true,
    sellerReady: row.sellerReady === true,
    backendReady: row.backendReady === true,
    plans,
  };
}

export async function loadStripeBillingReadiness(
  client: SupabaseClient,
): Promise<StripeBillingReadiness> {
  const { data, error } = await client.auth.getSession();
  const token = data.session?.access_token ?? "";
  if (error || !token) throw new Error("Stripe販売診断には管理者ログインが必要です。");

  const response = await fetch("/api/billing/admin-readiness", {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Stripe販売のWorker設定を確認できませんでした。");
  return parseStripeBillingReadiness(await response.json());
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
    if (message.includes("aal2 required for public sales approval")) {
      throw new Error("公開販売の承認には、現在の管理者セッションでMFA認証（AAL2）が必要です。管理者MFAを完了してから再度承認してください。");
    }
    if (message.includes("sales launch readiness requirements not met")) {
      throw new Error("販売前の自動確認が未完了のため、公開販売を承認できません。");
    }
    throw new Error(approved ? "公開販売を承認できませんでした。" : "公開販売を停止できませんでした。");
  }
  const result = parseApproval(data);
  notifySalesLaunchStateChanged();
  return result;
}
