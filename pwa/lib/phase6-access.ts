import type { SupabaseClient } from "@supabase/supabase-js";

import {
  PWA_PRODUCT_CODE,
  hasPwaEntitlement,
  loadCoreAccessState,
  type CoreAccessState,
} from "@/lib/access-control";
import { ensureMyFreeTrial } from "@/lib/free-trial";

export { PWA_PRODUCT_CODE };
export type { AasProfile, ProfileRole, ProfileStatus } from "@/lib/access-control";
export type AccessState = CoreAccessState;

function routeRootToPlansWhenEntitlementIsMissing(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/") return;
  window.location.replace("/plans?from=login");
}

export async function loadAccessState(
  client: SupabaseClient,
): Promise<AccessState> {
  const state = await loadCoreAccessState(client);
  if (state.kind !== "entitlement_denied") {
    return state;
  }

  // Existing paid/invite/admin access is checked by the shared access-control
  // boundary first. Only otherwise-unentitled active general users may start
  // the optional trial, after which authoritative access is checked again.
  if (state.profile.role === "user") {
    await ensureMyFreeTrial(client);
    if (await hasPwaEntitlement(client)) {
      return { kind: "ready", user: state.user, profile: state.profile };
    }
  }

  routeRootToPlansWhenEntitlementIsMissing();
  return state;
}

export function authMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lowered = message.toLowerCase();

  if (lowered.includes("invalid login credentials")) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }
  if (lowered.includes("email not confirmed")) {
    return "確認メール内のリンクを開いてからログインしてください。";
  }
  if (lowered.includes("user already registered")) {
    return "このメールアドレスは登録済みです。";
  }
  if (lowered.includes("pwned") || lowered.includes("leaked password") || lowered.includes("password has been leaked")) {
    return "このパスワードは漏洩済みパスワードとして検出されました。別サービスで使っていない新しいパスワードを設定してください。";
  }
  if (
    lowered.includes("weak password")
    || lowered.includes("weak_password")
    || lowered.includes("password should")
    || lowered.includes("password must")
  ) {
    return "パスワードの強度条件を満たしていません。より長く、推測されにくい新しいパスワードを設定してください。";
  }
  if (lowered.includes("password")) {
    return "パスワードを確認してください。";
  }
  if (lowered.includes("rate limit")) {
    return "操作が続いたため一時制限されています。時間をおいてください。";
  }
  return message || "認証処理に失敗しました。";
}
