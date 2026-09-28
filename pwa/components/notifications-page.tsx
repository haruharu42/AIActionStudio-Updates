"use client";

import { useEffect, useState } from "react";

import { AasReferenceBottomNav, AasReferenceHeader } from "@/components/aas-reference-shell";
import { useSharedAccessState } from "@/components/access-state-provider";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationInbox,
} from "@/lib/notifications";

function categoryLabel(category: AppNotification["category"]): string {
  if (category === "update") return "アップデート";
  if (category === "maintenance") return "メンテナンス";
  if (category === "knowledge") return "Knowledge";
  if (category === "admin") return "管理者から";
  return "システム";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function NotificationsPage() {
  const { state, client } = useSharedAccessState();
  const [inbox, setInbox] = useState<NotificationInbox>({ unreadCount: 0, notifications: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    if (state.kind !== "ready" || !client) return;
    const next = await getMyNotifications(client, 100, false);
    setInbox(next);
  };

  useEffect(() => {
    if (state.kind !== "ready" || !client) return;
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setLoading(true);
        setError("");
      }
    });
    void getMyNotifications(client, 100, false).then(
      (next) => { if (active) setInbox(next); },
      () => { if (active) setError("通知を取得できませんでした。"); },
    ).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, state]);

  const openNotification = async (notification: AppNotification) => {
    if (!client || busy) return;
    setBusy(true);
    try {
      if (!notification.read) await markNotificationRead(client, notification.id);
    } catch {
      // Navigation is still allowed if read-state persistence fails.
    } finally {
      window.location.href = notification.href;
    }
  };

  const markAll = async () => {
    if (!client || busy) return;
    setBusy(true);
    setError("");
    try {
      await markAllNotificationsRead(client);
      await refresh();
    } catch {
      setError("既読状態を更新できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reference-home notification-center-shell">
      <AasReferenceHeader />
      <main className="reference-home-main notification-center-page">
        <header className="notification-center-head">
          <div>
            <p className="eyebrow">NOTIFICATIONS</p>
            <h1>通知</h1>
            <p>アップデート、メンテナンス、Knowledge更新、管理者からのお知らせを確認できます。</p>
          </div>
          <div className="notification-center-actions">
            <span>{inbox.unreadCount > 0 ? `未読 ${inbox.unreadCount}件` : "未読なし"}</span>
            <button type="button" disabled={busy || inbox.unreadCount === 0} onClick={() => void markAll()}>すべて既読</button>
          </div>
        </header>

        {error && <p className="route-notice error">{error}</p>}
        {loading && <div className="admin-empty-state"><strong>通知を読み込んでいます…</strong></div>}

        {!loading && (
          <section className="notification-list" aria-label="通知一覧">
            {inbox.notifications.map((notification) => (
              <button
                className={`notification-card ${notification.read ? "read" : "unread"} category-${notification.category}`}
                type="button"
                key={notification.id}
                onClick={() => void openNotification(notification)}
              >
                <span className="notification-card-icon" aria-hidden="true">
                  {notification.category === "maintenance" ? "🛠" : notification.category === "knowledge" ? "✦" : notification.category === "update" ? "↻" : "🔔"}
                </span>
                <span className="notification-card-main">
                  <span className="notification-card-meta">
                    <b>{categoryLabel(notification.category)}</b>
                    <small>{formatDate(notification.createdAt)}</small>
                  </span>
                  <strong>{notification.title}</strong>
                  {notification.body && <p>{notification.body}</p>}
                </span>
                {!notification.read && <i className="notification-unread-dot" aria-label="未読" />}
              </button>
            ))}
            {!inbox.notifications.length && (
              <div className="admin-empty-state">
                <strong>現在表示する通知はありません。</strong>
                <span>通知設定は「設定 → 通知」から変更できます。</span>
              </div>
            )}
          </section>
        )}
      </main>
      <AasReferenceBottomNav active="" />
    </div>
  );
}
