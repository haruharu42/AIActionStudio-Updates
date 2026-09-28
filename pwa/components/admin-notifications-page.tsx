"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { SelectWithCustom } from "@/components/select-with-custom";
import { useSharedAccessState } from "@/components/access-state-provider";
import {
  adminCreateNotification,
  adminListNotifications,
  type AdminNotification,
  type NotificationAudience,
  type NotificationCategory,
} from "@/lib/notifications";
import { getSupabaseClient } from "@/lib/supabase";

const CATEGORY_OPTIONS: { value: NotificationCategory; label: string }[] = [
  { value: "update", label: "アップデート" },
  { value: "maintenance", label: "メンテナンス" },
  { value: "knowledge", label: "Knowledge更新" },
  { value: "admin", label: "管理者からのお知らせ" },
  { value: "system", label: "システム" },
];

const AUDIENCE_OPTIONS: { value: NotificationAudience; label: string }[] = [
  { value: "all", label: "全ユーザー" },
  { value: "tester", label: "管理者＋指定一般ユーザーテスター" },
  { value: "admin", label: "管理者のみ" },
];

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("ja-JP");
}

export function AdminNotificationsPage() {
  const { state } = useSharedAccessState();
  const [category, setCategory] = useState<NotificationCategory>("admin");
  const [audience, setAudience] = useState<NotificationAudience>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [href, setHref] = useState("/");
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeAdmin = state.kind === "ready" && state.profile.role === "admin" && state.profile.status === "active";

  const refresh = async () => {
    setItems(await adminListNotifications(getSupabaseClient(), 80));
  };

  useEffect(() => {
    if (!activeAdmin) return;
    let active = true;
    void adminListNotifications(getSupabaseClient(), 80).then(
      (next) => { if (active) setItems(next); },
      () => { if (active) setError("通知履歴を取得できませんでした。"); },
    );
    return () => { active = false; };
  }, [activeAdmin]);

  const send = async () => {
    if (busy || !title.trim()) return;
    if (!window.confirm("この内容を通知として送信しますか？\n対象: " + AUDIENCE_OPTIONS.find((item) => item.value === audience)?.label)) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await adminCreateNotification(getSupabaseClient(), {
        category,
        audience,
        title: title.trim(),
        body: body.trim(),
        href,
      });
      setTitle("");
      setBody("");
      setMessage("通知を送信しました。端末通知をONにしている対象ユーザーへはWeb Pushも配信されます。");
      await refresh();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "通知を送信できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  if (state.kind === "loading") return null;
  if (!activeAdmin) {
    return <main className="standalone-page"><section className="standalone-card"><h1>通知管理</h1><p className="route-notice error">active管理者のみ利用できます。</p></section></main>;
  }

  return (
    <main className="admin-page admin-notifications-page">
      <header className="admin-head admin-dashboard-head">
        <div>
          <p className="eyebrow">NOTIFICATION CONTROL</p>
          <h1>通知管理</h1>
          <p>全ユーザー、指定テスター、管理者向けのお知らせを送信します。アップデート・メンテナンス・Knowledge更新は自動通知にも対応しています。</p>
        </div>
        <div className="admin-head-actions">
          <Link href="/admin/features">全機能管理</Link>
          <Link className="route-back" href="/admin">← 管理ダッシュボード</Link>
        </div>
      </header>

      {message && <p className="route-notice">{message}</p>}
      {error && <p className="route-notice error">{error}</p>}

      <section className="admin-panel admin-dashboard-section">
        <div className="admin-panel-heading"><div><p className="eyebrow">SEND</p><h2>お知らせを送信</h2></div></div>
        <div className="admin-notification-form">
          <label className="route-field"><span>通知種類</span><select value={category} onChange={(event) => setCategory(event.target.value as NotificationCategory)}>{CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="route-field"><span>送信対象</span><select value={audience} onChange={(event) => setAudience(event.target.value as NotificationAudience)}>{AUDIENCE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="route-field full"><span>タイトル</span><input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} placeholder="例：記事作成機能をアップデートしました" /></label>
          <label className="route-field full"><span>本文</span><textarea value={body} maxLength={2000} onChange={(event) => setBody(event.target.value)} placeholder="ユーザーへ伝える内容を入力" /></label>
          <SelectWithCustom
            className="route-field full"
            label="通知を開いた時の移動先"
            value={href}
            onChange={setHref}
            options={[
              { value: "/", label: "ホーム" },
              { value: "/notifications", label: "通知一覧" },
              { value: "/create", label: "記事作成" },
              { value: "/tools", label: "機能一覧" },
              { value: "/prompts", label: "プロンプト" },
              { value: "/settings", label: "設定" },
            ]}
            customPlaceholder="/から始まるAAS内のパスを入力"
          />
        </div>
        <button className="primary-action" type="button" disabled={busy || !title.trim() || !href.startsWith("/")} onClick={() => void send()}>{busy ? "送信中…" : "通知を送信"}</button>
      </section>

      <section className="admin-panel admin-dashboard-section">
        <div className="admin-panel-heading"><div><p className="eyebrow">HISTORY</p><h2>最近の通知</h2></div><button className="secondary-action" disabled={busy} type="button" onClick={() => void refresh()}>更新</button></div>
        <div className="admin-notification-history">
          {items.map((item) => (
            <article key={item.id}>
              <header><strong>{item.title}</strong><span>{CATEGORY_OPTIONS.find((option) => option.value === item.category)?.label ?? item.category}</span></header>
              {item.body && <p>{item.body}</p>}
              <small>{formatDate(item.createdAt)} / 対象: {AUDIENCE_OPTIONS.find((option) => option.value === item.audience)?.label ?? item.audience}{item.createdByAasId ? " / " + item.createdByAasId : " / 自動通知"}</small>
            </article>
          ))}
          {!items.length && <div className="admin-empty-state"><strong>通知履歴はまだありません。</strong></div>}
        </div>
      </section>
    </main>
  );
}
