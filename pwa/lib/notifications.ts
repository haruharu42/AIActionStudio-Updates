import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeNotificationPath } from "@/lib/notification-path";

export type NotificationCategory = "update" | "maintenance" | "knowledge" | "admin" | "system";
export type NotificationAudience = "all" | "tester" | "admin";

export type AppNotification = {
  id: number;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string;
  audience: NotificationAudience;
  createdAt: string;
  read: boolean;
};

export type NotificationInbox = {
  unreadCount: number;
  notifications: AppNotification[];
};

export type NotificationPreferences = {
  inAppEnabled: boolean;
  pushEnabled: boolean;
  updatesEnabled: boolean;
  maintenanceEnabled: boolean;
  knowledgeEnabled: boolean;
  adminMessagesEnabled: boolean;
};

export type AdminNotification = {
  id: number;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string;
  audience: NotificationAudience;
  createdAt: string;
  createdByAasId: string | null;
};

export type AdminNotificationReadiness = {
  featureStage: "admin" | "tester" | "public";
  maintenanceMode: boolean;
  pushEnabled: boolean;
  pushConfigReady: boolean;
  testerCount: number;
  testerPushUsers: number;
  enabledSubscriptions: number;
  deliveries: {
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    latestSentAt: string | null;
    latestFailedAt: string | null;
  };
  automatedChecksPass: boolean;
  manualChecksRequired: string[];
};

export type AdminNotificationReadinessIssue = {
  code:
    | "maintenance"
    | "push_disabled"
    | "push_config"
    | "no_testers"
    | "tester_push"
    | "queue"
    | "failed";
  title: string;
  detail: string;
  actionHref?: string;
  actionLabel?: string;
};

export type AdminNotificationTesterReadiness = {
  aasUserId: string;
  displayName: string;
  pushEnabled: boolean;
  enabledDeviceCount: number;
  healthyDeviceCount: number;
  errorDeviceCount: number;
  latestDeviceUpdatedAt: string | null;
};

export const NOTIFICATION_REFRESH_EVENT = "aas-notifications-refresh";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeCategory(value: unknown): NotificationCategory {
  return value === "update" || value === "maintenance" || value === "knowledge" || value === "admin" || value === "system"
    ? value
    : "system";
}

function normalizeAudience(value: unknown): NotificationAudience {
  return value === "tester" || value === "admin" || value === "all" ? value : "all";
}

function normalizeNotification(value: unknown): AppNotification | null {
  const row = asRecord(value);
  const id = Number(row.id);
  if (!Number.isSafeInteger(id) || typeof row.title !== "string") return null;
  return {
    id,
    category: normalizeCategory(row.category),
    title: row.title,
    body: typeof row.body === "string" ? row.body : "",
    href: normalizeNotificationPath(row.href),
    audience: normalizeAudience(row.audience),
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    read: row.read === true,
  };
}

export function normalizeNotificationInbox(value: unknown): NotificationInbox {
  const row = asRecord(value);
  return {
    unreadCount: Math.max(0, Number(row.unread_count ?? 0) || 0),
    notifications: Array.isArray(row.notifications)
      ? row.notifications.flatMap((item) => {
          const notification = normalizeNotification(item);
          return notification ? [notification] : [];
        })
      : [],
  };
}

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  const row = asRecord(value);
  return {
    inAppEnabled: row.in_app_enabled !== false,
    pushEnabled: row.push_enabled === true,
    updatesEnabled: row.updates_enabled !== false,
    maintenanceEnabled: row.maintenance_enabled !== false,
    knowledgeEnabled: row.knowledge_enabled !== false,
    adminMessagesEnabled: row.admin_messages_enabled !== false,
  };
}

export async function getMyNotifications(
  client: SupabaseClient,
  limit = 30,
  unreadOnly = false,
): Promise<NotificationInbox> {
  const { data, error } = await client.rpc("get_my_app_notifications_v2", {
    p_limit: limit,
    p_unread_only: unreadOnly,
  });
  if (error) throw error;
  return normalizeNotificationInbox(data);
}

export async function markNotificationRead(client: SupabaseClient, notificationId: number): Promise<void> {
  const { error } = await client.rpc("mark_my_app_notification_read_v2", { p_notification_id: notificationId });
  if (error) throw error;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NOTIFICATION_REFRESH_EVENT));
}

export async function markAllNotificationsRead(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.rpc("mark_all_my_app_notifications_read_v2");
  if (error) throw error;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NOTIFICATION_REFRESH_EVENT));
  return Number(data ?? 0) || 0;
}

