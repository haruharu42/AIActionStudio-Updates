import Link from "next/link";
import type { ReactNode } from "react";

export function LegalDocument({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f8fc",
        color: "#14213d",
        padding: "32px 16px 64px",
      }}
    >
      <article
        style={{
          maxWidth: 820,
          margin: "0 auto",
          background: "#ffffff",
          border: "1px solid #dbe3f0",
          borderRadius: 20,
          padding: "clamp(22px, 5vw, 44px)",
          boxShadow: "0 18px 50px rgba(20, 33, 61, 0.08)",
          lineHeight: 1.85,
        }}
      >
        <Link href="/" style={{ color: "#2457d6", textDecoration: "none" }}>
          ← AI Action Studioへ戻る
        </Link>
        <p
          style={{
            display: "inline-block",
            margin: "24px 0 8px",
            padding: "5px 10px",
            borderRadius: 999,
            background: "#eef4ff",
            color: "#234a91",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          現在の提供条件
        </p>
        <h1 style={{ margin: "8px 0 10px", fontSize: "clamp(28px, 5vw, 40px)" }}>
          {title}
        </h1>
        <p style={{ marginTop: 0, color: "#5b6578" }}>{description}</p>
        <p style={{ color: "#5b6578", fontSize: 14 }}>
          現在の新規販売は外部販売ページと利用コードによる受付を基本としています。AAS内のStripe新規購入は停止中で、直販を開始する場合は対象条件を購入確定前に表示します。
        </p>
        <hr style={{ border: 0, borderTop: "1px solid #e5eaf2", margin: "28px 0" }} />
        <div>{children}</div>
        <hr style={{ border: 0, borderTop: "1px solid #e5eaf2", margin: "32px 0 20px" }} />
        <nav aria-label="法的文書" style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <Link href="/terms">利用規約</Link>
          <Link href="/privacy">プライバシーポリシー</Link>
          <Link href="/ai-terms">AI利用条件</Link>
          <Link href="/commercial-transactions">特定商取引法に基づく表記</Link>
          <Link href="/support">お問い合わせ・開示請求</Link>
        </nav>
      </article>
    </main>
  );
}
