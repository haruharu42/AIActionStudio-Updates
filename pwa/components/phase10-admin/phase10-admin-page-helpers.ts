import { getSupabaseClient } from "@/lib/supabase";
import {
  listUserEntitlements,
  type AdminEntitlement,
  type AdminInvite,
  type AdminUser,
} from "@/lib/phase10-admin";

const DAY_MS = 24 * 60 * 60 * 1000;

export function fmt(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function fmtDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function statusLabel(status: AdminUser["status"]): string {
  if (status === "pending") return "承認待ち";
  if (status === "active") return "利用中";
  if (status === "suspended") return "停止中";
  return "無効";
}

export function roleLabel(role: AdminUser["role"]): string {
  return role === "admin" ? "管理者" : "一般ユーザー";
}

export function entitlementStatusLabel(status: string): string {
  if (status === "active") return "有効";
  if (status === "revoked") return "取消済み";
  if (status === "expired") return "期限切れ";
  return status;
}

export function inviteStatusLabel(invite: AdminInvite): string {
  if (invite.status === "revoked") return "無効";
  if (invite.status === "exhausted") return "上限到達";
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) return "期限切れ";
  return "利用可能";
}

export function expiresWithin(value: string | null, days: number): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  const now = Date.now();
  return Number.isFinite(time) && time > now && time <= now + days * DAY_MS;
}

export function isCurrentEntitlement(item: AdminEntitlement): boolean {
  if (item.status !== "active") return false;
  if (!item.expiresAt) return true;
  const time = new Date(item.expiresAt).getTime();
  return Number.isFinite(time) && time > Date.now();
}

export function isUsableInvite(invite: AdminInvite): boolean {
  if (invite.status !== "active") return false;
  if (!invite.expiresAt) return true;
  const time = new Date(invite.expiresAt).getTime();
  return Number.isFinite(time) && time > Date.now();
}

export function nearestExpiry(items: AdminEntitlement[]): string | null {
  const times = items
    .filter((item) => isCurrentEntitlement(item) && item.expiresAt)
    .map((item) => item.expiresAt as string)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return times[0] ?? null;
}

export async function loadEntitlementOverview(users: AdminUser[]): Promise<{
  map: Record<string, AdminEntitlement[]>;
  partial: boolean;
}> {
  const client = getSupabaseClient();
  const targets = users.filter((user) => user.role === "user");
  const entries: Array<[string, AdminEntitlement[]]> = [];
  let partial = false;

  for (let index = 0; index < targets.length; index += 6) {
    const batch = targets.slice(index, index + 6);
    const results = await Promise.allSettled(
      batch.map(async (user) => [user.id, await listUserEntitlements(client, user.id)] as [string, AdminEntitlement[]]),
    );
    results.forEach((result, resultIndex) => {
      if (result.status === "fulfilled") {
        entries.push(result.value);
      } else {
        partial = true;
        entries.push([batch[resultIndex].id, []]);
      }
    });
  }

  return { map: Object.fromEntries(entries), partial };
}
