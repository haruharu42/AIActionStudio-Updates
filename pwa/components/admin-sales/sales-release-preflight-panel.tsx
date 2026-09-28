"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  SALES_LAUNCH_STATE_EVENT,
  loadPublicSalesApproval,
  loadSalesLaunchReadiness,
  setPublicSalesApproval,
  type PublicSalesApproval,
  type SalesLaunchReadinessSnapshot,
} from "@/lib/sales-launch-readiness";
import type { SalesSettings } from "@/lib/sales-settings";
import { getSupabaseClient } from "@/lib/supabase";

const REVIEW_LINKS = [
  { href: "/commercial-transactions", label: "特定商取引法に基づく表記", note: "販売者情報・価格・支払・返金等の表示を人が最終確認" },
  { href: "/terms", label: "利用規約", note: "現在の販売方法・利用権・停止条件と整合しているか確認" },
  { href: "/privacy", label: "プライバシーポリシー", note: "現在取得するデータ・外部サービス・問い合わせ運用を確認" },
  { href: "/ai-terms", label: "AI利用条件", note: "外部AI利用・生成物・禁止事項等の案内を確認" },
  { href: "/support", label: "サポート・開示請求", note: "購入者が問い合わせできる導線と対応方法を確認" },
] as const;

function externalPurchaseUrl(value: string): string {
  const normalized = value.trim();
  if (!normalized.startsWith("https://")) return "";
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export function SalesReleasePreflightPanel({
  settings,
  hasUnsavedChanges = false,
}: {
  settings: SalesSettings;
  hasUnsavedChanges?: boolean;
}) {
  const purchaseUrl = externalPurchaseUrl(settings.externalSalesUrl);
  const [snapshot, setSnapshot] = useState<SalesLaunchReadinessSnapshot | null>(null);
  const [snapshotFailed, setSnapshotFailed] = useState(false);
  const [approval, setApproval] = useState<PublicSalesApproval | null>(null);
  const [approvalFailed, setApprovalFailed] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [manualReviewConfirmed, setManualReviewConfirmed] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState("");

  useEffect(() => {
    let active = true;

    const refresh = () => {
      try {
        const client = getSupabaseClient();
        void Promise.all([
          loadSalesLaunchReadiness(client),
          loadPublicSalesApproval(client),
        ]).then(
          ([readiness, publicApproval]) => {
            if (!active) return;
            setSnapshot(readiness);
            setApproval(publicApproval);
            setSnapshotFailed(false);
            setApprovalFailed(false);
          },
          () => {
            if (!active) return;
            setSnapshot(null);
            setApproval(null);
            setSnapshotFailed(true);
            setApprovalFailed(true);
          },
        );
      } catch {
        queueMicrotask(() => {
          if (!active) return;
          setSnapshot(null);
          setApproval(null);
          setSnapshotFailed(true);
          setApprovalFailed(true);
        });
      }
    };

    refresh();
    window.addEventListener(SALES_LAUNCH_STATE_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(SALES_LAUNCH_STATE_EVENT, refresh);
    };
  }, []);

  const verifiedMfaCount = snapshot?.verifiedMfaCount ?? null;
  const usableInviteCount = snapshot?.usableInviteCount ?? null;
  const legalReady = snapshot?.sellerReady ?? null;
  const mfaReady = verifiedMfaCount !== null && verifiedMfaCount > 0;
  const mfaStatus = snapshotFailed
    ? "確認失敗"
    : verifiedMfaCount === null
      ? "確認中"
      : mfaReady
        ? `${verifiedMfaCount}個確認済み`
        : "未登録";

  const automatedBlockers = [
    !settings.externalSalesEnabled ? "外部販売受付がOFFです。" : "",
    !settings.accessCodeEnabled ? "利用コード受付がOFFです。" : "",
    !purchaseUrl ? "購入ページURLが未設定、または安全なHTTPS URLではありません。" : "",
    snapshotFailed ? "販売前のセキュリティ状態を確認できません。" : "",
    !snapshotFailed && snapshot === null ? "販売前のセキュリティ状態を確認中です。" : "",
    snapshot && !mfaReady ? "active管理者に確認済みMFAがありません。" : "",
    snapshot && !snapshot.sellerReady
      ? "販売者情報（氏名・所在地・電話・メール・サポートURL）が未完了です。"
      : "",
    snapshot && snapshot.usableInviteCount < 1
      ? "購入者へ渡せる有効な利用コードがありません。"
      : "",
  ].filter(Boolean);
  const automatedReady = automatedBlockers.length === 0;
  const persistedAutomatedReady = snapshot?.persistedAutomatedReady === true;
  const canApprove =
    automatedReady &&
    persistedAutomatedReady &&
    !hasUnsavedChanges &&
    manualReviewConfirmed &&
    !approvalBusy &&
    !approvalFailed;

  const changePublicSalesApproval = async (nextApproved: boolean) => {
    if (approvalBusy) return;
    setApprovalBusy(true);
    setApprovalMessage("");
    try {
      const next = await setPublicSalesApproval(getSupabaseClient(), nextApproved);
      setApproval(next);
      setManualReviewConfirmed(false);
      setApprovalMessage(
        nextApproved
          ? "公開販売を承認しました。Worker側の販売ロックが解除されます。"
          : "公開販売を停止しました。保存済み設定は残したまま、新規購入導線だけをロックしています。",
      );
    } catch (error) {
      setApprovalMessage(error instanceof Error ? error.message : "公開販売の状態を変更できませんでした。");
    } finally {
      setApprovalBusy(false);
    }
  };

  return (
    <section className="admin-panel sales-release-preflight" aria-labelledby="sales-release-preflight-title">
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">PRE-SALE REVIEW</p>
          <h2 id="sales-release-preflight-title">販売前チェック</h2>
          <p>販売開始前に見る場所を1つへまとめています。ここにリンクがあるだけでは「販売可能」の自動判定にはしません。</p>
        </div>
      </div>

      {hasUnsavedChanges && (
        <p className="sales-release-preflight-draft">
          現在は未保存の販売設定を含んでいます。保存前の内容を本番状態として扱わないでください。
        </p>
      )}

      <div className={`sales-release-gate ${automatedReady ? "review" : "blocked"}`} role="status">
        <div>
          <strong>{automatedReady ? "自動確認は通過" : "販売開始保留"}</strong>
          <span>
            {automatedReady
              ? "設定・管理者MFAの自動確認は通過しています。漏洩パスワード保護、法務、価格、返金条件、サポート方針は人が最終確認してください。"
              : `自動確認で${automatedBlockers.length}件の未完了項目があります。解消するまで販売開始扱いにしないでください。`}
          </span>
        </div>
        {!automatedReady && (
          <ul>
            {automatedBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ul>
        )}
      </div>

      <section className={`sales-public-approval ${approval?.approved ? "approved" : "locked"}`} aria-labelledby="sales-public-approval-title">
        <div>
          <p className="eyebrow">PUBLIC SALES LOCK</p>
          <h3 id="sales-public-approval-title">公開販売の最終承認</h3>
          <strong>
            {approvalFailed
              ? "承認状態を確認できません"
              : approval?.approved
                ? "公開販売：承認済み"
                : "公開販売：ロック中"}
          </strong>
          <p>
            設定を保存しただけでは販売開始しません。公開販売を承認した場合だけ、Workerが購入導線と新規決済を有効化できます。
            販売設定または販売者情報を変更すると承認は自動解除されます。
          </p>
        </div>

        {approvalMessage && <p className="route-notice" role="status">{approvalMessage}</p>}

        {approval?.approved ? (
          <button
            type="button"
            className="secondary-action"
            disabled={approvalBusy}
            onClick={() => void changePublicSalesApproval(false)}
          >
            {approvalBusy ? "停止中…" : "公開販売を停止する"}
          </button>
        ) : (
          <>
            <label className="sales-manual-approval-check">
              <input
                type="checkbox"
                checked={manualReviewConfirmed}
                onChange={(event) => setManualReviewConfirmed(event.target.checked)}
              />
              <span>
                <strong>手動確認項目を確認済み</strong>
                <small>漏洩パスワード保護、特商法・利用規約・プライバシー・AI利用条件、実際の価格・返金条件、購入前サポート導線を確認しました。</small>
              </span>
            </label>
            <button
              type="button"
              className="primary-action"
              disabled={!canApprove}
              onClick={() => void changePublicSalesApproval(true)}
            >
              {approvalBusy ? "承認中…" : "公開販売を承認する"}
            </button>
            {!persistedAutomatedReady && (
              <p className="sales-approval-hint">保存済み設定の自動確認が未完了です。上の未完了項目を解消してから承認できます。</p>
            )}
            {hasUnsavedChanges && (
              <p className="sales-approval-hint">未保存の販売設定があります。先に変更を保存してください。</p>
            )}
          </>
        )}
      </section>

      <div className="sales-release-preflight-grid">
        <article>
          <div><strong>外部販売受付</strong><span className={settings.externalSalesEnabled ? "ready" : "action"}>{settings.externalSalesEnabled ? "ON" : "OFF"}</span></div>
          <small>最短販売ルートを使う場合はONを確認します。</small>
        </article>
        <article>
          <div><strong>利用コード受付</strong><span className={settings.accessCodeEnabled ? "ready" : "action"}>{settings.accessCodeEnabled ? "ON" : "OFF"}</span></div>
          <small>購入後に利用コードを登録できる状態か確認します。</small>
          <Link href="/admin/users">利用コードの発行・使用履歴を確認 →</Link>
        </article>
        <article>
          <div><strong>購入ページ</strong><span className={purchaseUrl ? "ready" : "action"}>{purchaseUrl ? "設定あり" : "未設定"}</span></div>
          <small>実際に公開する外部購入ページのURLを確認します。</small>
          {purchaseUrl && <a href={purchaseUrl} target="_blank" rel="noopener noreferrer">購入ページを開く ↗</a>}
        </article>
        <article>
          <div>
            <strong>販売用の利用コード</strong>
            <span className={usableInviteCount !== null && usableInviteCount > 0 ? "ready" : snapshotFailed ? "review" : "action"}>
              {snapshotFailed ? "確認失敗" : usableInviteCount === null ? "確認中" : usableInviteCount > 0 ? `${usableInviteCount}件利用可` : "0件"}
            </span>
          </div>
          <small>外部販売で購入者へ渡せる、未期限切れ・未上限到達のactive利用コードが1件以上必要です。コード本体はこのチェックでは取得しません。</small>
          <Link href="/admin/users">利用コードを発行・確認 →</Link>
        </article>
        <article>
          <div>
            <strong>販売者情報</strong>
            <span className={legalReady ? "ready" : snapshotFailed ? "review" : "action"}>
              {snapshotFailed ? "確認失敗" : legalReady === null ? "確認中" : legalReady ? "設定済み" : "未完了"}
            </span>
          </div>
          <small>特商法・開示請求に必要な販売者情報を非公開設定で保持し、公開方式に応じて表示します。</small>
          <Link href="/commercial-transactions">特商法表示を確認 →</Link>
        </article>
        <article>
          <div>
            <strong>管理者MFA</strong>
            <span className={mfaReady ? "ready" : snapshotFailed ? "review" : "action"}>{mfaStatus}</span>
          </div>
          <small>販売開始前に、現在の管理者アカウントへ確認済みTOTPを最低1個登録します。AAL2強制はMFA登録後に別工程で有効化します。</small>
          <Link href="/admin/security">管理者MFAを確認 →</Link>
        </article>
        <article>
          <div><strong>漏洩パスワード保護</strong><span className="review">要Dashboard確認</span></div>
          <small>Supabase Authの漏洩パスワード保護はDashboard設定のためAASから自動変更しません。販売公開前に有効化状態を確認します。</small>
        </article>

        {REVIEW_LINKS.map((item) => (
          <article key={item.href}>
            <div><strong>{item.label}</strong><span className="review">要人確認</span></div>
            <small>{item.note}</small>
            <Link href={item.href}>内容を確認 →</Link>
          </article>
        ))}
      </div>

      <p className="sales-release-preflight-footnote">
        価格・返金条件・販売者情報・サポート方針・公開段階は自動確定しません。実際の販売内容と一致していることを公開直前に人が確認してください。
      </p>
    </section>
  );
}
