"use client";

import { getExternalSalesReadiness } from "@/lib/sales-readiness";
import type { SalesSettings } from "@/lib/sales-settings";

export function SalesReadinessPanel({
  settings,
  hasUnsavedChanges = false,
}: {
  settings: SalesSettings;
  hasUnsavedChanges?: boolean;
}) {
  const readiness = getExternalSalesReadiness(settings);

  return (
    <section className="admin-panel sales-readiness-panel" aria-labelledby="sales-readiness-title">
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">EXTERNAL SALES READINESS</p>
          <h2 id="sales-readiness-title">外部販売ルートの販売準備</h2>
          <p>最短販売ルート「外部販売＋利用コード」に必要な3項目だけを確認します。AAS全体の本番公開判定とは別です。</p>
        </div>
        <strong className={readiness.ready ? "ready" : "action"}>
          {readiness.completed} / {readiness.total}
        </strong>
      </div>
      <div className="sales-readiness-list">
        {readiness.items.map((item) => (
          <div className="sales-readiness-item" key={item.key}>
            <span className={item.status}>{item.status === "ready" ? "準備済み" : "要対応"}</span>
            <div><strong>{item.label}</strong><small>{item.detail}</small></div>
          </div>
        ))}
      </div>
      {hasUnsavedChanges && (
        <p className="sales-readiness-draft">
          未保存の変更を含む確認結果です。「変更を保存」を押すまで本番の販売設定は変わりません。
        </p>
      )}
      <p className={readiness.ready ? "sales-readiness-summary ready" : "sales-readiness-summary action"}>
        {readiness.ready
          ? "外部販売の購入導線は設定上準備済みです。販売開始前に実機E2E・法務・サポート・公開段階を別途確認してください。"
          : "外部販売の購入導線には未完了項目があります。上の「要対応」を解消するまで販売開始扱いにしません。"}
      </p>
    </section>
  );
}
