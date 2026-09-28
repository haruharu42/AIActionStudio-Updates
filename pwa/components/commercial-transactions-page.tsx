"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  COMMERCE_PLAN_COPY,
  fetchCommerceConfig,
  formatCommercePrice,
  renewalLabel,
  type PublicCommerceConfig,
} from "@/lib/commerce";
import {
  fetchPublicSalesSettings,
  planSalesEnabled,
  safeExternalSalesUrl,
  type SalesSettings,
} from "@/lib/sales-settings";

const DISCLOSURE_ON_REQUEST = "請求があった場合には遅滞なく開示します。";

function display(value: string): string {
  return value || "正式販売前に確定・表示します";
}

function safeHttpsUrl(value: string | undefined): string {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export function CommercialTransactionsPage() {
  const [config, setConfig] = useState<PublicCommerceConfig | null>(null);
  const [salesSettings, setSalesSettings] = useState<SalesSettings | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([fetchCommerceConfig(), fetchPublicSalesSettings()]).then(
      ([nextConfig, nextSalesSettings]) => {
        if (!active) return;
        setConfig(nextConfig);
        setSalesSettings(nextSalesSettings);
      },
      (error) => {
        if (active) setMessage(error instanceof Error ? error.message : "販売情報を取得できませんでした。");
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const seller = config?.seller;
  const onRequest = seller?.disclosureMode === "on_request";
  const sellerName = onRequest ? DISCLOSURE_ON_REQUEST : display(seller?.name ?? "");
  const sellerAddress = onRequest ? DISCLOSURE_ON_REQUEST : display(seller?.address ?? "");
  const sellerPhone = onRequest ? DISCLOSURE_ON_REQUEST : display(seller?.phone ?? "");
  const supportUrl = safeHttpsUrl(seller?.supportUrl) || "/support";
  const externalSalesUrl = safeExternalSalesUrl(salesSettings?.externalSalesUrl ?? "");
  const stripeSalesEnabled = salesSettings?.stripeCheckoutEnabled === true;
  const externalSalesEnabled = salesSettings?.externalSalesEnabled === true;
  const externalSalesBlockedByLegal = externalSalesEnabled && Boolean(externalSalesUrl) && config?.legalReady !== true;
  const externalSalesReady = externalSalesEnabled && config?.legalReady === true && Boolean(externalSalesUrl);
  const visibleStripePlans = useMemo(
    () => (stripeSalesEnabled ? (config?.plans ?? []).filter((plan) => planSalesEnabled(salesSettings, plan.planCode)) : []),
    [config, salesSettings, stripeSalesEnabled],
  );

  return (
    <main className="legal-commerce-page">
      <article>
        <Link href="/plans">← 利用プランへ戻る</Link>
        <p className="legal-commerce-label">特定商取引法に基づく表記</p>
        <h1>AI Action Studio 販売条件</h1>
        <p className="legal-commerce-lead">
          {externalSalesReady && !stripeSalesEnabled
            ? "現在は note・Brain・Tips 等の外部販売と利用コードによる受付を行っています。AAS内のStripe新規購入は停止しています。"
            : externalSalesBlockedByLegal && !stripeSalesEnabled
              ? "外部販売URLは設定されていますが、販売者情報・公開サポート等の販売前情報が未完了のため、購入導線を公開していません。AAS内のStripe新規購入も停止しています。"
              : externalSalesEnabled && !stripeSalesEnabled
                ? "外部販売の受付設定は有効ですが、購入ページURLが未設定のため、現在は購入導線を公開していません。AAS内のStripe新規購入も停止しています。"
                : "一般販売開始前の表示確認ページです。LIVE販売は、必要な販売者情報と決済設定が揃うまでシステム側で無効になります。"}
        </p>
        {stripeSalesEnabled && config?.mode !== "live" && <p className="legal-commerce-warning">現在は正式なLIVE販売状態ではありません。</p>}
        {!stripeSalesEnabled && <p className="legal-commerce-warning">AAS内のStripe新規受付は現在停止中です。</p>}
        {externalSalesReady && !stripeSalesEnabled && (
          <p><a href={externalSalesUrl} target="_blank" rel="noreferrer">現在の外部販売ページを開く</a></p>
        )}
        {message && <p className="commerce-message" role="status">{message}</p>}

        {onRequest && (
          <section className="legal-commerce-notes seller-disclosure-note">
            <h2>販売者情報の開示について</h2>
            <p>販売者の氏名・所在地・電話番号は公開ページへ常時掲載せず、請求があった場合に遅滞なく開示する方式です。開示をご希望の場合は、下記のお問い合わせ・開示請求窓口から手続き方法をご確認ください。正式な販売者情報は公開APIへ返さず、販売側で開示できる状態を保持します。</p>
          </section>
        )}

        <dl className="legal-commerce-table">
          <div><dt>販売事業者</dt><dd>{sellerName}</dd></div>
          <div><dt>所在地</dt><dd>{sellerAddress}</dd></div>
          <div><dt>電話番号</dt><dd>{sellerPhone}</dd></div>
          <div><dt>メールアドレス</dt><dd>{seller?.email ? seller.email : <Link href="/support">問い合わせページからご案内します</Link>}</dd></div>
          <div><dt>問い合わせ・開示請求窓口</dt><dd><a href={supportUrl}>問い合わせページ</a></dd></div>
          <div><dt>販売価格</dt><dd>{stripeSalesEnabled ? "下記の受付中プランに表示します。決済画面にも最終請求額を表示します。" : externalSalesReady ? "現在の販売価格は、note・Brain・Tips 等の購入先となる外部販売ページに表示します。" : "外部販売を開始する場合は、購入ページに販売価格を表示します。"}</dd></div>
          <div><dt>商品代金以外の必要料金</dt><dd>インターネット接続料金・通信料金等は利用者の負担です。その他の費用が生じる場合は購入前に表示します。</dd></div>
          <div><dt>支払方法</dt><dd>{stripeSalesEnabled ? "Stripe Checkoutで提供される支払方法。実際に利用可能な方法は決済画面に表示します。" : externalSalesReady ? "note・Brain・Tips 等の外部販売ページで案内する支払方法を利用します。AAS内ではStripe新規決済を受け付けていません。" : "外部販売を開始する場合は、購入ページで支払方法を案内します。AAS内ではStripe新規決済を受け付けていません。"}</dd></div>
          <div><dt>支払時期</dt><dd>{stripeSalesEnabled ? "7日利用パスは購入時に決済します。月額プランは申込時に初回決済し、その後は1か月ごとに自動更新・決済します。" : externalSalesReady ? "購入先となる外部販売ページに表示される条件に従います。" : "外部販売を開始する場合は、購入ページへ支払時期を表示します。"}</dd></div>
          <div><dt>サービス提供時期</dt><dd>{stripeSalesEnabled ? "Stripeから決済完了通知を受信し利用権へ反映後、対象機能を利用できます。" : externalSalesReady ? "外部販売で購入後、案内された利用コードをAASへ登録し、利用権へ反映された後に対象機能を利用できます。" : "外部販売を開始する場合は、購入後に案内する利用コードをAASへ登録し、利用権へ反映された後に対象機能を利用できる方式とします。"}</dd></div>
          <div><dt>解約</dt><dd>{stripeSalesEnabled ? "月額プランは契約管理画面から解約できます。解約予約後は原則として現在の請求期間終了まで利用でき、次回更新を停止します。" : externalSalesReady ? "外部販売商品のキャンセル・解約条件は購入先の販売ページに表示します。AAS内のStripe月額新規受付は停止しています。" : "外部販売を開始する場合は、キャンセル・解約条件を購入ページへ表示します。AAS内のStripe月額新規受付は停止しています。"}</dd></div>
          {stripeSalesEnabled && salesSettings?.pwa7DayEnabled && <div><dt>7日利用パス</dt><dd>自動更新はありません。有効期間終了後に自動的に利用権が終了します。</dd></div>}
          <div><dt>返金・キャンセル</dt><dd>{stripeSalesEnabled ? "デジタルサービスの性質、法令上の取扱い、重複決済・システム障害等の事情を踏まえた条件を購入確定前に表示します。" : externalSalesReady ? "外部販売における返金・キャンセル条件は購入先の販売ページで購入確定前に表示します。AAS内のStripe直販を開始する場合は、直販向け条件を別途表示します。" : "外部販売を開始する場合は、返金・キャンセル条件を購入確定前に販売ページへ表示します。AAS内のStripe直販を開始する場合は、直販向け条件を別途表示します。"}</dd></div>
          <div><dt>動作環境</dt><dd>PWA版は、販売ページで案内する対応ブラウザ・対応端末・ネットワーク環境で利用します。新規販売はPWA版のみを対象とします。</dd></div>
        </dl>

        <section className="legal-commerce-plans">
          <h2>プラン別の販売条件</h2>
          {visibleStripePlans.map((plan) => (
            <article key={plan.planCode}>
              <h3>{COMMERCE_PLAN_COPY[plan.planCode].name}</h3>
              <strong>{formatCommercePrice(plan.price)}</strong>
              <span>{renewalLabel(plan)}</span>
              <p>{COMMERCE_PLAN_COPY[plan.planCode].description}</p>
            </article>
          ))}
          {!stripeSalesEnabled && (
            <p>{externalSalesReady
              ? "現在、AAS内のStripe新規購入は停止中です。外部販売の商品・価格・購入条件は各販売ページで確認してください。"
              : "現在、AAS内のStripe新規購入は停止中で、外部販売ページの購入URLも未設定です。"}</p>
          )}
          {stripeSalesEnabled && visibleStripePlans.length === 0 && <p>現在、AAS内で受付中のStripeプランはありません。</p>}
        </section>

        <section className="legal-commerce-notes">
          <h2>購入確定前の表示</h2>
          <p>{stripeSalesEnabled
            ? "購入時は、プラン名、価格、利用期間、自動更新の有無、解約条件を確認したうえでStripe Checkoutへ進みます。決済確定前にもStripeの最終画面で請求内容を確認してください。"
            : externalSalesReady
              ? "現在は外部販売ページで、商品内容、価格、利用期間、返金・キャンセル条件等を確認してから購入してください。購入後は案内された利用コードをAASへ登録します。"
              : "外部販売ページの購入URLが設定されるまで購入受付は開始しません。販売開始時は、商品内容、価格、利用期間、返金・キャンセル条件等を購入前に確認できる状態にします。"}</p>
        </section>

        <nav className="legal-commerce-links">
          <Link href="/support">お問い合わせ・開示請求</Link>
          <Link href="/terms">利用規約</Link>
          <Link href="/privacy">プライバシーポリシー</Link>
          <Link href="/ai-terms">AI利用条件</Link>
          <Link href="/billing">契約・利用権</Link>
        </nav>
      </article>
    </main>
  );
}