export async function getNotificationPreferences(client: SupabaseClient): Promise<NotificationPreferences> {
  const { data, error } = await client.rpc("get_my_notification_preferences_v2");
  if (error) throw error;
  return normalizeNotificationPreferences(data);
}

export async function updateNotificationPreferences(
  client: SupabaseClient,
  preferences: NotificationPreferences,
): Promise<NotificationPreferences> {
  const { data, error } = await client.rpc("update_my_notification_preferences_v2", {
    p_in_app_enabled: preferences.inAppEnabled,
    p_push_enabled: preferences.pushEnabled,
    p_updates_enabled: preferences.updatesEnabled,
    p_maintenance_enabled: preferences.maintenanceEnabled,
    p_knowledge_enabled: preferences.knowledgeEnabled,
    p_admin_messages_enabled: preferences.adminMessagesEnabled,
  });
  if (error) throw error;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NOTIFICATION_REFRESH_EVENT));
  return normalizeNotificationPreferences(data);
}

export function browserPushSupported(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

export async function browserPushSubscriptionActive(client: SupabaseClient): Promise<boolean> {
  if (!browserPushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  const { data, error } = await client.rpc("is_my_push_subscription_enabled_v2", {
    p_endpoint: subscription.endpoint,
  });
  if (error) throw error;
  return data === true;
}

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function keyToBase64Url(key: ArrayBuffer | null): string {
  if (!key) return "";
  const bytes = new Uint8Array(key);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function enableBrowserPush(client: SupabaseClient): Promise<"enabled" | "denied" | "unsupported"> {
  if (!browserPushSupported()) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const { data: config, error: configError } = await client.rpc("get_notification_push_public_config_v2");
  if (configError) throw configError;
  const row = asRecord(config);
  if (row.enabled !== true || typeof row.vapid_public_key !== "string" || !row.vapid_public_key) {
    throw new Error("端末通知の配信設定が利用できません。");
  }

  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(row.vapid_public_key) as BufferSource,
    });
  }

  const { error } = await client.rpc("register_my_push_subscription_v2", {
    p_endpoint: subscription.endpoint,
    p_p256dh: keyToBase64Url(subscription.getKey("p256dh")),
    p_auth_key: keyToBase64Url(subscription.getKey("auth")),
    p_user_agent: navigator.userAgent.slice(0, 500),
  });
  if (error) throw error;
  return "enabled";
}

export async function disableBrowserPush(client: SupabaseClient): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (subscription) {
    const { error } = await client.rpc("unregister_my_push_subscription_v2", { p_endpoint: subscription.endpoint });
    if (error) throw error;
    await subscription.unsubscribe();
  }
}

