"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchCommerceConfig } from "@/lib/commerce";
import { fetchPublicSalesSettings, safeExternalSalesUrl } from "@/lib/sales-settings";

function safeHttpsUrl(value: string): string {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export function SupportRequestPage() {
  const [externalSalesUrl, setExternalSalesUrl] = useState("");
  const [supportUrl, setSupportUrl] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([fetchPublicSalesSettings(), fetchCommerceConfig()]).then(
      ([settings, commerce]) => {
        if (!active) return;
        setExternalSalesUrl(
          settings.externalSalesEnabled && commerce.legalReady
            ? safeExternalSalesUrl(settings.externalSalesUrl)
            : "",
        );
        setSupportUrl(safeHttpsUrl(commerce.seller.supportUrl));
      },
      () => {
        if (active) setMessage("販売・問い合わせ情報を取得できませんでした。AASへログインできる場合は、アプリ内の問い合わせセンターをご利用ください。");
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="legal-commerce-page">
      <article>
        <Link href="/commercial-transactions">← 特定商取引法に基づく表記へ戻る</Link>
        <p className="legal-commerce-label">お問い合わせ・開示請求</p>
        <h1>AI Action Studio お問い合わせ案内</h1>
        <p className="legal-commerce-lead">
          {externalSalesUrl
            ? "現在の新規販売は、note・Brain・Tips等の外部販売ページと利用コードによる受付を基本としています。AAS内のStripe新規購入は停止中です。"
            : "外部販売と利用コードを初回販売経路として準備していますが、購入ページURLは現在未設定です。AAS内のStripe新規購入も停止中です。"}
        </p>

        <section className="legal-commerce-notes">
          <h2>AASアカウントをお持ちの方</h2>
          <p>ログイン後の問い合わせセンターでは、購入・利用権、不具合、使い方、機能要望などを送信し、管理者からの返信履歴も確認できます。</p>
          <p><Link href="/inquiries">AAS内の問い合わせセンターを開く →</Link></p>
        </section>

        <section className="legal-commerce-notes">
          <h2>購入前・ログインできない場合</h2>
          {supportUrl ? (
            <p><a href={supportUrl} target="_blank" rel="noreferrer">公開サポート窓口を開く ↗</a></p>
          ) : externalSalesUrl ? (
            <p>現在の公開サポート窓口は準備中です。購入前の問い合わせ・販売者情報の開示請求は、外部販売ページに表示される問い合わせ手段をご利用ください。 <a href={externalSalesUrl} target="_blank" rel="noreferrer">外部販売ページを開く ↗</a></p>
          ) : (
            <p>公開サポート窓口と購入ページURLは現在未設定です。販売開始前に、購入前でも利用できる問い合わせ・開示請求窓口を設定します。</p>
          )}
        </section>

        <section className="legal-commerce-notes">
          <h2>販売者情報の開示請求</h2>
          <p>
            特定商取引法に基づく販売者の氏名・所在地・電話番号の開示を希望する場合は、購入前でも請求できます。購入先となる外部販売ページに表示された問い合わせ手段から、「販売者情報の開示請求」と明記してご連絡ください。請求を受けた場合は、申込みの判断に先立って確認できるよう遅滞なく案内する運用とします。
          </p>
          {externalSalesUrl ? (
            <p><a href={externalSalesUrl} target="_blank" rel="noreferrer">外部販売ページを開く</a></p>
          ) : (
            <p>購入ページURLは現在未設定です。販売開始前の開示請求や問い合わせ方法は、運用担当者が購入前に確認できる窓口を確定してから公開します。</p>
          )}
        </section>

        <section className="legal-commerce-notes">
          <h2>購入・利用コードに関するお問い合わせ</h2>
          <p>
            購入済みの場合は、購入したプラットフォーム名、商品名、購入時期、AASで表示されたエラー内容を添えてください。利用コードそのものを公開投稿や第三者へ共有しないでください。
          </p>
        </section>

        <section className="legal-commerce-notes">
          <h2>個人情報に関する請求</h2>
          <p>
            自己の個人データに関する開示、訂正、利用停止、削除等を希望する場合も、上記の問い合わせ手段から請求できます。必要に応じて本人確認をお願いすることがあります。
          </p>
        </section>

        <section className="legal-commerce-notes">
          <h2>送信しないでください</h2>
          <ul>
            <li>クレジットカード番号、セキュリティコード、銀行口座の暗証情報</li>
            <li>パスワード、認証コード、アクセストークン、秘密鍵</li>
            <li>問い合わせ対応に不要な第三者の個人情報や機密情報</li>
          </ul>
        </section>

        {message && <p className="commerce-message" role="status">{message}</p>}

        <nav className="legal-commerce-links">
          <Link href="/terms">利用規約</Link>
          <Link href="/privacy">プライバシーポリシー</Link>
          <Link href="/ai-terms">AI利用条件</Link>
          <Link href="/commercial-transactions">特定商取引法に基づく表記</Link>
        </nav>
      </article>
    </main>
  );
}
