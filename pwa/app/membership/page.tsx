"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import questStyles from "@/components/creator-quests.module.css";
import styles from "@/components/creator-system.module.css";
import { getArticleStockSummary, type ArticleStockSummary } from "@/lib/article-library-v2";
import {
  formatRefreshCadence,
  getMyCreatorDashboard,
  listCreatorMembershipPlans,
  type CreatorDashboard,
  type CreatorMembershipPlan,
} from "@/lib/creator-system";
import {
  getCreatorMembershipPublicSettings,
  listCreatorMembershipFeatureMatrix,
  type CreatorMembershipFeatureRow,
  type CreatorMembershipPublicSettings,
} from "@/lib/membership-access";
import { getSupabaseClient } from "@/lib/supabase";

function formatMembershipPrice(value: number | null): string {
  return value === null ? "料金未設定" : `¥${value.toLocaleString("ja-JP")} / 月`;
}

export default function CreatorMembershipPage() {
  const [dashboard, setDashboard] = useState<CreatorDashboard | null>(null);
  const [plans, setPlans] = useState<CreatorMembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [publicSettings, setPublicSettings] = useState<CreatorMembershipPublicSettings | null>(null);
  const [featureMatrix, setFeatureMatrix] = useState<CreatorMembershipFeatureRow[]>([]);
  const [articleStockSummary, setArticleStockSummary] = useState<ArticleStockSummary | null>(null);

  const load = useCallback(async () => {
    try {
      const client = getSupabaseClient();
      const [nextDashboard, nextPlans, nextPublicSettings, nextFeatureMatrix, nextArticleStockSummary] = await Promise.all([
        getMyCreatorDashboard(client),
        listCreatorMembershipPlans(client),
        getCreatorMembershipPublicSettings(client),
        listCreatorMembershipFeatureMatrix(client),
        getArticleStockSummary(client).catch(() => null),
      ]);
      setDashboard(nextDashboard);
      setPlans(nextPlans);
      setPublicSettings(nextPublicSettings);
      setFeatureMatrix(nextFeatureMatrix);
      setArticleStockSummary(nextArticleStockSummary);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Creator Club特典を読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => { active = false; };
  }, [load]);

  const featuresByPlan = useMemo(() => {
    const map = new Map<string, CreatorMembershipFeatureRow[]>();
    for (const item of featureMatrix) {
      if (!item.enabled) continue;
      const items = map.get(item.planCode) ?? [];
      items.push(item);
      map.set(item.planCode, items);
    }
    return map;
  }, [featureMatrix]);

  return (
    <main className={styles.page}>
      <div className={styles.pageInner}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>CREATOR CLUB</p>
            <h1>メンバー特典</h1>
            <p>AASに登録されたnoteメンバーシッププランに応じて、アプリ内の特典を切り替えられる構成です。</p>
          </div>
          <Link className={styles.backLink} href="/">← ホームへ</Link>
        </header>

        {publicSettings?.noteMembershipUrl ? (
          <section className={questStyles.membershipJoinCard}>
            <div>
              <p className={styles.eyebrow}>NOTE MEMBERSHIP</p>
              <h2>{publicSettings.displayName}</h2>
              <p>{publicSettings.guidance || "noteメンバーシップに参加すると、対象プランのAAS特典を利用できます。"}</p>
            </div>
            <a href={publicSettings.noteMembershipUrl} target="_blank" rel="noreferrer">noteメンバーシップを見る ↗</a>
          </section>
        ) : null}

        {dashboard ? (
          <section className={styles.panel}>
            <h2>現在の利用状態</h2>
            <div className={questStyles.missionSummary}>
              <div><small>PLAN</small><strong>{dashboard.membershipPlanName || "Standard"}</strong></div>
              <div><small>KNOWLEDGE</small><strong>{dashboard.knowledgeTier === "fresh" ? "Fresh" : "Stable"}</strong></div>
              <div><small>ARTICLE XP</small><strong>×{dashboard.articleXpMultiplier.toFixed(1)}</strong></div>
              <div><small>記事枠ボーナス</small><strong>+{dashboard.creatorArticleQuotaBonus}</strong></div>
            </div>
          </section>
        ) : null}

        {articleStockSummary ? (
          <section className={styles.panel}>
            <h2>記事ライブラリ保存枠</h2>
            <p className={styles.panelLead}>現在のアカウントに実際に適用されている保存枠です。記事作成・複製で1件ずつ使用します。</p>
            <div className={questStyles.missionSummary}>
              <div><small>保存済み</small><strong>{articleStockSummary.currentArticles}件</strong></div>
              <div><small>上限</small><strong>{articleStockSummary.isUnlimited ? "無制限" : `${articleStockSummary.maxArticles ?? 0}件`}</strong></div>
              <div><small>残り</small><strong>{articleStockSummary.isUnlimited ? "無制限" : `${articleStockSummary.remainingArticles ?? 0}件`}</strong></div>
            </div>
          </section>
        ) : null}

        {loading ? <div className={styles.empty}>Creator Club特典を読み込んでいます…</div> : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        {!loading && !error ? (
          <section className={questStyles.planGrid} aria-label="Creator Clubプラン">
            {plans.map((plan) => (
              <article className={`${questStyles.planCard} ${plan.isCurrent ? questStyles.planCurrent : ""}`} key={plan.planCode}>
                <div className={questStyles.missionHeader}>
                  <span className={styles.memberBadge}>{plan.badgeLabel}</span>
                  {plan.isCurrent ? <span className={styles.tierBadge}>利用中</span> : null}
                </div>
                <h2>{plan.displayName}</h2>
                <div className={questStyles.membershipPlanPrice}>
                  <strong>{formatMembershipPrice(plan.monthlyPriceYen)}</strong>
                  <small>note側の月額料金</small>
                </div>
                <p>{plan.description || "このプランで利用できるAAS特典は下に表示されます。"}</p>
                <div className={questStyles.planBenefits}>
                  <div><small>AI Knowledge</small><strong>{plan.knowledgeChannel === "fresh" ? "Fresh" : "Stable"} / {formatRefreshCadence(plan.knowledgeRefreshHours)}</strong></div>
                  <div><small>完成記事XP</small><strong>×{plan.articleXpMultiplier.toFixed(1)}</strong></div>
                  <div><small>記事ストック上限</small><strong>+{plan.articleQuotaBonus}</strong></div>
                  <div><small>テンプレートTier</small><strong>{plan.templateTier.toUpperCase()}</strong></div>
                </div>
                {(featuresByPlan.get(plan.planCode)?.length ?? 0) > 0 ? (
                  <div className={questStyles.membershipFeatureList}>
                    <strong>このプランで利用できる機能</strong>
                    <ul>
                      {featuresByPlan.get(plan.planCode)?.map((feature) => (
                        <li key={feature.featureKey}>
                          <span>✓</span>
                          <div><b>{feature.featureName}</b><small>{feature.featureDescription}</small></div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            ))}
          </section>
        ) : null}

        <div className={styles.notice}>
          AAS側ではプランと特典を分離して管理しています。管理者がnote側の加入を確認後、AAS特典を付与・変更・解除します。note購入状態の自動取得は別の連携機能として扱います。
        </div>
      </div>
    </main>
  );
}
