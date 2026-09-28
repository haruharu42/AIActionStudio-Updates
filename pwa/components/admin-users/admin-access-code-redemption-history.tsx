import { formatAdminDate } from "@/lib/admin-users-view";
import type { PwaInviteRedemption } from "@/lib/pwa-admin-users";

function entitlementLabel(item: PwaInviteRedemption): string {
  if (!item.entitlementStatus) return "未確認";
  if (item.entitlementStatus !== "active") return item.entitlementStatus;
  if (!item.entitlementExpiresAt) return "利用中";
  const expiresAt = new Date(item.entitlementExpiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now() ? "利用中" : "期限到達";
}

export function AdminAccessCodeRedemptionHistory({
  redemptions,
}: {
  redemptions: PwaInviteRedemption[];
}) {
  return (
    <section aria-label="利用コード使用履歴">
      <div className="admin-subsection-heading">
        <h3>利用コード使用履歴</h3>
        <small>最新 {redemptions.length} 件</small>
      </div>
      <p className="admin-detail-note">
        外部販売E2Eでは「購入者のAAS ID → 利用日時 → PWA利用権状態」をここで確認します。メール・請求情報は表示しません。
      </p>
      <div className="admin-invite-list">
        {redemptions.length ? redemptions.map((item) => (
          <article key={item.redemptionId}>
            <div className="admin-code-title">
              <strong>{item.aasUserId}</strong>
              <small>{item.displayName || "表示名なし"}</small>
            </div>
            <span>{item.inviteLabel || "ラベルなし"} / {item.salesChannel}</span>
            <small>利用日時: {formatAdminDate(item.redeemedAt)}</small>
            <small>PWA利用権: {entitlementLabel(item)} / 期限: {formatAdminDate(item.entitlementExpiresAt)}</small>
            {item.externalReference && <small>外部参照: {item.externalReference}</small>}
          </article>
        )) : (
          <p className="admin-empty-copy">利用コードの使用履歴はまだありません。</p>
        )}
      </div>
    </section>
  );
}