export function isStandaloneWebApp(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export async function adminCreateNotification(
  client: SupabaseClient,
  input: { category: NotificationCategory; title: string; body: string; href: string; audience: NotificationAudience },
): Promise<number> {
  const { data, error } = await client.rpc("admin_create_app_notification", {
    p_category: input.category,
    p_title: input.title,
    p_body: input.body,
    p_href: normalizeNotificationPath(input.href),
    p_audience: input.audience,
  });
  if (error) throw error;
  return Number(data);
}

function normalizeAdminNotificationReadiness(value: unknown): AdminNotificationReadiness {
  const row = asRecord(value);
  const deliveries = asRecord(row.deliveries);
  const featureStage = row.feature_stage === "public" || row.feature_stage === "tester" ? row.feature_stage : "admin";
  const count = (candidate: unknown) => Math.max(0, Number(candidate ?? 0) || 0);
  return {
    featureStage,
    maintenanceMode: row.maintenance_mode === true,
    pushEnabled: row.push_enabled === true,
    pushConfigReady: row.push_config_ready === true,
    testerCount: count(row.tester_count),
    testerPushUsers: count(row.tester_push_users),
    enabledSubscriptions: count(row.enabled_subscriptions),
    deliveries: {
      pending: count(deliveries.pending),
      processing: count(deliveries.processing),
      sent: count(deliveries.sent),
      failed: count(deliveries.failed),
      latestSentAt: typeof deliveries.latest_sent_at === "string" ? deliveries.latest_sent_at : null,
      latestFailedAt: typeof deliveries.latest_failed_at === "string" ? deliveries.latest_failed_at : null,
    },
    automatedChecksPass: row.automated_checks_pass === true,
    manualChecksRequired: Array.isArray(row.manual_checks_required)
      ? row.manual_checks_required.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export function notificationReadinessIssues(
  readiness: AdminNotificationReadiness,
): AdminNotificationReadinessIssue[] {
  const issues: AdminNotificationReadinessIssue[] = [];

  if (readiness.maintenanceMode) {
    issues.push({
      code: "maintenance",
      title: "通知センターがメンテナンス中です",
      detail: "公開前にメンテナンスを解除し、通常稼働状態で実機確認してください。",
      actionHref: "/admin/features",
      actionLabel: "全機能管理を確認",
    });
  }

  if (!readiness.pushEnabled) {
    issues.push({
      code: "push_disabled",
      title: "Web Push配信が無効です",
      detail: "Push設定が無効のため、端末通知の公開確認を完了できません。",
    });
  } else if (!readiness.pushConfigReady) {
    issues.push({
      code: "push_config",
      title: "Web Push設定が未完了です",
      detail: "公開URL・worker token hash・VAPID公開鍵・subjectの設定状態を確認してください。",
    });
  }

  if (readiness.testerCount === 0) {
    issues.push({
      code: "no_testers",
      title: "一般ユーザーテスターが未登録です",
      detail: "activeな一般ユーザーを最低1名テスターへ設定して、一般ユーザー権限で確認してください。",
      actionHref: "/admin/releases",
      actionLabel: "テスター設定を開く",
    });
  } else if (readiness.testerPushUsers < readiness.testerCount) {
    const missing = readiness.testerCount - readiness.testerPushUsers;
    issues.push({
      code: "tester_push",
      title: "Push未確認のテスター端末があります",
      detail: `${missing}名分不足しています。対象テスター本人の端末でPWAへログインし、設定から端末通知をONにして実機確認してください。`,
      actionHref: "/admin/releases",
      actionLabel: "テスター設定を確認",
    });
  }

  const queued = readiness.deliveries.pending + readiness.deliveries.processing;
  if (queued > 0) {
    issues.push({
      code: "queue",
      title: "未処理のPush配信があります",
      detail: `${queued}件がpending / processingです。worker処理後に再確認してください。`,
    });
  }

  if (readiness.deliveries.failed > 0) {
    issues.push({
      code: "failed",
      title: "Push配信失敗が残っています",
      detail: `${readiness.deliveries.failed}件の失敗があります。失効端末や配信設定を確認してから公開判定してください。`,
    });
  }

  return issues;
}

export async function adminGetNotificationReadiness(client: SupabaseClient): Promise<AdminNotificationReadiness> {
  const { data, error } = await client.rpc("admin_get_notification_readiness");
  if (error) throw error;
  return normalizeAdminNotificationReadiness(data);
}

export async function adminListNotificationTesterReadiness(
  client: SupabaseClient,
): Promise<AdminNotificationTesterReadiness[]> {
  const { data, error } = await client.rpc("admin_list_notification_tester_readiness");
  if (error) throw error;
  if (!Array.isArray(data)) return [];

  const count = (value: unknown) => Math.max(0, Number(value ?? 0) || 0);
  return data.flatMap((item) => {
    const row = asRecord(item);
    if (typeof row.aas_user_id !== "string" || !row.aas_user_id.trim()) return [];
    return [{
      aasUserId: row.aas_user_id.trim(),
      displayName: typeof row.display_name === "string" ? row.display_name.trim() : "",
      pushEnabled: row.push_enabled === true,
      enabledDeviceCount: count(row.enabled_device_count),
      healthyDeviceCount: count(row.healthy_device_count),
      errorDeviceCount: count(row.error_device_count),
      latestDeviceUpdatedAt: typeof row.latest_device_updated_at === "string" ? row.latest_device_updated_at : null,
    }];
  });
}

export async function adminListNotifications(client: SupabaseClient, limit = 50): Promise<AdminNotification[]> {
  const { data, error } = await client.rpc("admin_list_app_notifications", { p_limit: limit });
  if (error) throw error;
  return Array.isArray(data) ? data.flatMap((item) => {
    const row = asRecord(item);
    const id = Number(row.id);
    if (!Number.isSafeInteger(id) || typeof row.title !== "string") return [];
    return [{
      id,
      category: normalizeCategory(row.category),
      title: row.title,
      body: typeof row.body === "string" ? row.body : "",
      href: normalizeNotificationPath(row.href),
      audience: normalizeAudience(row.audience),
      createdAt: typeof row.created_at === "string" ? row.created_at : "",
      createdByAasId: typeof row.created_by_aas_id === "string" ? row.created_by_aas_id : null,
    }];
  }) : [];
}
