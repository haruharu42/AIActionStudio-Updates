"use client";

import Link from "next/link";

import { useSharedAccessState } from "@/components/access-state-provider";
import { ADMIN_SECTION_GROUPS, ADMIN_SECTIONS } from "@/lib/admin-sections";

export default function AdminPage() {
  const { state } = useSharedAccessState();
  const activeAdmin =
    state.kind === "ready" &&
    state.profile.role === "admin" &&
    state.profile.status === "active";

  if (!activeAdmin) return null;

  return (
    <main className="admin-page">
      <header className="admin-head admin-dashboard-head">
        <div>
          <p className="eyebrow">ADMIN CONTROL CENTER</p>
          <h1>管理ダッシュボード</h1>
          <p>管理機能を目的別に分離しました。必要な機能だけを開いて操作できます。</p>
        </div>
        <div className="admin-head-actions">
          <Link className="route-back" href="/">← ホームへ戻る</Link>
        </div>
      </header>

      <section className="admin-quick-guide" aria-label="管理ツールの使い方">
        <article><span>STEP 1</span><strong>まず「日常の管理」を確認</strong><p>問い合わせ、承認待ち、無料枠など、対応が必要な項目から確認します。</p></article>
        <article><span>STEP 2</span><strong>設定変更は目的別に開く</strong><p>販売・告知・制作支援を分けています。必要な場所だけ変更できます。</p></article>
        <article><span>STEP 3</span><strong>最後にシステム状態を確認</strong><p>アップデート、認証、監査・容量を確認し、安全な状態を保ちます。</p></article>
      </section>

      <section className="admin-only-tools-section admin-management-hub" aria-labelledby="admin-management-title">
        <div className="admin-only-tools-heading">
          <div>
            <p>ADMIN ONLY</p>
            <h2 id="admin-management-title">管理機能</h2>
          </div>
          <small>目的から選ぶだけで使えます</small>
        </div>
        <div className="admin-section-groups">
          {ADMIN_SECTION_GROUPS.map((group) => (
            <section className="admin-section-group" key={group.id}>
              <div className="admin-section-group-head">
                <div><p className="eyebrow">{group.eyebrow}</p><h2>{group.title}</h2></div>
                <p>{group.description}</p>
              </div>
              <div className="admin-section-group-grid">
                {ADMIN_SECTIONS.filter((section) => section.group === group.id).map((section) => (
                  <Link key={section.id} className="admin-only-tool-card" href={section.href}>
                    <span>{section.eyebrow}</span>
                    <h3>{section.title}</h3>
                    <p>{section.description}</p>
                    <strong>この機能を開く →</strong>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="admin-panel admin-dashboard-section">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">SAFETY</p>
            <h2>管理画面の安全設計</h2>
          </div>
        </div>
        <p className="trial-admin-note">
          管理ルートはactive管理者だけが表示できます。実際の管理操作もSupabase側のactive管理者判定で再確認されるため、画面を直接開くだけでは実行できません。
        </p>
      </section>
    </main>
  );
}
