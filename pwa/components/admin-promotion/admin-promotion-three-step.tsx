"use client";

import { useState } from "react";

import {
  PROMOTION_METHOD_OPTIONS,
  SALES_CHANNEL_OPTIONS,
  SALES_PRODUCT_OPTIONS,
  type PromotionMethodKey,
  type SalesChannelKey,
  type SalesProductKey,
} from "@/components/admin-promotion/admin-promotion-options";
import type { PromotionThreeStepSelection } from "@/lib/admin-promotion-three-step";

export function AdminPromotionThreeStep({
  onApply,
}: {
  onApply(selection: PromotionThreeStepSelection): void;
}) {
  const [salesProduct, setSalesProduct] = useState<SalesProductKey>("aas-pwa");
  const [salesChannel, setSalesChannel] = useState<SalesChannelKey>("note");
  const [promotionMethod, setPromotionMethod] = useState<PromotionMethodKey>("article");

  return (
    <section className="admin-promo-three-step" aria-label="3ステップかんたん販促">
      <div className="admin-promo-three-step-head">
        <div>
          <p className="eyebrow">3 STEP AUTO SETUP</p>
          <h2>3ステップで作成開始</h2>
          <p>迷ったらここだけ使ってください。紹介するもの・掲載先・作りたい内容を選ぶと、下の作成画面を自動で整えます。</p>
        </div>
        <strong>ここでは販売設定を変更しません</strong>
      </div>
      <div className="admin-promo-three-step-grid">
        <label className="admin-promo-field">
          <span>① 紹介する商品・状態</span>
          <select value={salesProduct} onChange={(event) => setSalesProduct(event.target.value as SalesProductKey)}>
            {SALES_PRODUCT_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.label} — {item.note}</option>)}
          </select>
        </label>
        <label className="admin-promo-field">
          <span>② 掲載・案内する場所</span>
          <select value={salesChannel} onChange={(event) => setSalesChannel(event.target.value as SalesChannelKey)}>
            {SALES_CHANNEL_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.label} — {item.note}</option>)}
          </select>
        </label>
        <label className="admin-promo-field">
          <span>③ 作りたい内容</span>
          <select value={promotionMethod} onChange={(event) => setPromotionMethod(event.target.value as PromotionMethodKey)}>
            {PROMOTION_METHOD_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.label} — {item.note}</option>)}
          </select>
        </label>
      </div>
      <div className="admin-promo-three-step-actions">
        <button
          type="button"
          onClick={() => onApply({ salesProduct, salesChannel, promotionMethod })}
        >
          この内容で作成画面を準備
        </button>
        <small>押したあとは下の作成画面を確認し、「生成用プロンプトをコピー」へ進みます。Stripe・7日券・月額を選んでも販売受付は有効化されません。</small>
      </div>
    </section>
  );
}
