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

export async function browserPushSubscriptionActive(): Promise<boolean> {
  if (!browserPushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;
  return Boolean(await registration.pushManager.getSubscription());
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
