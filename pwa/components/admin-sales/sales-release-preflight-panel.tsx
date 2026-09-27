"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  const [verifiedMfaCount, setVerifiedMfaCount] = useState<number | null>(null);
  const [mfaCheckFailed, setMfaCheckFailed] = useState(false);

  useEffect(() => {
    let active = true;
    try {
      const client = getSupabaseClient();
      void client.auth.mfa.listFactors().then(
        ({ data, error }) => {
          if (!active) return;
          if (error) {
            setMfaCheckFailed(true);
            setVerifiedMfaCount(null);
            return;
          }
          setMfaCheckFailed(false);
          setVerifiedMfaCount(data.totp.filter((factor) => factor.status === "verified").length);
        },
        () => {
          if (!active) return;
          setMfaCheckFailed(true);
          setVerifiedMfaCount(null);
        },
      );
    } catch {
      setMfaCheckFailed(true);
      setVerifiedMfaCount(null);
    }
    return () => {
      active = false;
    };
  }, []);

  const mfaReady = verifiedMfaCount !== null && verifiedMfaCount > 0;
  const mfaStatus = mfaCheckFailed
    ? "確認失敗"
    : verifiedMfaCount === null
      ? "確認中"
      : mfaReady
        ? `${verifiedMfaCount}個確認済み`
        : "未登録";

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
            <strong>管理者MFA</strong>
            <span className={mfaReady ? "ready" : mfaCheckFailed ? "review" : "action"}>{mfaStatus}</span>
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
