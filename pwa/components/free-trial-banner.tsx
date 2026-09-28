"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import {
  FREE_TRIAL_USAGE_CHANGED_EVENT,
  getMyFreeTrialStatus,
  type FreeTrialStatus,
  type TrialUsageResult,
} from "@/lib/free-trial";
import { fetchPublicSalesSettings, type SalesSettings } from "@/lib/sales-settings";

type LimitKind = "daily" | "feature" | null;

function formatEnd(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function dismissedKey(usageDate: string): string {
  return `aas:free-trial-limit-dismissed:${usageDate}`;
}

export function FreeTrialBanner() {
  const { state: accessState, client } = useSharedAccessState();
  const accessUserId = accessState.kind === "ready" ? accessState.profile.id : "";
  const [status, setStatus] = useState<FreeTrialStatus | null>(null);
  const [sales, setSales] = useState<SalesSettings | null>(null);
  const [limitKind, setLimitKind] = useState<LimitKind>(null);

  const loadStatus = useCallback(async (forcedKind: Exclude<LimitKind, null> | null = null) => {
    if (!accessUserId || !client) {
      setStatus(null);
      setLimitKind(null);
      return;
    }
    try {
      const next = await getMyFreeTrialStatus(client);
      setStatus(next);
      if (next.bypassLimits || next.trialStatus !== "active") {
        setLimitKind(null);
        return;
      }

      if (forcedKind) {
        setLimitKind(forcedKind);
        return;
      }

      const remaining = Math.max(0, next.dailyTotalLimit - next.totalUsed);
      if (remaining > 0) {
        setLimitKind(null);
        return;
      }
      const dismissed = window.localStorage.getItem(dismissedKey(next.usageDate)) === "1";
      setLimitKind(dismissed ? null : "daily");
    } catch {
      setStatus(null);
      setLimitKind(null);
    }
  }, [accessUserId, client]);

  useEffect(() => {
    let active = true;
    if (!accessUserId || !client) {
      queueMicrotask(() => {
        if (!active) return;
        setStatus(null);
        setSales(null);
        setLimitKind(null);
      });
      return () => { active = false; };
    }
    queueMicrotask(() => {
      if (!active) return;
      void Promise.allSettled([
        loadStatus(),
        fetchPublicSalesSettings().then((next) => { if (active) setSales(next); }),
      ]);
    });

    const onUsageChanged = (event: Event) => {
      if (!active) return;
      const detail = (event as CustomEvent<TrialUsageResult>).detail;
      let forcedKind: Exclude<LimitKind, null> | null = null;
      if (detail?.reason === "daily_limit" || (detail?.allowed === true && detail.dailyTotalLimit <= detail.totalUsed)) {
        forcedKind = "daily";
      } else if (
        detail?.reason === "feature_limit"
        || (detail?.allowed === true && detail.featureLimit <= detail.featureUsed && detail.totalUsed < detail.dailyTotalLimit)
      ) {
        forcedKind = "feature";
      }
      void loadStatus(forcedKind);
    };
    const onFocus = () => { if (active) void loadStatus(); };
    window.addEventListener(FREE_TRIAL_USAGE_CHANGED_EVENT, onUsageChanged);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener(FREE_TRIAL_USAGE_CHANGED_EVENT, onUsageChanged);
      window.removeEventListener("focus", onFocus);
    };
  }, [accessUserId, client, loadStatus]);

  if (!status || status.bypassLimits || status.trialStatus !== "active") return null;

  const remaining = Math.max(0, status.dailyTotalLimit - status.totalUsed);
  const purchaseUrl = sales?.externalSalesEnabled && sales.accessCodeEnabled && sales.externalSalesUrl ? sales.externalSalesUrl : "";
  const permanentFree = status.endsAt === null && status.remainingDays === null;
  const closeLimitDialog = () => {
    if (limitKind === "daily") {
      try {
        window.localStorage.setItem(dismissedKey(status.usageDate), "1");
      } catch {
        // Dismiss still works for this render even when storage is unavailable.
      }
    }
    setLimitKind(null);
  };

  return (
    <>
      <section className="free-trial-banner" aria-label="無料利用状態">
        <div>
          <span className="free-trial-badge">{permanentFree ? "無料プラン" : "無料トライアル"}</span>
          <strong>{permanentFree ? "期限なし" : `残り ${status.remainingDays ?? 0} 日`}</strong>
          <small>{permanentFree ? "日次の無料回数はリセット後に復活します" : `終了予定 ${formatEnd(status.endsAt)}`}</small>
        </div>
        <div className="free-trial-usage">
          <span>本日の利用</span>
          <strong>{status.totalUsed} / {status.dailyTotalLimit} 回</strong>
          <small>残り {remaining} 回 · {status.resetTimezone} {String(status.resetHour).padStart(2, "0")}:00 リセット</small>
        </div>
        {purchaseUrl ? (
          <a href={purchaseUrl} target="_blank" rel="noopener noreferrer">利用権を見る</a>
        ) : (
          <Link href="/plans">利用プランを見る</Link>
        )}
      </section>

      {limitKind && (
        <div className="free-limit-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeLimitDialog(); }}>
          <section className="free-limit-dialog" role="dialog" aria-modal="true" aria-labelledby="free-limit-title">
            <button className="free-limit-close" type="button" aria-label="閉じる" onClick={closeLimitDialog}>×</button>
            <span className="free-trial-badge">{limitKind === "daily" ? "本日の無料枠を使い切りました" : "この機能の本日の無料回数に達しました"}</span>
            <h2 id="free-limit-title">{limitKind === "daily" ? "次のリセットで無料利用回数が戻ります" : "この機能は次のリセット後に再び利用できます"}</h2>
            <p>{status.resetTimezone} {String(status.resetHour).padStart(2, "0")}:00 のリセット後に、管理者が設定した1日分の無料回数を再び利用できます。</p>
            {limitKind === "feature" && remaining > 0 && <p>ほかの機能は、本日の残り総回数 {remaining} 回の範囲で引き続き利用できます。</p>}
            {purchaseUrl && (
              <p>今すぐ継続して利用する場合は、外部販売ページで利用権をご確認ください。購入後に案内される利用コードをAASへ登録すると、有効な利用権として利用できます。</p>
            )}
            <div className="free-limit-actions">
              {purchaseUrl && <a className="primary-action" href={purchaseUrl} target="_blank" rel="noopener noreferrer">利用権を見る ↗</a>}
              <button className="secondary-action" type="button" onClick={closeLimitDialog}>閉じる</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
