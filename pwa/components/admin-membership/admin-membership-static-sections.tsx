"use client";

import type {
  MembershipAssignment,
  MembershipAuditAction,
  MembershipPlan,
} from "@/lib/admin-membership";
import type { PwaAdminUser } from "@/lib/pwa-admin-users";

function formatDate(value: string | null): string {
  if (!value) return "期限なし";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "—";
}

export function MembershipStatusSection({
  assignments,
  expiringSoon,
  plans,
  assignmentPlanCounts,
  users,
  onSelectUser,
}: {
  assignments: MembershipAssignment[];
  expiringSoon: MembershipAssignment[];
  plans: MembershipPlan[];
  assignmentPlanCounts: ReadonlyMap<string, number>;
  users: PwaAdminUser[];
  onSelectUser: (user: PwaAdminUser) => void | Promise<void>;
}) {
  return (
    <section className="admin-panel membership-admin-section">
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">MEMBER STATUS</p>
          <h2>現在のメンバー状況</h2>
        </div>
        <span className="availability-badge active">{assignments.length}人</span>
      </div>
      <div className="membership-status-grid">
        <article><span>有効メンバー</span><strong>{assignments.length}</strong><small>現在有効なCreator Club系特典</small></article>
        <article><span>7日以内に期限</span><strong>{expiringSoon.length}</strong><small>更新確認が必要なメンバー</small></article>
        {plans.map((plan) => (
          <article key={plan.planCode}>
            <span>{plan.displayName}</span>
            <strong>{assignmentPlanCounts.get(plan.planCode) ?? 0}</strong>
            <small>現在の有効ユーザー</small>
          </article>
        ))}
      </div>
      {expiringSoon.length > 0 && (
        <details className="membership-expiring-list">
          <summary>7日以内に期限が切れるメンバーを見る</summary>
          <div>
            {expiringSoon.map((item) => (
              <button type="button" key={item.userId} onClick={() => {
                const user = users.find((candidate) => candidate.id === item.userId);
                if (user) void onSelectUser(user);
              }}>
                <strong>{item.aasUserId}</strong>
                <span>{item.planName}</span>
                <small>{formatDate(item.expiresAt)}</small>
              </button>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

export function MembershipAuditSection({
  auditActions,
}: {
  auditActions: MembershipAuditAction[];
}) {
  return (
    <section className="admin-panel membership-admin-section">
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">AUDIT LOG</p>
          <h2>メンバー特典の変更履歴</h2>
        </div>
        <span className="availability-badge">直近{auditActions.length}件</span>
      </div>
      <p className="trial-admin-note">特典の付与・更新・取消をDB側で記録します。UI操作だけに依存しません。</p>
      <div className="membership-audit-list">
        {auditActions.map((item) => (
          <article key={item.id}>
            <strong>{item.targetAasUserId}</strong>
            <span>{item.action === "grant" ? "付与" : item.action === "revoke" ? "取消" : "更新"}</span>
            <small>{item.productCode}</small>
            <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
          </article>
        ))}
        {!auditActions.length && <p className="admin-empty-copy">まだメンバー特典の変更履歴はありません。</p>}
      </div>
    </section>
  );
}

export function MembershipRecommendationsSection() {
  return (
    <section className="admin-panel membership-admin-section membership-recommendations">
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">NEXT OPTION</p>
          <h2>次に追加できる運用機能</h2>
        </div>
      </div>
      <div className="membership-recommendation-grid">
        <article><strong>クラウド容量</strong><p>メンバーごとの画像保存容量と使用量を確認し、プラン別上限を設定できます。</p></article>
        <article><strong>期限更新の一括操作</strong><p>同じ更新月のユーザーをまとめて延長する運用にも拡張できます。</p></article>
        <article><strong>加入確認の自動化</strong><p>将来note側に公式な連携手段が用意された場合、手動確認から安全に切り替えられます。</p></article>
      </div>
    </section>
  );
}
