"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { SelectWithCustom } from "@/components/select-with-custom";
import { useSharedAccessState } from "@/components/access-state-provider";
import {
  adminCreateNotification,
  adminGetNotificationReadiness,
  adminListNotifications,
  adminListNotificationTesterReadiness,
  adminPromoteNotificationFeaturePublic,
  notificationReadinessIssues,
  type AdminNotification,
  type AdminNotificationReadiness,
  type AdminNotificationTesterReadiness,
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
  const [readiness, setReadiness] = useState<AdminNotificationReadiness | null>(null);
  const [testerReadiness, setTesterReadiness] = useState<AdminNotificationTesterReadiness[]>([]);
  const [manualChecks, setManualChecks] = useState({
    testerDevicePushReceive: false,
    testerDeviceNotificationTap: false,
    pcMobileMajorFlow: false,
  });
  const [currentSessionAal, setCurrentSessionAal] = useState<"aal1" | "aal2" | null>(null);
  const [aalCheckFailed, setAalCheckFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeAdmin = state.kind === "ready" && state.profile.role === "admin" && state.profile.status === "active";
  const readinessIssues = readiness ? notificationReadinessIssues(readiness) : [];
  const manualCheckCount = Object.values(manualChecks).filter(Boolean).length;
  const manualChecksComplete = manualCheckCount === 3;

  const refresh = async () => {
    const client = getSupabaseClient();
    const [nextItems, nextReadiness, nextTesterReadiness] = await Promise.all([
      adminListNotifications(client, 80),
      adminGetNotificationReadiness(client),
      adminListNotificationTesterReadiness(client),
    ]);
    setItems(nextItems);
    setReadiness(nextReadiness);
    setTesterReadiness(nextTesterReadiness);
  };

  useEffect(() => {
    if (!activeAdmin) return;
    let active = true;
    const client = getSupabaseClient();
    void Promise.all([
      adminListNotifications(client, 80),
      adminGetNotificationReadiness(client),
      adminListNotificationTesterReadiness(client),
    ]).then(
      ([nextItems, nextReadiness, nextTesterReadiness]) => {
        if (!active) return;
        setItems(nextItems);
        setReadiness(nextReadiness);
        setTesterReadiness(nextTesterReadiness);
      },
      () => { if (active) setError("通知管理の状態を取得できませんでした。"); },
    );
    return () => { active = false; };
  }, [activeAdmin]);

  useEffect(() => {
    if (!activeAdmin) return;
    let active = true;
    const client = getSupabaseClient();
    void client.auth.mfa.getAuthenticatorAssuranceLevel().then(
      ({ data, error: aalError }) => {
        if (!active) return;
        if (aalError) {
          setCurrentSessionAal(null);
          setAalCheckFailed(true);
          return;
        }
        setCurrentSessionAal(data.currentLevel === "aal2" ? "aal2" : "aal1");
        setAalCheckFailed(false);
      },
      () => {
        if (!active) return;
        setCurrentSessionAal(null);
        setAalCheckFailed(true);
      },
    );
    return () => { active = false; };
  }, [activeAdmin]);

  const promotePublic = async () => {
    if (
      busy
      || readiness?.featureStage !== "tester"
      || !readiness.automatedChecksPass
      || !manualChecksComplete
    ) return;

    setBusy(true);
    setMessage("");
    setError("");
    try {
      const client = getSupabaseClient();
      const { data, error: aalError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError || data.currentLevel !== "aal2") {
        setCurrentSessionAal(data?.currentLevel === "aal2" ? "aal2" : "aal1");
        setAalCheckFailed(Boolean(aalError));
        throw new Error("通知センターの全体公開には、現在の管理者セッションでMFA認証（AAL2）が必要です。");
      }
      setCurrentSessionAal("aal2");
      setAalCheckFailed(false);

      if (!window.confirm("通知センターを全一般ユーザーへ公開しますか？\n3つの実機・導線確認とMFA認証を再確認してください。")) return;

      await adminPromoteNotificationFeaturePublic(client, manualChecks);
      setManualChecks({
        testerDevicePushReceive: false,
        testerDeviceNotificationTap: false,
        pcMobileMajorFlow: false,
      });
      setMessage("通知センターを全一般ユーザーへ公開しました。");
      await refresh();
    } catch (promotionError) {
      setError(promotionError instanceof Error ? promotionError.message : "通知センターを全体公開できませんでした。");
    } finally {
      setBusy(false);
    }
  };

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

      <section className="admin-panel admin-dashboard-section admin-notification-readiness">
        <div className="admin-panel-heading">
          <div><p className="eyebrow">ROLLOUT READINESS</p><h2>通知センター公開準備状況</h2></div>
          <button className="secondary-action" disabled={busy} type="button" onClick={() => void refresh().catch(() => setError("通知管理の状態を更新できませんでした。"))}>再確認</button>
        </div>
        {readiness ? (
          <>
            <div className={"admin-notification-readiness-summary " + (readiness.automatedChecksPass ? "ready" : "needs-check")}>
              <div>
                <span>自動確認</span>
                <strong>{readiness.automatedChecksPass ? "通過" : "確認事項あり"}</strong>
              </div>
              <p>
                自動確認は設定・テスター登録・配信キューだけを判定します。
                実機でのPush受信・通知タップ・PC/スマホ主要導線は公開前に別途確認してください。
              </p>
            </div>
            {readinessIssues.length > 0 ? (
              <div className="admin-notification-readiness-blockers" aria-label="公開前の自動確認ブロッカー">
                <div className="admin-notification-readiness-blockers-head">
                  <strong>公開前に解消する項目</strong>
                  <span>{readinessIssues.length}件</span>
                </div>
                <div className="admin-notification-readiness-blocker-list">
                  {readinessIssues.map((issue) => (
                    <article key={issue.code}>
                      <div>
                        <span>要対応</span>
                        <strong>{issue.title}</strong>
                        <p>{issue.detail}</p>
                      </div>
                      {issue.actionHref && issue.actionLabel ? (
                        <Link href={issue.actionHref}>{issue.actionLabel} →</Link>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="admin-notification-readiness-clear">
                <strong>自動確認のブロッカーはありません。</strong>
                <span>残りは実機Push受信・通知タップ・PC/スマホ主要導線の手動確認です。</span>
              </div>
            )}
            <div className="admin-notification-readiness-grid">
              <article>
                <span>公開段階</span>
                <strong>{readiness.featureStage === "public" ? "全体公開" : readiness.featureStage === "tester" ? "テスター" : "管理者のみ"}</strong>
                <small>{readiness.maintenanceMode ? "メンテナンス中" : "通常稼働"}</small>
              </article>
              <article>
                <span>Push配信設定</span>
                <strong>{readiness.pushConfigReady && readiness.pushEnabled ? "設定済み" : "要確認"}</strong>
                <small>秘密値は表示しません</small>
              </article>
              <article>
                <span>指定テスター端末</span>
                <strong>{readiness.testerPushUsers} / {readiness.testerCount}</strong>
                <small>Push有効ユーザー / active一般テスター</small>
              </article>
              <article>
                <span>有効Push購読</span>
                <strong>{readiness.enabledSubscriptions}</strong>
                <small>全対象端末の有効購読数</small>
              </article>
              <article>
                <span>未処理キュー</span>
                <strong>{readiness.deliveries.pending + readiness.deliveries.processing}</strong>
                <small>pending {readiness.deliveries.pending} / processing {readiness.deliveries.processing}</small>
              </article>
              <article>
                <span>配信失敗</span>
                <strong>{readiness.deliveries.failed}</strong>
                <small>送信成功 {readiness.deliveries.sent} 件</small>
              </article>
            </div>
            <div className="admin-notification-tester-readiness" aria-label="指定テスターのPush準備状況">
              <div className="admin-notification-tester-readiness-head">
                <div>
                  <strong>指定テスターの実機Push状況</strong>
                  <span>endpoint・P-256鍵・auth鍵は表示せず、端末数と状態だけを確認します。</span>
                </div>
                <Link href="/admin/releases">テスター設定を開く →</Link>
              </div>
              <div className="admin-notification-tester-readiness-list">
                {testerReadiness.map((tester) => {
                  const ready = tester.pushEnabled && tester.healthyDeviceCount > 0;
                  const stateLabel = ready
                    ? "Push確認可"
                    : !tester.pushEnabled
                      ? "端末通知OFF"
                      : tester.enabledDeviceCount === 0
                        ? "端末登録待ち"
                        : tester.errorDeviceCount > 0
                          ? "配信エラー確認"
                          : "要確認";
                  return (
                    <article className={ready ? "ready" : "action"} key={tester.aasUserId}>
                      <div className="admin-notification-tester-identity">
                        <strong>{tester.aasUserId}</strong>
                        <span>{tester.displayName || "表示名なし"}</span>
                      </div>
                      <div className="admin-notification-tester-metrics">
                        <span>Push設定 <b>{tester.pushEnabled ? "ON" : "OFF"}</b></span>
                        <span>正常端末 <b>{tester.healthyDeviceCount}</b></span>
                        <span>有効端末 <b>{tester.enabledDeviceCount}</b></span>
                        <span>エラー端末 <b>{tester.errorDeviceCount}</b></span>
                      </div>
                      <div className="admin-notification-tester-state">
                        <strong>{stateLabel}</strong>
                        <small>
                          {tester.latestDeviceUpdatedAt
                            ? `最終端末更新: ${formatDate(tester.latestDeviceUpdatedAt)}`
                            : "端末登録履歴なし"}
                        </small>
                      </div>
                    </article>
                  );
                })}
                {!testerReadiness.length && (
                  <div className="admin-empty-state compact">
                    <strong>activeな一般ユーザーテスターが見つかりません。</strong>
                  </div>
                )}
              </div>
              {testerReadiness.some((tester) => !tester.pushEnabled || tester.healthyDeviceCount === 0) && (
                <p>
                  未確認テスター本人のPWAで「設定 → 通知 → スマホ・PCへの端末通知」をONにし、
                  この画面で正常端末が1台以上になったことを再確認してください。
                </p>
              )}
            </div>
            {readiness.featureStage === "tester" ? (
              <div className="admin-notification-public-approval" aria-label="通知センター全体公開の最終承認">
                <div className="admin-notification-public-approval-head">
                  <div>
                    <span>FINAL PUBLIC APPROVAL</span>
                    <strong>通知センター全体公開の最終確認</strong>
                    <small>自動確認に加え、実機でしか確認できない3項目と現在の管理者MFA（AAL2）を必須にします。</small>
                  </div>
                  <b>{manualCheckCount} / 3</b>
                </div>
                <div className="admin-notification-manual-checks">
                  <label>
                    <input
                      type="checkbox"
                      checked={manualChecks.testerDevicePushReceive}
                      onChange={(event) => setManualChecks((current) => ({ ...current, testerDevicePushReceive: event.target.checked }))}
                    />
                    <span><strong>テスター実機でPush受信を確認</strong><small>テスター限定通知が対象端末へ実際に表示されることを確認します。</small></span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={manualChecks.testerDeviceNotificationTap}
                      onChange={(event) => setManualChecks((current) => ({ ...current, testerDeviceNotificationTap: event.target.checked }))}
                    />
                    <span><strong>通知タップ後の遷移を確認</strong><small>Push通知をタップし、指定したAAS内ページへ安全に遷移することを確認します。</small></span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={manualChecks.pcMobileMajorFlow}
                      onChange={(event) => setManualChecks((current) => ({ ...current, pcMobileMajorFlow: event.target.checked }))}
                    />
                    <span><strong>PC・スマホ主要導線を確認</strong><small>通知一覧・既読・設定ON/OFF・主要画面への移動をPC/スマホで確認します。</small></span>
                  </label>
                </div>
                <div className="admin-notification-public-approval-footer">
                  <div className={currentSessionAal === "aal2" ? "ready" : "action"}>
                    <strong>{currentSessionAal === "aal2" ? "MFA AAL2 認証済み" : aalCheckFailed ? "MFA状態を確認できません" : "MFA AAL2 未認証"}</strong>
                    {currentSessionAal !== "aal2" && <Link href="/admin/security">管理者MFAで再認証 →</Link>}
                  </div>
                  <button
                    className="primary-action"
                    type="button"
                    disabled={busy || !readiness.automatedChecksPass || !manualChecksComplete || currentSessionAal !== "aal2"}
                    onClick={() => void promotePublic()}
                  >
                    {busy ? "確認中…" : "3項目確認済みとして全体公開"}
                  </button>
                </div>
                {!readiness.automatedChecksPass && (
                  <p>自動確認が未完了のため公開できません。上のブロッカーとテスター端末状態を先に解消してください。</p>
                )}
              </div>
            ) : readiness.featureStage === "public" ? (
              <div className="admin-notification-public-state ready">
                <strong>通知センターは全体公開済みです。</strong>
                <span>停止・テスター段階へのロールバックは<Link href="/admin/features">全機能管理</Link>から実行できます。</span>
              </div>
            ) : (
              <div className="admin-notification-public-state">
                <strong>全体公開の前にテスター段階へ進めてください。</strong>
                <span><Link href="/admin/features">全機能管理</Link>でテスター段階へ切り替えてから、実機確認を行います。</span>
              </div>
            )}
            <p className="admin-notification-readiness-note">
              最終送信: {readiness.deliveries.latestSentAt ? formatDate(readiness.deliveries.latestSentAt) : "まだありません"}。
              公開範囲の縮小・メンテナンス管理は<Link href="/admin/features">全機能管理</Link>、tester → public は上の最終承認から行います。
            </p>
          </>
        ) : (
          <div className="admin-empty-state compact"><strong>公開準備状況を確認しています。</strong></div>
        )}
      </section>

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
