"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { useAppFeatureAccess } from "@/components/feature-access-gate";
import { getMyNotifications, NOTIFICATION_REFRESH_EVENT } from "@/lib/notifications";

type NavigatorWithBadge = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function NotificationHeaderButton() {
  const { state, client } = useSharedAccessState();
  const notificationAccess = useAppFeatureAccess("notifications");
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (state.kind !== "ready" || !client) {
      setUnreadCount(0);
      return;
    }
    try {
      const inbox = await getMyNotifications(client, 1, false);
      setUnreadCount(inbox.unreadCount);
      const nav = navigator as NavigatorWithBadge;
      if (inbox.unreadCount > 0) {
        await nav.setAppBadge?.(Math.min(inbox.unreadCount, 99));
      } else {
        await nav.clearAppBadge?.();
      }
    } catch {
      setUnreadCount(0);
    }
  }, [client, state]);

  useEffect(() => {
    let active = true;
    const safeRefresh = () => { if (active) void refresh(); };
    queueMicrotask(safeRefresh);
    const timer = window.setInterval(safeRefresh, 60_000);
    window.addEventListener(NOTIFICATION_REFRESH_EVENT, safeRefresh);
    window.addEventListener("focus", safeRefresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(NOTIFICATION_REFRESH_EVENT, safeRefresh);
      window.removeEventListener("focus", safeRefresh);
    };
  }, [refresh]);

  if (state.kind !== "ready" || notificationAccess.loading || !notificationAccess.allowed) return null;

  const label = unreadCount > 0 ? `通知 ${unreadCount}件` : "通知";

  return (
    <Link className="aas-notification-header-button" href="/notifications" aria-label={label}>
      <span aria-hidden="true">🔔</span>
      {unreadCount > 0 && <i aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</i>}
    </Link>
  );
}
