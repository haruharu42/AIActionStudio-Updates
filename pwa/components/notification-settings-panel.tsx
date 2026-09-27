"use client";

import { useEffect, useState } from "react";

import {
  browserPushSupported,
  browserPushSubscriptionActive,
  disableBrowserPush,
  enableBrowserPush,
  getNotificationPreferences,
  isStandaloneWebApp,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notifications";
import { getSupabaseClient } from "@/lib/supabase";

const DEFAULT_PREFERENCES: NotificationPreferences = {
  inAppEnabled: true,
  pushEnabled: false,
  updatesEnabled: true,
  maintenanceEnabled: true,
  knowledgeEnabled: true,
  adminMessagesEnabled: true,
};

export function NotificationSettingsPanel() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pushSupported, setPushSupported] = useState(false);
  const [devicePushEnabled, setDevicePushEnabled] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setPushSupported(browserPushSupported());
      setStandalone(isStandaloneWebApp());
    });
    const client = getSupabaseClient();
    void Promise.all([
      getNotificationPreferences(client),
      browserPushSubscriptionActive(),
    ]).then(
      ([next, currentDeviceEnabled]) => {
        if (!active) return;
        setPreferences(next);
        setDevicePushEnabled(currentDeviceEnabled);
      },
      () => { if (active) setMessage("通知設定を取得できませんでした。"); },
    ).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const save = async (next: NotificationPreferences) => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const saved = await updateNotificationPreferences(getSupabaseClient(), next);
      setPreferences(saved);
      setMessage("通知設定を保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "通知設定を保存できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const patch = <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    void save(next);
  };

  const togglePush = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const client = getSupabaseClient();
      if (devicePushEnabled) {
        await disableBrowserPush(client);
        const next = await getNotificationPreferences(client);
        setPreferences(next);
        setDevicePushEnabled(false);
        setMessage("この端末への通知をOFFにしました。他の端末の通知設定は変更しません。");
      } else {
        const result = await enableBrowserPush(client);
        if (result === "unsupported") {
          setMessage("このブラウザではWeb Pushを利用できません。iPhone/iPadではAASをホーム画面へ追加してからお試しください。");
          return;
        }
        if (result === "denied") {
          setMessage("通知が許可されませんでした。端末またはブラウザの通知設定を確認してください。");
          return;
        }
        const next = await getNotificationPreferences(client);
        setPreferences(next);
        setDevicePushEnabled(true);
        setMessage("この端末への通知をONにしました。");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "端末通知を変更できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="persistent-settings-status">通知設定を読み込んでいます…</p>;

  return (
    <div className="notification-settings-panel">
      <section className="persistent-settings-section">
        <div>
          <strong>AAS内の通知</strong>
          <small>ホーム右上のベルと通知一覧へ、アップデート・メンテナンス・Knowledge更新などを表示します。</small>
        </div>
        <button
          className={`persistent-toggle ${preferences.inAppEnabled ? "on" : ""}`}
          type="button"
          role="switch"
          aria-checked={preferences.inAppEnabled}
          disabled={busy}
          onClick={() => patch("inAppEnabled", !preferences.inAppEnabled)}
        >
          <span aria-hidden="true" />
          <b>{preferences.inAppEnabled ? "ON" : "OFF"}</b>
        </button>
      </section>

      <section className="persistent-settings-section notification-push-setting">
        <div>
          <strong>スマホ・PCへの端末通知</strong>
          <small>
            Web Push対応端末へAASを閉じている間も通知します。
            {pushSupported ? (standalone ? " この端末はPWA表示です。" : " PCブラウザ等ではインストールなしでも対応する場合があります。") : " 現在の環境ではPushを利用できません。"}
          </small>
        </div>
        <button
          className={`persistent-toggle ${devicePushEnabled ? "on" : ""}`}
          type="button"
          role="switch"
          aria-checked={devicePushEnabled}
          disabled={busy}
          onClick={() => void togglePush()}
        >
          <span aria-hidden="true" />
          <b>{devicePushEnabled ? "ON" : "OFF"}</b>
        </button>
      </section>

      {!pushSupported && (
        <p className="notification-install-hint">
          iPhone / iPadではAASを「ホーム画面に追加」し、ホーム画面のAASからこの設定を開くと端末通知を許可できます。
        </p>
      )}

      <div className="notification-category-settings">
        <strong>受け取る通知</strong>
        <label><input type="checkbox" checked={preferences.updatesEnabled} disabled={busy} onChange={(event) => patch("updatesEnabled", event.target.checked)} /><span><b>アップデート情報</b><small>新機能・UI変更・全体公開など</small></span></label>
        <label><input type="checkbox" checked={preferences.maintenanceEnabled} disabled={busy} onChange={(event) => patch("maintenanceEnabled", event.target.checked)} /><span><b>メンテナンス</b><small>機能停止・復旧・利用再開</small></span></label>
        <label><input type="checkbox" checked={preferences.knowledgeEnabled} disabled={busy} onChange={(event) => patch("knowledgeEnabled", event.target.checked)} /><span><b>Knowledge更新</b><small>AASのKnowledge / Prompt更新が反映されたとき</small></span></label>
        <label><input type="checkbox" checked={preferences.adminMessagesEnabled} disabled={busy} onChange={(event) => patch("adminMessagesEnabled", event.target.checked)} /><span><b>管理者からのお知らせ</b><small>運営からの重要なお知らせ</small></span></label>
      </div>

      {message && <p className="personalization-message" role="status">{message}</p>}
      <p className="notification-privacy-note">通知の許可は端末ごとです。通知本文に記事本文・パスワード・APIキーなどの秘密情報は送信しません。</p>
    </div>
  );
}
