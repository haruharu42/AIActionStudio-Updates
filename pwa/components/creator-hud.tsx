"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DirectRuntimeImage } from "@/components/direct-runtime-image";

import { formatRefreshCadence, getMyCreatorDashboard, xpProgress, type CreatorDashboard } from "@/lib/creator-system";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "@/components/creator-system.module.css";

function avatarLetter(name: string): string {
  return (name.trim().charAt(0) || "A").toUpperCase();
}

export function CreatorHud() {
  const [dashboard, setDashboard] = useState<CreatorDashboard | null>(null);

  useEffect(() => {
    let active = true;
    let client: ReturnType<typeof getSupabaseClient>;
    try {
      client = getSupabaseClient();
    } catch {
      return;
    }
    queueMicrotask(() => {
      if (!active) return;
      void getMyCreatorDashboard(client).then(
        (next) => { if (active) setDashboard(next); },
        () => { if (active) setDashboard(null); },
      );
    });
    return () => { active = false; };
  }, []);

  const xp = useMemo(
    () => dashboard ? xpProgress(dashboard.totalXp, dashboard.level) : { current: 0, needed: 500, percent: 0 },
    [dashboard],
  );

  if (!dashboard) return null;

  const displayName = dashboard.publicName || "Creator";
  const cadence = formatRefreshCadence(dashboard.knowledgeRefreshHours);
  const membershipLabel = dashboard.membershipBadgeLabel || dashboard.membershipPlanName || "◆ Creator Club";

  return (
    <section className={`${styles.shell} ${styles.hud}`} aria-label="Creator Level">
      <div className={styles.hudInner}>
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            {dashboard.avatarUrl ? <DirectRuntimeImage src={dashboard.avatarUrl} alt="" /> : avatarLetter(displayName)}
          </span>
          <div className={styles.identityText}>
            <p className={styles.eyebrow}>CREATOR STATUS</p>
            <div className={styles.nameRow}>
              <strong>{displayName}</strong>
              {dashboard.noteMember && <span className={styles.memberBadge}>{membershipLabel}</span>}
            </div>
            <div className={styles.levelRow}>
              <span>Lv.{dashboard.level}</span>
              <span>{xp.current} / {xp.needed} XP</span>
            </div>
            <div className={styles.progress} aria-label={`レベル進捗 ${xp.percent}%`}><span style={{ width: `${xp.percent}%` }} /></div>
          </div>
        </div>

        <div className={styles.statCard}>
          <small>完成した記事</small>
          <span className={styles.statBig}>{dashboard.completedArticles}</span>
          <div className={styles.statMeta}>
            <span>今週 {dashboard.weeklyXp} XP</span>
            <span>記事枠 +{dashboard.creatorArticleQuotaBonus}</span>
          </div>
        </div>

        <div className={styles.knowledgeCard}>
          <div className={styles.knowledgeTop}>
            <small>AI Knowledge</small>
            <span className={`${styles.tierBadge} ${dashboard.knowledgeTier === "fresh" ? styles.tierFresh : ""}`}>
              {dashboard.knowledgeTier === "fresh" ? "Fresh" : "Stable"}
            </span>
          </div>
          <strong>{cadence}更新</strong>
          <small>
            {dashboard.noteMember
              ? `${dashboard.membershipPlanName} · 記事XP ×${dashboard.articleXpMultiplier.toFixed(1)}`
              : `Knowledge v${dashboard.knowledgeVersion} · 通常ナレッジ`}
          </small>
        </div>

        <div className={styles.hudActions}>
          <Link className={styles.actionLink} href="/missions">🎯 ミッション{dashboard.claimableMissions > 0 ? ` (${dashboard.claimableMissions})` : ""}</Link>
          <Link className={styles.actionLink} href="/ranking">🏆 ランキング</Link>
          <Link className={styles.actionLink} href="/profile">⚙ プロフィール</Link>
        </div>
      </div>
    </section>
  );
}
