"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import {
  COMMERCE_PLAN_COPY,
  loadMyBillingState,
  openBillingPortal,
  type BillingSubscription,
  type MyBillingState,
} from "@/lib/commerce";

const STATUS_LABELS: Record<string, string> = {
  incomplete: "決済未完了",
  incomplete_expired: "決済期限切れ",
  trialing: "トライアル中",
  active: "有効",
  past_due: "支払い確認中",
  canceled: "終了",
  unpaid: "未払い",
  paused: "一時停止",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function subscriptionName(subscription: BillingSubscription): string {
  return subscription.planCode in COMMERCE_PLAN_COPY
    ? COMMERCE_PLAN_COPY[subscription.planCode as keyof typeof COMMERCE_PLAN_COPY].name
    : subscription.planCode;
}

export function BillingAccountPage() {
  const { state, client, refresh: refreshAccess } = useSharedAccessState();
  const [billing, setBilling] = useState<MyBillingState | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const portalInFlight = useRef(false);

  const profile = useMemo(() => {
    if (
      state.kind === "ready" ||
      state.kind === "entitlement_denied" ||
      state.kind === "pending" ||
      state.kind === "suspended" ||
      state.kind === "disabled"
    ) return state.profile;
    return null;
  }, [state]);

  const refreshBilling = async () => {
    if (!client) return;
    setMessage("");
    try {
      await refreshAccess();
      const next = await loadMyBillingState(client);
      setBilling(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "契約情報を取得できませんでした。");
    }
  };

  useEffect(() => {
    if (!profile || !client) {
      if (state.kind === "signed_out") queueMicrotask(() => setBilling(null));
      return;
    }
    let active = true;
    void loadMyBillingState(client).then(
      (next) => {
        if (active) setBilling(next);
      },
      (error) => {
        if (active) setMessage(error instanceof Error ? error.message : "契約情報を取得できませんでした。");
      },
    );
    return () => { active = false; };
  }, [client, profile, state.kind]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      queueMicrotask(() => {
        setMessage("決済手続きを受け付けました。Stripeの決済確認とWebhook処理後に利用権へ反映されます。反映が見えない場合は「最新状態に更新」を押してください。");
      });
    }
  }, []);

  const openPortal = async () => {
    if (portalInFlight.current) return;
    portalInFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      const url = await openBillingPortal();
      window.location.assign(url);
    } catch (error) {
      portalInFlight.current = false;
      setMessage(error instanceof Error ? error.message : "契約管理画面を開けませんでした。");
      setBusy(false);
    }
  };

  return (
    <main className="commerce-page billing-page">
      <section className="commerce-hero">
        <Link href="/" className="commerce-back">← AI Action Studioへ戻る</Link>
        <p className="eyebrow">BILLING</p>
        <h1>契約・利用権</h1>
        <p>現在のPWA利用権、月額契約、更新予定を確認できます。カード番号などの決済情報はAI Action Studioでは保持せず、Stripeの契約管理画面で扱います。</p>
      </section>

      {message && <p className="commerce-message" role="status">{message}</p>}

      {state.kind === "signed_out" && (
        <section className="commerce-empty">
          <h2>ログインが必要です</h2>
          <p>契約と利用権はログイン後に確認できます。</p>
          <Link href="/">ログイン画面へ戻る</Link>
        </section>
      )}

      {profile && (
        <>
          <section className="billing-access-grid">
            <article>
              <span>アカウント</span>
              <strong>{profile.display_name || "ユーザー"}</strong>
              <small>{profile.aas_user_id} / {profile.status}</small>
            </article>
            <article>
              <span>PWA利用権</span>
              <strong>{profile.role === "admin" || billing?.pwaAccess ? "利用可能" : "利用不可"}</strong>
              <small>{profile.role === "admin" ? "管理者権限" : "現在の有効な利用権"}</small>
            </article>
          </section>

          <section className="billing-subscriptions">
            <div className="billing-section-head">
              <div>
                <p className="eyebrow">SUBSCRIPTIONS</p>
                <h2>月額契約</h2>
              </div>
              <button type="button" onClick={() => void refreshBilling()}>最新状態に更新</button>
            </div>

            {billing?.subscriptions.length ? (
              <div className="billing-subscription-list">
                {billing.subscriptions.map((subscription) => (
                  <article key={subscription.id}>
                    <div>
                      <span className={`billing-status status-${subscription.status}`}>{STATUS_LABELS[subscription.status] ?? subscription.status}</span>
                      <h3>{subscriptionName(subscription)}</h3>
                    </div>
                    <dl>
                      <div><dt>現在期間の終了</dt><dd>{formatDate(subscription.currentPeriodEnd)}</dd></div>
                      <div><dt>自動更新</dt><dd>{subscription.cancelAtPeriodEnd ? "停止予定" : subscription.status === "active" || subscription.status === "trialing" || subscription.status === "past_due" ? "継続予定" : "—"}</dd></div>
                      <div><dt>環境</dt><dd>{subscription.livemode ? "本番契約" : "テスト契約"}</dd></div>
                    </dl>
                    {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
                      <p>解約予約済みです。原則として現在の請求期間終了までは利用権を維持し、その後更新を停止します。</p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="billing-no-subscription">記録されている月額契約はありません。7日利用パスは月額契約一覧には表示されません。</p>
            )}
          </section>

          <section className="billing-actions-card">
            <h2>契約の変更・解約・支払い方法</h2>
            <p>Stripe Customer Portalで、対応する契約の解約、支払い方法、請求情報を管理します。解約操作で直ちに利用停止するのではなく、現在の請求期間終了時に更新停止する設定を基本とします。</p>
            <div>
              {profile.role === "user" && <button type="button" disabled={busy} onClick={() => void openPortal()}>{busy ? "開いています…" : "Stripeで契約を管理"}</button>}
              <Link href="/plans">利用プランを見る</Link>
              <Link href="/commercial-transactions">販売条件を見る</Link>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
